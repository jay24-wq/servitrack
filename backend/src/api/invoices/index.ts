import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { recalculateTicketFinalCost } from '@services/ticketCost';
import { logAudit } from '@services/auditLog';
import { invoiceFromTicket } from '@utils/code';

export const invoiceRouter = Router();

invoiceRouter.use(authMiddleware, requireRole('admin', 'frontdesk'), tenantResolver, branchResolver);

function presentInvoice<T extends Record<string, any>>(invoice: T): T {
  return invoice;
}

async function invoiceLines(trx: any, tenantId: string, ticketId: string, cost: Awaited<ReturnType<typeof recalculateTicketFinalCost>>) {
  const usages = await trx('ticket_part_usages as usage')
    .leftJoin('parts as part', 'part.id', 'usage.part_id')
    .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
    .where({ 'usage.tenant_id': tenantId, 'usage.ticket_id': ticketId })
    .groupBy('usage.id', 'part.name')
    .havingRaw('usage.qty - COALESCE(SUM(reversal.qty), 0) > 0')
    .select(
      'part.name', 'usage.unit_price',
      trx.raw('usage.qty - COALESCE(SUM(reversal.qty), 0) AS quantity')
    );

  const lines: Array<{ type: string; name: string; quantity: number; unit_price: number; total: number }> = [];
  if (cost.serviceFee > 0) lines.push({ type: 'service', name: 'Jasa servis', quantity: 1, unit_price: cost.serviceFee, total: cost.serviceFee });
  for (const usage of usages) {
    const quantity = Number(usage.quantity);
    const unitPrice = Number(usage.unit_price);
    if (quantity > 0) lines.push({ type: 'part', name: usage.name ?? 'Sparepart', quantity, unit_price: unitPrice, total: quantity * unitPrice });
  }
  if (cost.diagnosticFee > 0) lines.push({ type: 'diagnostic', name: 'Biaya diagnosa servis batal', quantity: 1, unit_price: cost.diagnosticFee, total: cost.diagnosticFee });
  if (cost.deliveryFee > 0) lines.push({ type: 'delivery', name: 'Delivery', quantity: 1, unit_price: cost.deliveryFee, total: cost.deliveryFee });
  return lines;
}

async function createInvoice(trx: any, req: AuthRequest, ticketId: string, tenantId: string) {
  const ticket = await trx('service_tickets')
    .where({ id: ticketId, tenant_id: tenantId, branch_id: req.user?.branch_id })
    .forUpdate()
    .first();
  if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });

  const existing = await trx('invoices').where({ ticket_id: ticketId, tenant_id: tenantId }).first();
  if (existing) return { invoice: existing, created: false };
  if (!['selesai', 'siap_diambil', 'batal'].includes(ticket.current_status)) {
    throw Object.assign(new Error('Invoice hanya dapat dibuat untuk servis selesai atau batal'), { status: 409 });
  }

  const cost = await recalculateTicketFinalCost(trx, tenantId, ticketId);
  const lines = await invoiceLines(trx, tenantId, ticketId, cost);
  const [invoice] = await trx('invoices').insert({
    tenant_id: tenantId,
    ticket_id: ticketId,
    invoice_no: invoiceFromTicket(ticket.ticket_code),
    service_fee: cost.serviceFee,
    subtotal: cost.serviceFee + cost.partsCost,
    pickup_fee: cost.deliveryFee,
    additional_cost: cost.diagnosticFee,
    discount: 0,
    total: cost.finalCost,
    line_items: JSON.stringify(lines),
    status: 'unpaid',
  }).returning('*');

  await logAudit(trx, req, {
    action: 'invoice.created', entityType: 'invoice', entityId: invoice.id, ticketId,
    newValues: { invoice_no: invoice.invoice_no, total: Number(invoice.total), line_count: lines.length },
  });
  return { invoice, created: true };
}

// List completed tickets without an invoice so the frontdesk can issue one in one click.
invoiceRouter.get('/ready', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const tickets = await reqDb(req)('service_tickets as t')
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .where({ 't.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
      .whereIn('t.current_status', ['selesai', 'siap_diambil', 'batal'])
      .whereNotExists(reqDb(req)('invoices as i').select(reqDb(req).raw('1'))
        .whereRaw('i.ticket_id = t.id').where('i.tenant_id', tenantId))
      .select('t.id', 't.ticket_code', 't.tracking_code', 't.current_status', 't.completed_at', 't.service_fee', 'c.name as customer_name', 'c.phone_wa as customer_phone', 'd.model as device_model')
      .orderBy('t.completed_at', 'desc').orderBy('t.created_at', 'desc');

    const data = await Promise.all(tickets.map(async (ticket) => ({
      ...ticket,
      cost: await recalculateTicketFinalCost(reqDb(req), tenantId, ticket.id),
    })));
    return res.json({ data });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengambil tiket siap ditagih' });
  }
});

// POST /api/invoices - issue a frozen invoice snapshot from final service costs.
invoiceRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const ticketId = req.body?.ticket_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (typeof ticketId !== 'string' || !ticketId) return res.status(400).json({ error: 'ticket_id wajib diisi' });
    const result = await withTenantContext(tenantId, (trx) => createInvoice(trx, req, ticketId, tenantId));
    return res.status(result.created ? 201 : 200).json({ data: presentInvoice(result.invoice) });
  } catch (error: any) {
    return res.status(error.status || (error.code === '23505' ? 409 : 500)).json({ error: error.message || 'Gagal membuat invoice' });
  }
});

// GET /api/invoices - all invoices, including unpaid invoices without payments.
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const invoices = await reqDb(req)('invoices as i')
      .leftJoin('service_tickets as t', 't.id', 'i.ticket_id')
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .leftJoin('users as handover_user', 'handover_user.id', 't.handed_over_by')
      .leftJoin('branches as b', 'b.id', 't.branch_id')
      .leftJoin('tenants as w', 'w.id', 'i.tenant_id')
      .where({ 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
      .select('i.*', 't.ticket_code', 't.tracking_code', 't.current_status', 't.handed_over_at', 't.handed_over_by', 'handover_user.name as handed_over_by_name', 'c.name as customer_name', 'c.phone_wa as customer_phone', 'd.model as device_model', 'b.name as branch_name', 'b.address as branch_address', 'w.name as workshop_name')
      .orderBy('i.created_at', 'desc');
    return res.json({ data: invoices.map(presentInvoice) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil data invoice' });
  }
});

invoiceRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const invoice = await reqDb(req)('invoices as i')
      .join('service_tickets as t', 't.id', 'i.ticket_id')
      .where({ 'i.id': req.params.id, 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
      .select('i.*', 't.ticket_code', 't.tracking_code', 't.current_status')
      .first();
    if (!invoice) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    return res.json({ data: presentInvoice(invoice) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil invoice' });
  }
});

export { createInvoice, invoiceLines, presentInvoice };
