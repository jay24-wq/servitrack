import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';

export const invoiceRouter = Router();

invoiceRouter.use(authMiddleware);
invoiceRouter.use(requireRole('admin', 'frontdesk'));
invoiceRouter.use(tenantResolver);
invoiceRouter.use(branchResolver);

// POST /api/invoices - generate invoice from ticket
invoiceRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { ticket_id, invoice_no, subtotal, additional_cost, discount } = req.body;
    if (!ticket_id || !invoice_no || subtotal === undefined) {
      res.status(400).json({ error: 'ticket_id, invoice_no, subtotal wajib diisi' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets').where({ id: ticket_id, tenant_id, branch_id: req.user?.branch_id }).first();
      if (!ticket) throw new Error('Tiket tidak ditemukan');

       const existing = await trx('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id')
         .where({ 'i.ticket_id': ticket_id, 'i.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id }).first();
      if (existing) throw new Error('Tiket sudah memiliki invoice');

      const booking = ticket.booking_id
        ? await trx('bookings').where({ id: ticket.booking_id, tenant_id, branch_id: req.user?.branch_id }).first()
        : null;
      const pickupFee = Number(booking?.pickup_fee ?? 0);
      const addCost = additional_cost || 0;
      const disc = discount || 0;
      const total = Number(subtotal) + pickupFee + Number(addCost) - Number(disc);

      const [invoice] = await trx('invoices')
        .insert({
          tenant_id,
          ticket_id,
          invoice_no,
          subtotal,
          pickup_fee: pickupFee,
          additional_cost: addCost,
          discount: disc,
          total,
          status: 'unpaid',
        })
        .returning('*');

      return invoice;
    });

    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat invoice' });
  }
});

// GET /api/invoices - List invoices for tenant
invoiceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const invoices = await reqDb(req)('invoices as i')
      .where('i.tenant_id', tenant_id)
      .leftJoin('service_tickets as t', 't.id', 'i.ticket_id')
      .where('t.branch_id', req.user?.branch_id)
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .select(
        'i.*',
        't.ticket_code',
        't.tracking_code',
        't.current_status',
        'c.name as customer_name'
      )
      .orderBy('i.created_at', 'desc');

    res.json({ data: invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data invoice' });
  }
});

// GET /api/invoices/:id
invoiceRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const invoice = await withTenantContext(tenant_id!, async (trx) => {
      return trx('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'i.id': id, 'i.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id }).select('i.*').first();
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice tidak ditemukan' });
      return;
    }
    res.json({ data: invoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil invoice' });
  }
});
