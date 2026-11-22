import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

export interface TicketCostBreakdown {
  serviceFee: number;
  diagnosticFee: number;
  partsCost: number;
  deliveryFee: number;
  finalCost: number;
}

export function calculateTicketCost(input: {
  currentStatus: string;
  workflowResolution?: string | null;
  serviceFee: number;
  diagnosticFee: number;
  partsCost: number;
  deliveryFee: number;
}): TicketCostBreakdown {
  const cancelled = input.currentStatus === 'batal' || (
    input.currentStatus === 'siap_diambil' && input.workflowResolution === 'cancel_and_return'
  );
  const serviceFee = cancelled ? 0 : input.serviceFee;
  const diagnosticFee = cancelled ? input.diagnosticFee : 0;
  return {
    serviceFee,
    diagnosticFee,
    partsCost: input.partsCost,
    deliveryFee: input.deliveryFee,
    finalCost: serviceFee + diagnosticFee + input.partsCost + input.deliveryFee,
  };
}

export async function recalculateTicketFinalCost(
  db: DbExecutor,
  tenantId: string,
  ticketId: string
): Promise<TicketCostBreakdown> {
  const ticket = await db('service_tickets as t')
    .leftJoin('bookings as b', 'b.id', 't.booking_id')
    .where({ 't.id': ticketId, 't.tenant_id': tenantId })
    .select('t.current_status', 't.workflow_resolution', 't.service_fee', 't.diagnostic_fee', 'b.pickup_fee')
    .first();
  if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });

  const [parts] = await db('ticket_part_usages as usage')
    .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
    .where({ 'usage.tenant_id': tenantId, 'usage.ticket_id': ticketId })
    .select(db.raw('COALESCE(SUM((usage.qty - COALESCE(reversal.qty, 0)) * usage.unit_price), 0) as total'));

  const partsCost = Number(parts?.total ?? 0);
  const costs = calculateTicketCost({
    currentStatus: ticket.current_status,
    workflowResolution: ticket.workflow_resolution,
    serviceFee: Number(ticket.service_fee ?? 0),
    diagnosticFee: Number(ticket.diagnostic_fee ?? 0),
    partsCost,
    deliveryFee: Number(ticket.pickup_fee ?? 0),
  });
  await db('service_tickets').where({ id: ticketId, tenant_id: tenantId }).update({ final_cost: costs.finalCost });

  return costs;
}
