import type { Knex } from 'knex';
import { canTransitionTicket } from '@common/utils/TicketStatuses';

type Requirement = { part_id: string; part_name?: string; qty: number };

async function netUsed(trx: Knex.Transaction, tenantId: string, ticketId: string, partId: string) {
  const row = await trx('ticket_part_usages as usage')
    .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
    .where({ 'usage.tenant_id': tenantId, 'usage.ticket_id': ticketId, 'usage.part_id': partId })
    .select(trx.raw('COALESCE(SUM(usage.qty - COALESCE(reversal.qty, 0)), 0) as used_qty'))
    .first();
  return Math.max(0, Number(row?.used_qty ?? 0));
}

export async function reevaluateWaitingPartTickets(
  trx: Knex.Transaction,
  input: { tenantId: string; branchId: string; actorId: string }
) {
  const waiting = await trx('service_tickets')
    .where({ tenant_id: input.tenantId, branch_id: input.branchId, current_status: 'menunggu_part' })
    .forUpdate()
    .select('*');
  const resumed: Array<{ ticket: any; phone: string | null; previousStatus: string }> = [];

  for (const ticket of waiting) {
    let requirements: Requirement[] = [];
    const shortages: Array<Record<string, unknown>> = [];
    const quote = ticket.workflow_resolution !== 'continue_original'
      ? await trx('quotations').where({ tenant_id: input.tenantId, ticket_id: ticket.id, status: 'approved' }).orderBy('created_at', 'desc').first()
      : null;
    if (quote) {
      const items = await trx('quotation_items')
        .where({ tenant_id: input.tenantId, quotation_id: quote.id, item_type: 'part' })
        .orderBy('created_at', 'asc');
      const grouped = new Map<string, number>();
      const requests = await trx('part_requests').where({ tenant_id: input.tenantId, quotation_id: quote.id });
      const requestByItem = new Map(requests.map((request: any) => [request.quotation_item_id, request]));
      for (const item of items) {
        if (item.part_id) grouped.set(item.part_id, (grouped.get(item.part_id) ?? 0) + Number(item.qty));
        else if (item.part_is_registered === false) {
          const request: any = requestByItem.get(item.id);
          shortages.push({
            part_id: request?.linked_part_id ?? `request:${item.id}`,
            part_name: request?.requested_name ?? item.part_name_snapshot ?? item.description,
            required_qty: Number(request?.qty ?? item.qty),
            available_qty: 0,
            shortage_qty: Number(request?.qty ?? item.qty),
            part_request_id: request?.id ?? null,
            part_request_status: request?.status ?? 'OPEN',
            estimated_arrival_days: request?.estimated_arrival_days ?? item.estimated_part_arrival_days,
          });
        }
      }
      requirements = Array.from(grouped, ([part_id, qty]) => ({ part_id, qty }));
    } else if (ticket.work_type === 'with_parts' && ticket.requested_part_id) {
      requirements = [{ part_id: ticket.requested_part_id, qty: Number(ticket.requested_part_qty ?? 0) }];
    }

    for (const requirement of requirements) {
      const part = await trx('parts').where({ id: requirement.part_id, tenant_id: input.tenantId, branch_id: input.branchId }).forUpdate().first();
      const available = Number(part?.stock_qty ?? 0);
      const remaining = Math.max(0, requirement.qty - await netUsed(trx, input.tenantId, ticket.id, requirement.part_id));
      if (!part || available < remaining) shortages.push({
        part_id: requirement.part_id,
        part_name: part?.name ?? 'Sparepart',
        required_qty: remaining,
        available_qty: available,
        shortage_qty: Math.max(0, remaining - available),
      });
    }

    const nextStatus = shortages.length ? 'menunggu_part' : 'pengerjaan';
    if (nextStatus !== ticket.current_status && canTransitionTicket(ticket.current_status, nextStatus)) {
      await trx('service_tickets').where({ id: ticket.id, tenant_id: input.tenantId }).update({ current_status: nextStatus, part_shortages: JSON.stringify(shortages) });
      await trx('ticket_status_logs').insert({
        tenant_id: input.tenantId, ticket_id: ticket.id, changed_by: input.actorId,
        from_status: ticket.current_status, to_status: nextStatus,
        note: 'Stok masuk; validasi ulang sparepart berhasil',
      });
      await trx('audit_logs').insert({
        tenant_id: input.tenantId, user_id: input.actorId, action: 'ticket.parts_restocked',
        entity_type: 'service_ticket', entity_id: ticket.id, ticket_id: ticket.id,
        actor_type: 'user', old_values: { current_status: ticket.current_status, part_shortages: ticket.part_shortages },
        new_values: { current_status: nextStatus, part_shortages: shortages },
      });
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id: input.tenantId }).select('phone_wa').first();
      resumed.push({ ticket: { ...ticket, current_status: nextStatus }, phone: customer?.phone_wa ?? null, previousStatus: ticket.current_status });
    } else if (shortages.length) {
      await trx('service_tickets').where({ id: ticket.id, tenant_id: input.tenantId }).update({ part_shortages: JSON.stringify(shortages) });
    }
  }
  return resumed;
}
