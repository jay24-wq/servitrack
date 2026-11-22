import type { Knex } from 'knex';
import { canTransitionTicket } from '@common/utils/TicketStatuses';
import { recalculateTicketFinalCost } from '@services/ticketCost';
import { createPendingPartRequests, transitionQuotationPartRequests } from './partRequests';

export type QuotationDecision = 'approved' | 'rejected';

export interface DecideQuotationInput {
  tenantId: string;
  branchId?: string;
  quotationId?: string;
  approvalTokenHash?: string;
  decision: QuotationDecision;
  note?: string;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  manualApproval?: boolean;
}

function workflowError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

export async function decideQuotation(trx: Knex.Transaction, input: DecideQuotationInput) {
  const quotation = await trx('quotations')
    .where({ tenant_id: input.tenantId })
    .modify((query) => {
      if (input.quotationId) query.where({ id: input.quotationId });
      if (input.approvalTokenHash) query.where({ approval_token_hash: input.approvalTokenHash });
    })
    .forUpdate()
    .first();
  if (!quotation) throw workflowError('Quotation tidak ditemukan', 404);

  const ticketQuery = trx('service_tickets')
    .where({ id: quotation.ticket_id, tenant_id: input.tenantId })
    .modify((query) => {
      if (input.branchId) query.where({ branch_id: input.branchId });
    })
    .forUpdate();
  const ticket = await ticketQuery.first();
  if (!ticket) throw workflowError('Tiket tidak ditemukan', 404);
  const allowedStatuses = input.manualApproval ? ['draft', 'sent'] : ['sent'];
  if (!allowedStatuses.includes(quotation.status)) throw workflowError('Quotation tidak lagi menunggu persetujuan', 409);

  const now = new Date();
  const note = String(input.note ?? '').trim().slice(0, 500) || null;
  if (new Date(quotation.expires_at).getTime() <= now.getTime()) {
    const [expired] = await trx('quotations')
      .where({ id: quotation.id, tenant_id: input.tenantId, status: quotation.status })
      .update({ status: 'expired', decided_at: now, decision_note: 'Tautan persetujuan kedaluwarsa' })
      .returning('*');
    await transitionQuotationPartRequests(trx, {
      tenantId: input.tenantId, quotationId: quotation.id, to: 'CANCELLED',
      actorId: input.actorId ?? null, reason: 'Quotation kedaluwarsa',
    });
    await trx('audit_logs').insert({
      tenant_id: input.tenantId,
      user_id: input.actorId ?? null,
      action: 'quotation.expired',
      entity_type: 'quotation',
      entity_id: quotation.id,
      ticket_id: ticket.id,
      quotation_id: quotation.id,
      actor_type: 'system',
      old_values: { status: quotation.status },
      new_values: { status: 'expired', ticket_code: ticket.ticket_code },
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
    return { quotation: expired, ticket, ticketStatus: ticket.current_status, expired: true };
  }

  if (ticket.current_status !== 'menunggu_persetujuan') {
    throw workflowError('Tiket tidak lagi menunggu persetujuan quotation', 409);
  }

  const [updatedQuotation] = await trx('quotations')
    .where({ id: quotation.id, tenant_id: input.tenantId, status: quotation.status })
    .update({ status: input.decision, decided_at: now, decision_note: note })
    .returning('*');

  let nextTicketStatus = ticket.current_status;
  let partShortages: Array<Record<string, unknown>> = [];
  let availabilityChanged = false;
  if (input.decision === 'approved') {
    const quotationItems = await trx('quotation_items').where({ tenant_id: input.tenantId, quotation_id: quotation.id }).orderBy('created_at', 'asc');
    await createPendingPartRequests(trx, {
      tenantId: input.tenantId,
      branchId: ticket.branch_id,
      ticketId: ticket.id,
      quotationId: quotation.id,
      requestedBy: quotation.created_by,
      items: quotationItems,
    });
    await transitionQuotationPartRequests(trx, {
      tenantId: input.tenantId, quotationId: quotation.id, to: 'OPEN', actorId: input.actorId ?? null,
    });
    const items = quotationItems.filter((item: any) => item.item_type === 'part' && item.part_id);
    const requestedByPart = new Map<string, { qty: number; items: any[] }>();
    for (const item of items) {
      const group = requestedByPart.get(item.part_id) ?? { qty: 0, items: [] };
      group.qty += Number(item.qty);
      group.items.push(item);
      requestedByPart.set(item.part_id, group);
    }

    for (const [partId, request] of requestedByPart) {
      const part = await trx('parts')
        .where({ id: partId, tenant_id: input.tenantId, branch_id: ticket.branch_id, is_active: true })
        .forUpdate()
        .first();
      const availableQty = Number(part?.stock_qty ?? 0);
      for (const item of request.items) {
        const itemAvailability = availableQty <= 0 ? 'TIDAK_TERSEDIA' : availableQty < Number(item.qty) ? 'TERSEDIA_SEBAGIAN' : 'TERSEDIA';
        if (item.availability_status !== itemAvailability || Number(item.available_qty_snapshot) !== availableQty) availabilityChanged = true;
      }
      if (!part || availableQty < request.qty) {
        partShortages.push({
          part_id: partId,
          part_name: part?.name ?? request.items[0]?.description ?? 'Sparepart',
          required_qty: request.qty,
          available_qty: availableQty,
          shortage_qty: Math.max(0, request.qty - availableQty),
        });
      }
    }

    const unregisteredItems = await trx('quotation_items')
      .where({ tenant_id: input.tenantId, quotation_id: quotation.id, item_type: 'part', part_is_registered: false })
      .whereNull('part_id');
    const requests = await trx('part_requests').where({ tenant_id: input.tenantId, quotation_id: quotation.id });
    const requestByItem = new Map(requests.map((request: any) => [request.quotation_item_id, request]));
    for (const item of unregisteredItems) {
      const request: any = requestByItem.get(item.id);
      partShortages.push({
        part_id: `request:${item.id}`,
        part_request_id: request?.id ?? null,
        part_request_status: request?.status ?? 'PENDING_APPROVAL',
        part_name: request?.requested_name ?? item.part_name_snapshot ?? item.description,
        required_qty: Number(request?.qty ?? item.qty),
        available_qty: 0,
        shortage_qty: Number(request?.qty ?? item.qty),
        estimated_arrival_days: Number(request?.estimated_arrival_days ?? item.estimated_part_arrival_days),
      });
      availabilityChanged = true;
    }

    nextTicketStatus = partShortages.length ? 'menunggu_part' : 'pengerjaan';
    if (!canTransitionTicket(ticket.current_status, nextTicketStatus)) {
      throw workflowError(`Transisi status tidak diizinkan: ${ticket.current_status} → ${nextTicketStatus}`, 409);
    }
    await trx('service_tickets')
      .where({ id: ticket.id, tenant_id: input.tenantId, branch_id: ticket.branch_id })
      .update({ current_status: nextTicketStatus, part_shortages: JSON.stringify(partShortages) });
    await trx('ticket_status_logs').insert({
      tenant_id: input.tenantId,
      ticket_id: ticket.id,
      changed_by: input.actorId ?? null,
      from_status: ticket.current_status,
      to_status: nextTicketStatus,
      note: nextTicketStatus === 'menunggu_part'
        ? `Quotation disetujui; stok kurang: ${partShortages.map((part) => `${part.part_name} kurang ${part.shortage_qty}`).join(', ')}`
        : 'Quotation disetujui pelanggan',
    });
  } else {
    await transitionQuotationPartRequests(trx, {
      tenantId: input.tenantId, quotationId: quotation.id, to: 'CANCELLED',
      actorId: input.actorId ?? null, reason: 'Quotation ditolak pelanggan',
    });
  }

  await trx('audit_logs').insert({
    tenant_id: input.tenantId,
    user_id: input.actorId ?? null,
    action: input.manualApproval ? `quotation.${input.decision}.manual` : `quotation.${input.decision}`,
    entity_type: 'quotation',
    entity_id: quotation.id,
    ticket_id: ticket.id,
    quotation_id: quotation.id,
    actor_type: input.actorId ? 'user' : 'customer',
    old_values: { status: quotation.status, ticket_status: ticket.current_status },
    new_values: {
      status: updatedQuotation.status,
      ticket_code: ticket.ticket_code,
      ticket_status: nextTicketStatus,
      decision_note: note,
      part_shortages: partShortages,
      availability_changed: availabilityChanged,
      approval_mode: input.manualApproval ? 'MANUAL' : input.actorId ? 'STAFF' : 'CUSTOMER',
    },
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    note,
  });

  const customer = await trx('customers')
    .where({ id: ticket.customer_id, tenant_id: input.tenantId })
    .select('phone_wa')
    .first();
  return {
    quotation: updatedQuotation,
    ticket,
    ticketStatus: nextTicketStatus,
    customerPhone: customer?.phone_wa ?? '',
    availabilityChanged,
    partShortages,
    expired: false,
  };
}

export async function resolveRejectedQuotation(
  trx: Knex.Transaction,
  input: { tenantId: string; branchId: string; ticketId: string; quotationId: string; action: 'continue_original' | 'cancel_and_return'; actorId: string; ipAddress?: string | null }
) {
  const ticket = await trx('service_tickets')
    .where({ id: input.ticketId, tenant_id: input.tenantId, branch_id: input.branchId })
    .forUpdate()
    .first();
  if (!ticket) throw workflowError('Tiket tidak ditemukan', 404);
  if (ticket.current_status !== 'menunggu_persetujuan') {
    throw workflowError('Tiket tidak sedang menunggu keputusan quotation', 409);
  }

  const quotation = await trx('quotations')
    .where({ id: input.quotationId, ticket_id: input.ticketId, tenant_id: input.tenantId, status: 'rejected' })
    .forUpdate()
    .first();
  if (!quotation) throw workflowError('Quotation ditolak tidak ditemukan', 404);

  const nextTicketStatus = input.action === 'cancel_and_return' ? 'batal' : 'pengerjaan';
  if (!canTransitionTicket(ticket.current_status, nextTicketStatus)) {
    throw workflowError(`Transisi status tidak diizinkan: ${ticket.current_status} → ${nextTicketStatus}`, 409);
  }
  const resolutionNote = input.action === 'cancel_and_return'
    ? 'Pelanggan menolak quotation; servis dibatalkan dan perangkat dikembalikan'
    : 'Pelanggan menolak quotation; teknisi melanjutkan hanya sesuai keluhan awal';
  const update = input.action === 'cancel_and_return'
    ? { current_status: nextTicketStatus, workflow_resolution: input.action, cancelled_at: new Date(), requested_part_id: null, requested_part_qty: null }
    : {
        current_status: nextTicketStatus,
        workflow_resolution: input.action,
        work_type: 'without_parts',
        requested_part_id: null,
        requested_part_qty: null,
      };

  await trx('service_tickets')
    .where({ id: input.ticketId, tenant_id: input.tenantId, branch_id: input.branchId })
    .update(update);
  await recalculateTicketFinalCost(trx, input.tenantId, input.ticketId);
  await trx('ticket_status_logs').insert({
    tenant_id: input.tenantId,
    ticket_id: input.ticketId,
    changed_by: input.actorId,
    from_status: ticket.current_status,
    to_status: nextTicketStatus,
    note: resolutionNote,
  });
  await trx('audit_logs').insert({
    tenant_id: input.tenantId,
    user_id: input.actorId,
    action: 'quotation.rejection_resolved',
    entity_type: 'quotation',
    entity_id: quotation.id,
    old_values: { ticket_status: ticket.current_status, work_type: ticket.work_type },
    new_values: { decision: input.action, ticket_status: nextTicketStatus, note: resolutionNote },
    ip_address: input.ipAddress ?? null,
  });

  return { ticketStatus: nextTicketStatus, resolutionNote };
}
