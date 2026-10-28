import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { notifyPaymentReceived } from '@services/notifications/events';

export const paymentRouter = Router();

paymentRouter.use(authMiddleware);
paymentRouter.use(requireRole('admin', 'frontdesk'));
paymentRouter.use(tenantResolver);

// GET /api/payments - list payments with invoice/ticket/customer
paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const { status, method, from, to, search } = req.query as any;
    const dbq = reqDb(req);

    let q = dbq('payments as p')
      .leftJoin('invoices as i', 'i.id', 'p.invoice_id')
      .leftJoin('service_tickets as t', 't.id', 'i.ticket_id')
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .where('p.tenant_id', tenant_id)
      .select(
        'p.id',
        'p.method',
        'p.amount',
        'p.status',
        'p.paid_at',
        'p.gateway_ref',
        'i.id as invoice_id',
        'i.invoice_no',
        'i.total as invoice_total',
        'i.status as invoice_status',
        'i.issued_at',
        't.ticket_code',
        't.tracking_code',
        'c.name as customer_name',
        'c.phone_wa as customer_phone'
      )
      .orderBy('p.paid_at', 'desc');

    if (status) q = q.where('i.status', status);
    if (method) q = q.where('p.method', method);
    if (from) q = q.where('p.paid_at', '>=', from);
    if (to) q = q.where('p.paid_at', '<=', to);
    if (search) {
      const s = `%${search}%`;
      q = q.where((b) => {
        b.where('i.invoice_no', 'ilike', s)
          .orWhere('t.ticket_code', 'ilike', s)
          .orWhere('t.tracking_code', 'ilike', s)
          .orWhere('c.name', 'ilike', s)
          .orWhere('c.phone_wa', 'ilike', s);
      });
    }

    const rows = await q;
    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data pembayaran' });
  }
});

// POST /api/payments - record payment, auto-update invoice status
paymentRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { invoice_id, method, amount, gateway_ref } = req.body;
    if (!invoice_id || !method || !amount || amount <= 0) {
      res.status(400).json({ error: 'Data pembayaran tidak valid' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const invoice = await trx('invoices').where({ id: invoice_id, tenant_id }).first();
      if (!invoice) throw new Error('Invoice tidak ditemukan');

      const [payment] = await trx('payments')
        .insert({
          tenant_id,
          invoice_id,
          received_by: req.user?.user_id,
          method,
          amount,
          status: 'paid',
          gateway_ref: gateway_ref || null,
          paid_at: new Date(),
        })
        .returning('*');

      // Hitung total pembayaran yang sudah paid
      const [agg] = await trx('payments')
        .where({ invoice_id, tenant_id, status: 'paid' })
        .sum('amount as total_paid');

      const totalPaid = Number(agg.total_paid) || 0;
      let newStatus = invoice.status;
      if (totalPaid >= Number(invoice.total)) {
        newStatus = 'paid';
      } else {
        newStatus = 'partial';
      }

      await trx('invoices')
        .where({ id: invoice_id })
        .update({ status: newStatus });

       const ticket = await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id }).first();
       const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id }).select('phone_wa').first();
       return { payment, invoice_status: newStatus, invoice, ticket, customerPhone: customer?.phone_wa ?? '' };
     });

    void notifyPaymentReceived({
      tenantId: tenant_id,
      customerId: result.ticket.customer_id,
      phone: result.customerPhone,
      ticketId: result.ticket.id,
      invoiceNumber: result.invoice.invoice_no,
      amount: Number(result.payment.amount),
      paymentStatus: result.invoice_status,
    });

    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mencatat pembayaran' });
  }
});
