import type { Knex } from 'knex';

export async function createPendingPartRequests(
  trx: Knex.Transaction,
  input: { tenantId: string; branchId: string; ticketId: string; quotationId: string; requestedBy: string; items: any[] }
) {
  const created = [];
  for (const item of input.items) {
    if (item.item_type !== 'part' || item.part_is_registered !== false) continue;
    const [request] = await trx('part_requests').insert({
      tenant_id: input.tenantId,
      branch_id: input.branchId,
      ticket_id: input.ticketId,
      quotation_id: input.quotationId,
      quotation_item_id: item.id,
      requested_name: item.part_name_snapshot,
      specification: item.part_specification_snapshot ?? null,
      qty: Number(item.qty),
      estimated_price: Number(item.part_unit_price_snapshot),
      estimated_arrival_days: Number(item.estimated_part_arrival_days),
      status: 'PENDING_APPROVAL',
      requested_by: input.requestedBy,
    }).onConflict('quotation_item_id').ignore().returning('*');
    if (!request) continue;
    await trx('audit_logs').insert({
      tenant_id: input.tenantId,
      user_id: input.requestedBy,
      action: 'part_request.created',
      entity_type: 'part_request',
      entity_id: request.id,
      ticket_id: input.ticketId,
      quotation_id: input.quotationId,
      actor_type: 'user',
      old_values: null,
      new_values: { status: request.status, requested_name: request.requested_name, qty: request.qty, estimated_price: request.estimated_price, estimated_arrival_days: request.estimated_arrival_days },
    });
    created.push(request);
  }
  return created;
}

export async function transitionQuotationPartRequests(
  trx: Knex.Transaction,
  input: { tenantId: string; quotationId: string; to: 'OPEN' | 'CANCELLED'; actorId?: string | null; reason?: string | null }
) {
  const fromStatuses = input.to === 'OPEN' ? ['PENDING_APPROVAL'] : ['PENDING_APPROVAL', 'OPEN', 'ORDERED'];
  const requests = await trx('part_requests')
    .where({ tenant_id: input.tenantId, quotation_id: input.quotationId })
    .whereIn('status', fromStatuses)
    .forUpdate()
    .select('*');
  for (const request of requests) {
    await trx('part_requests').where({ id: request.id, tenant_id: input.tenantId }).update({
      status: input.to,
      ...(input.to === 'OPEN' ? {} : { cancelled_reason: input.reason || 'Quotation tidak disetujui' }),
    });
    await trx('audit_logs').insert({
      tenant_id: input.tenantId,
      user_id: input.actorId ?? null,
      action: input.to === 'OPEN' ? 'part_request.opened' : 'part_request.cancelled',
      entity_type: 'part_request',
      entity_id: request.id,
      ticket_id: request.ticket_id,
      quotation_id: input.quotationId,
      actor_type: input.actorId ? 'user' : 'system',
      old_values: { status: request.status },
      new_values: { status: input.to, reason: input.reason ?? null },
      note: input.reason ?? null,
    });
  }
  return requests.length;
}
