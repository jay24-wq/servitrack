import { Router, Response, Request, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { logAudit } from '@services/auditLog';
import { notifyPaymentReceived } from '@services/notifications/events';
import { sendWhatsAppNotification } from '@services/notifications/notificationService';
import { getPaymentGateway, midtransSettings, newMidtransOrderId } from '@services/payments/MidtransGateway';
import { validateOfflinePayment } from '@services/payments/paymentPolicy';
import { presentInvoice } from '@api/invoices';

export const paymentRouter = Router();
paymentRouter.use(authMiddleware, requireRole('admin', 'frontdesk'), tenantResolver, branchResolver);

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Bukti harus berupa JPG, PNG, atau WebP'));
    callback(null, true);
  },
});

function uploadProof(req: Request, res: Response, next: NextFunction) {
  return proofUpload.single('proof')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Bukti pembayaran tidak valid' });
    return next();
  });
}

function statusForUi(status: string) {
  if (status === 'cancelled') return 'cancelled';
  return status;
}

async function storeProof(req: AuthRequest) {
  if (!req.file) return null;
  const ext = req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const directory = path.resolve(process.env.UPLOAD_DIR || 'uploads', 'payment-proofs');
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
  return `/uploads/payment-proofs/${filename}`;
}

async function notifyPaid(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; paymentId: string;
  invoiceNo: string; trackingCode: string; amount: number;
}) {
  void notifyPaymentReceived({
    ...input, invoiceNumber: input.invoiceNo, paymentStatus: 'Lunas',
  });
}

async function promoteTicketToPickup(trx: any, req: AuthRequest, ticket: any) {
  if (ticket.current_status === 'siap_diambil') return;
  if (!['selesai', 'batal'].includes(ticket.current_status)) return;
  await trx('service_tickets').where({ id: ticket.id, tenant_id: ticket.tenant_id }).update({ current_status: 'siap_diambil', updated_at: trx.fn.now() });
  await trx('ticket_status_logs').insert({
    tenant_id: ticket.tenant_id, ticket_id: ticket.id, changed_by: req.user?.user_id,
    from_status: ticket.current_status, to_status: 'siap_diambil', note: 'Invoice lunas; siap diserahkan',
  });
  await logAudit(trx, req, {
    action: 'ticket.ready_for_handover', entityType: 'service_ticket', entityId: ticket.id,
    oldValues: { current_status: ticket.current_status }, newValues: { current_status: 'siap_diambil' },
  });
}

async function sendInvoiceMessage(req: AuthRequest, invoiceId: string) {
  const tenantId = req.user!.tenant_id;
  const result = await withTenantContext(tenantId, async (trx) => {
    const invoice = await trx('invoices as i')
      .join('service_tickets as t', 't.id', 'i.ticket_id')
      .join('customers as c', 'c.id', 't.customer_id')
      .where({ 'i.id': invoiceId, 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
      .select('i.*', 't.id as ticket_id', 't.customer_id', 't.tracking_code', 'c.phone_wa', 'c.name as customer_name')
      .first();
    if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
    if (invoice.status === 'paid' || invoice.status === 'cancelled') throw Object.assign(new Error('Invoice tidak menunggu pembayaran'), { status: 409 });
    const [tenant, settings, pending] = await Promise.all([
      trx('tenants').where({ id: tenantId }).select('name').first(),
      trx('tenant_payment_settings').where({ tenant_id: tenantId }).first(),
      trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, gateway: 'midtrans', status: 'pending' }).where('expires_at', '>', new Date()).orderBy('created_at', 'desc').first(),
    ]);
    return { invoice, tenant, settings, pending };
  });
  const { invoice, tenant, settings, pending } = result;
  if (!invoice.phone_wa) throw Object.assign(new Error('Nomor WhatsApp pelanggan belum tersedia'), { status: 409 });
  const notification = await sendWhatsAppNotification({
    tenantId, customerId: invoice.customer_id, ticketId: invoice.ticket_id, toPhone: invoice.phone_wa,
    templateName: pending?.snap_url ? 'payment_link' : 'payment_instruction',
    variables: {
      invoiceNumber: invoice.invoice_no,
      trackingCode: invoice.tracking_code,
      workshopName: tenant?.name ?? '',
      totalAmount: Number(invoice.total),
      deadline: pending?.expires_at ?? '',
      paymentLink: pending?.snap_url ?? '',
      bankName: settings?.bank_name ?? '',
      bankAccountName: settings?.bank_account_name ?? '',
      bankAccountNumber: settings?.bank_account_number ?? '',
      qrisUrl: settings?.static_qris_image_url ?? '',
      ewalletProvider: settings?.ewallet_provider ?? '',
      ewalletAccount: settings?.ewallet_account ?? '',
    },
  });
  await logAudit(reqDb(req), req, {
    action: 'payment.info_sent', entityType: 'invoice', entityId: invoice.id, ticketId: invoice.ticket_id,
    newValues: { notification_id: notification.id ?? null, result: notification.status, online: Boolean(pending?.snap_url) },
    note: notification.status === 'failed' ? notification.error : null,
  });
  return { ...notification, online: Boolean(pending?.snap_url) };
}

paymentRouter.get('/settings', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await reqDb(req)('tenant_payment_settings').where({ tenant_id: req.user!.tenant_id }).first();
    return res.json({ data: settings ?? { bank_name: '', bank_account_name: '', bank_account_number: '', static_qris_image_url: '', ewallet_provider: '', ewallet_account: '' } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil pengaturan pembayaran' });
  }
});

paymentRouter.put('/settings', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const values = {
      bank_name: String(body.bank_name ?? '').trim() || null,
      bank_account_name: String(body.bank_account_name ?? '').trim() || null,
      bank_account_number: String(body.bank_account_number ?? '').trim() || null,
      static_qris_image_url: String(body.static_qris_image_url ?? '').trim() || null,
      ewallet_provider: String(body.ewallet_provider ?? '').trim() || null,
      ewallet_account: String(body.ewallet_account ?? '').trim() || null,
      updated_by: req.user!.user_id,
      updated_at: new Date(),
    };
    if (Object.entries(values).some(([key, value]) => key !== 'updated_by' && key !== 'updated_at' && typeof value === 'string' && value.length > 500)) {
      return res.status(400).json({ error: 'Nilai pengaturan pembayaran terlalu panjang' });
    }
    if (values.static_qris_image_url && !/^https:\/\//i.test(values.static_qris_image_url)) {
      return res.status(400).json({ error: 'URL QRIS harus menggunakan HTTPS' });
    }
    const tenantId = req.user!.tenant_id;
    const current = await reqDb(req)('tenant_payment_settings').where({ tenant_id: tenantId }).first();
    const [saved] = await reqDb(req)('tenant_payment_settings').insert({ tenant_id: tenantId, ...values })
      .onConflict('tenant_id').merge(values).returning('*');
    await logAudit(reqDb(req), req, {
      action: 'settings.payment_instructions_updated', entityType: 'tenant_settings', entityId: tenantId,
      oldValues: { bank_name: current?.bank_name ?? null, qris_configured: Boolean(current?.static_qris_image_url) },
      newValues: { bank_name: saved.bank_name, qris_configured: Boolean(saved.static_qris_image_url), ewallet_provider: saved.ewallet_provider },
    });
    return res.json({ data: saved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan pengaturan pembayaran' });
  }
});

paymentRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const query = reqDb(req);
    const [invoiceTotals, waiting, paid, today] = await Promise.all([
      query('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id }).whereNot('i.status', 'cancelled').sum('i.total as total').first(),
      query('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id, 'i.status': 'unpaid' }).countDistinct('i.id as count').first(),
      query('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'p.tenant_id': tenantId, 't.branch_id': req.user?.branch_id }).whereIn('p.status', ['paid', 'refunding']).sum('p.amount as total').first(),
      query('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'p.tenant_id': tenantId, 't.branch_id': req.user?.branch_id }).whereIn('p.status', ['paid', 'refunding'])
        .whereRaw("(p.paid_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date")
        .count('p.id as count').first(),
    ]);
    return res.json({ data: {
      total_billed: Number(invoiceTotals?.total ?? 0),
      total_paid: Number(paid?.total ?? 0),
      waiting_count: Number(waiting?.count ?? 0),
      transactions_today: Number(today?.count ?? 0),
    } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil ringkasan pembayaran' });
  }
});

paymentRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const query = reqDb(req);
    const invoices = await query('invoices as i')
      .join('service_tickets as t', 't.id', 'i.ticket_id')
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .leftJoin('users as handover_user', 'handover_user.id', 't.handed_over_by')
      .leftJoin('branches as b', 'b.id', 't.branch_id')
      .leftJoin('tenants as w', 'w.id', 'i.tenant_id')
      .where({ 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
      .select('i.*', 't.ticket_code', 't.tracking_code', 't.current_status', 't.handed_over_at', 't.handed_over_by', 'handover_user.name as handed_over_by_name', 'c.name as customer_name', 'c.phone_wa as customer_phone', 'd.model as device_model', 'b.name as branch_name', 'b.address as branch_address', 'w.name as workshop_name')
      .orderBy('i.issued_at', 'desc');
    const invoiceIds = invoices.map((invoice: any) => invoice.id);
    const payments = invoiceIds.length
      ? await query('payments').where({ tenant_id: tenantId }).whereIn('invoice_id', invoiceIds).orderBy('created_at', 'desc')
      : [];
    const byInvoice = new Map<string, any[]>();
    for (const payment of payments) byInvoice.set(payment.invoice_id, [...(byInvoice.get(payment.invoice_id) ?? []), payment]);
    let rows = invoices.map((invoice: any) => {
      const history = byInvoice.get(invoice.id) ?? [];
      const latest = history[0];
      return {
        ...presentInvoice(invoice), invoice_id: invoice.id, invoice_no: invoice.invoice_no, invoice_total: invoice.total,
        invoice_status: statusForUi(invoice.status), issued_at: invoice.issued_at,
        paid_amount: history.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount), 0),
        id: latest?.id ?? invoice.id, method: latest?.method ?? null, amount: latest?.amount ?? 0,
        payment_status: latest?.status ?? null, paid_at: latest?.paid_at ?? null,
        reference_no: latest?.reference_no ?? null, proof_url: latest?.proof_url ?? null,
        gateway: latest?.gateway ?? null, order_id: latest?.order_id ?? null, snap_url: latest?.snap_url ?? null,
        is_full_settlement: latest?.is_full_settlement ?? false,
        expires_at: latest?.expires_at ?? null, gateway_status: latest?.gateway_status ?? null,
        gateway_payment_type: latest?.gateway_payment_type ?? null,
        has_active_online: history.some((payment) => payment.gateway === 'midtrans' && payment.status === 'pending' && payment.expires_at && new Date(payment.expires_at) > new Date()),
        handed_over_at: invoice.handed_over_at ?? null,
        handed_over_by_name: invoice.handed_over_by_name ?? null,
      };
    });
    const { status, method, from, to, search } = req.query as Record<string, string | undefined>;
    if (status) rows = rows.filter((row: any) => row.invoice_status === status || (status === 'Belum Bayar' && row.invoice_status === 'unpaid') || (status === 'Lunas' && row.invoice_status === 'paid') || (status === 'Batal' && row.invoice_status === 'cancelled'));
    if (method) rows = rows.filter((row: any) => row.method === method);
    if (from) rows = rows.filter((row: any) => String(row.paid_at ?? row.issued_at).slice(0, 10) >= from);
    if (to) rows = rows.filter((row: any) => String(row.paid_at ?? row.issued_at).slice(0, 10) <= to);
    if (search) {
      const term = search.toLocaleLowerCase();
      rows = rows.filter((row: any) => [row.invoice_no, row.ticket_code, row.tracking_code, row.customer_name, row.customer_phone]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(term)));
    }
    return res.json({ data: rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil data pembayaran' });
  }
});

paymentRouter.post('/', uploadProof, async (req: AuthRequest, res: Response) => {
  let proofUrl: string | null = null;
  try {
    const { invoice_id, method, amount, reference_no, cash_received } = req.body ?? {};
    const tenantId = req.user!.tenant_id;
    const idempotencyKey = String(req.get('Idempotency-Key') ?? req.body?.idempotency_key ?? '').trim();
    const paymentAmount = Number(amount);
    const received = method === 'cash' ? Number(cash_received) : 0;
    if (typeof invoice_id !== 'string') {
      return res.status(400).json({ error: 'Data pembayaran tidak valid' });
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) return res.status(400).json({ error: 'Idempotency-Key wajib diisi' });

    proofUrl = await storeProof(req);
    const result = await withTenantContext(tenantId, async (trx) => {
      const oldRequest = await trx('payments').where({ tenant_id: tenantId, idempotency_key: idempotencyKey }).first();
      if (oldRequest) {
        if (oldRequest.invoice_id !== invoice_id) throw Object.assign(new Error('Idempotency-Key sudah digunakan untuk transaksi lain'), { status: 409 });
        return { payment: oldRequest, invoice: null, ticket: null, phone: null, replay: true };
      }
      const invoice = await trx('invoices').where({ id: invoice_id, tenant_id: tenantId }).forUpdate().first();
      if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      if (invoice.status !== 'unpaid') throw Object.assign(new Error('Invoice harus Belum bayar untuk mencatat pelunasan penuh'), { status: 409 });
      const ticket = await trx('service_tickets as t').join('customers as c', 'c.id', 't.customer_id')
        .where({ 't.id': invoice.ticket_id, 't.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
        .select('t.*', 'c.name as customer_name', 'c.phone_wa as customer_phone').forUpdate().first();
      if (!ticket) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      const { changeAmount } = validateOfflinePayment({ method, amount: paymentAmount, total: Number(invoice.total), reference: reference_no, cashReceived: received });
      const existingLegacy = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, status: 'paid' }).first();
      if (existingLegacy) throw Object.assign(new Error('Pembayaran lama perlu direkonsiliasi sebelum pelunasan baru dicatat'), { status: 409 });
      const now = new Date();
      const pending = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, gateway: 'midtrans', status: 'pending' }).forUpdate().first();
      if (pending && (!pending.expires_at || new Date(pending.expires_at) > now)) {
        throw Object.assign(new Error('Ada transaksi online aktif. Tunggu kedaluwarsa atau batalkan transaksi Midtrans sebelum menerima pembayaran offline.'), { status: 409 });
      }
      if (pending) await trx('payments').where({ id: pending.id, tenant_id: tenantId }).update({ status: 'expired', gateway_status: 'expire', updated_at: trx.fn.now() });

      const [payment] = await trx('payments').insert({
        tenant_id: tenantId, invoice_id: invoice.id, received_by: req.user?.user_id,
        method, amount: Number(invoice.total), status: 'paid', paid_at: now,
        reference_no: String(reference_no ?? '').trim() || null, proof_url: proofUrl,
        gateway: null, idempotency_key: idempotencyKey, is_full_settlement: true,
        cash_received: method === 'cash' ? received : null,
        change_amount: method === 'cash' ? changeAmount : null,
      }).returning('*');
      await trx('invoices').where({ id: invoice.id, tenant_id: tenantId }).update({ status: 'paid', updated_at: trx.fn.now() });
      await promoteTicketToPickup(trx, req, ticket);
      await logAudit(trx, req, {
        action: 'payment.created', entityType: 'payment', entityId: payment.id, ticketId: ticket.id,
        newValues: { invoice_no: invoice.invoice_no, method, amount: Number(payment.amount), reference_no: payment.reference_no, change_amount: payment.change_amount },
      });
      await logAudit(trx, req, {
        action: 'payment.paid', entityType: 'invoice', entityId: invoice.id, ticketId: ticket.id,
        oldValues: { status: invoice.status }, newValues: { status: 'paid', method },
      });
      await logAudit(trx, req, {
        action: 'invoice.paid', entityType: 'invoice', entityId: invoice.id, ticketId: ticket.id,
        oldValues: { status: invoice.status }, newValues: { status: 'paid', payment_id: payment.id },
      });
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id: tenantId }).select('phone_wa').first();
      return { payment, invoice, ticket, phone: customer?.phone_wa ?? '', replay: false };
    });

    if (result.replay) {
      if (proofUrl) await unlink(path.resolve(process.env.UPLOAD_DIR || 'uploads', proofUrl.replace(/^\/uploads\//, ''))).catch(() => undefined);
      return res.json({ data: result.payment, replayed: true });
    }
    await notifyPaid({
      tenantId, customerId: result.ticket.customer_id, phone: result.phone,
      ticketId: result.ticket.id, paymentId: result.payment.id,
      invoiceNo: result.invoice.invoice_no, trackingCode: result.ticket.tracking_code,
      amount: Number(result.payment.amount),
    });
    return res.status(201).json({ data: result.payment, invoice_status: 'paid' });
  } catch (error: any) {
    if (proofUrl) await unlink(path.resolve(process.env.UPLOAD_DIR || 'uploads', proofUrl.replace(/^\/uploads\//, ''))).catch(() => undefined);
    const status = error.status || (['Metode pembayaran offline tidak valid', 'Nominal harus sama dengan total invoice', 'Nomor referensi wajib diisi untuk metode ini', 'Uang diterima harus minimal sama dengan total invoice'].includes(error.message) ? 400 : 500);
    return res.status(status).json({ error: error.message || 'Gagal mencatat pembayaran' });
  }
});

paymentRouter.post('/:invoiceId/online-link', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const settings = midtransSettings();
    if (!settings) return res.status(503).json({ error: 'Midtrans belum dikonfigurasi di backend' });
    const idempotencyKey = String(req.get('Idempotency-Key') ?? req.body?.idempotency_key ?? '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) return res.status(400).json({ error: 'Idempotency-Key wajib diisi' });

    const created = await withTenantContext(tenantId, async (trx) => {
      const invoice = await trx('invoices').where({ id: req.params.invoiceId, tenant_id: tenantId }).forUpdate().first();
      if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      if (invoice.status !== 'unpaid') throw Object.assign(new Error('Invoice harus Belum bayar untuk membuat tautan'), { status: 409 });
      const prior = await trx('payments').where({ tenant_id: tenantId, idempotency_key: idempotencyKey }).first();
      if (prior) {
        if (prior.invoice_id !== invoice.id || prior.gateway !== 'midtrans') throw Object.assign(new Error('Idempotency-Key sudah digunakan untuk transaksi lain'), { status: 409 });
        const existingTicket = await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id: tenantId, branch_id: req.user?.branch_id }).first();
        return { payment: prior, invoice, ticket: existingTicket, create: false };
      }
      const ticket = await trx('service_tickets as t').join('customers as c', 'c.id', 't.customer_id')
        .where({ 't.id': invoice.ticket_id, 't.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
        .select('t.*', 'c.name as customer_name', 'c.phone_wa as customer_phone').first();
      if (!ticket) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      const paid = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, status: 'paid' }).first();
      if (paid) throw Object.assign(new Error('Pembayaran lama perlu direkonsiliasi sebelum membuat tautan baru'), { status: 409 });
      const now = new Date();
      const current = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, gateway: 'midtrans', status: 'pending' }).forUpdate().first();
      if (current && (!current.expires_at || new Date(current.expires_at) > now)) {
        return { payment: current, invoice, ticket, create: false };
      }
      if (current) await trx('payments').where({ id: current.id, tenant_id: tenantId }).update({ status: 'expired', gateway_status: 'expire', updated_at: trx.fn.now() });
      const orderId = newMidtransOrderId(tenantId);
      const [payment] = await trx('payments').insert({
        tenant_id: tenantId, invoice_id: invoice.id, received_by: req.user?.user_id,
        method: 'midtrans', amount: Number(invoice.total), status: 'pending', gateway: 'midtrans',
        order_id: orderId, gateway_status: 'pending', idempotency_key: idempotencyKey,
        is_full_settlement: true, expires_at: new Date(now.getTime() + 35 * 60_000),
      }).returning('*');
      await logAudit(trx, req, {
        action: 'payment.online_created', entityType: 'payment', entityId: payment.id, ticketId: ticket.id,
        newValues: { invoice_no: invoice.invoice_no, order_id: orderId, amount: Number(invoice.total), gateway: 'midtrans' },
      });
      return { payment, invoice, ticket, create: true };
    });

    if (created.payment.snap_url) {
      const notification = await sendInvoiceMessage(req, created.invoice.id);
      return res.json({ data: created.payment, notification });
    }
    if (!created.create) return res.status(409).json({ error: 'Transaksi online untuk invoice ini sedang dibuat atau masih aktif; gunakan tautan yang sudah ada.', data: created.payment });

    const lines = Array.isArray(created.invoice.line_items)
      ? created.invoice.line_items
      : JSON.parse(String(created.invoice.line_items ?? '[]'));
    const items = lines.map((line: any, index: number) => ({
      id: `item-${index + 1}`,
      name: String(line.name ?? 'Servis').slice(0, 50),
      price: Math.round(Number(line.unit_price ?? line.total)),
      quantity: Math.max(1, Math.round(Number(line.quantity ?? 1))),
    })).filter((line: any) => line.price > 0);
    const gateway = getPaymentGateway();
    let transaction;
    try {
      transaction = await gateway.createTransaction({
        orderId: created.payment.order_id,
        amount: Number(created.invoice.total),
        items,
        customer: { name: created.ticket.customer_name ?? '', phone: created.ticket.customer_phone ?? null },
      });
    } catch (error) {
      const definitive = (error as any)?.definitive === true;
      await withTenantContext(tenantId, async (trx) => {
        await trx('payments').where({ id: created.payment.id, tenant_id: tenantId, status: 'pending' }).update({
          ...(definitive ? { status: 'failed' } : {}),
          gateway_status: definitive ? 'create_failed' : 'creation_unknown', updated_at: trx.fn.now(),
        });
        await trx('audit_logs').insert({ tenant_id: tenantId, user_id: req.user?.user_id, action: definitive ? 'payment.online_creation_failed' : 'payment.online_creation_unknown', entity_type: 'payment', entity_id: created.payment.id, ticket_id: created.ticket.id, actor_type: 'user', new_values: { order_id: created.payment.order_id }, note: (error as Error).message });
      });
      if (!definitive) throw Object.assign(new Error('Status Midtrans belum dapat dipastikan. Transaksi dijaga aktif untuk mencegah pembayaran ganda; cek kembali atau tunggu kedaluwarsa.'), { status: 502 });
      throw error;
    }
    const saved = await withTenantContext(tenantId, async (trx) => {
      const [payment] = await trx('payments').where({ id: created.payment.id, tenant_id: tenantId, status: 'pending' })
        .update({ snap_token: transaction.token, snap_url: transaction.redirectUrl, expires_at: transaction.expiresAt, updated_at: trx.fn.now() }).returning('*');
      return payment;
    });
    if (!saved) return res.status(409).json({ error: 'Status transaksi online berubah sebelum tautan tersimpan' });
    const notification = await sendInvoiceMessage(req, created.invoice.id);
    return res.status(201).json({ data: saved, notification });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal membuat tautan pembayaran Midtrans' });
  }
});

paymentRouter.post('/:invoiceId/send-info', async (req: AuthRequest, res: Response) => {
  try {
    const result = await sendInvoiceMessage(req, req.params.invoiceId);
    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengirim info pembayaran' });
  }
});

paymentRouter.post('/:invoiceId/handover', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const result = await withTenantContext(tenantId, async (trx) => {
      const invoice = await trx('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id')
        .where({ 'i.id': req.params.invoiceId, 'i.tenant_id': tenantId, 't.branch_id': req.user?.branch_id })
        .select('i.id as invoice_id', 'i.invoice_no', 'i.status as invoice_status', 't.id as ticket_id', 't.ticket_code', 't.handed_over_at')
        .forUpdate().first();
      if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      if (invoice.invoice_status !== 'paid') throw Object.assign(new Error('Perangkat hanya dapat diserahkan setelah invoice Lunas'), { status: 409 });
      if (invoice.handed_over_at) throw Object.assign(new Error('Perangkat sudah tercatat diserahkan'), { status: 409 });
      const handedOverAt = new Date();
      await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id: tenantId }).update({ handed_over_by: req.user?.user_id, handed_over_at: handedOverAt, updated_at: trx.fn.now() });
      await logAudit(trx, req, {
        action: 'ticket.handed_over', entityType: 'service_ticket', entityId: invoice.ticket_id,
        newValues: { invoice_no: invoice.invoice_no, handed_over_by: req.user?.user_id, handed_over_at: handedOverAt.toISOString() },
      });
      return { handed_over_by: req.user?.user_id, handed_over_at: handedOverAt };
    });
    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mencatat serah terima' });
  }
});

paymentRouter.post('/:invoiceId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason || reason.length > 500) return res.status(400).json({ error: 'Alasan pembatalan wajib diisi (maksimal 500 karakter)' });
    const tenantId = req.user!.tenant_id;
    await withTenantContext(tenantId, async (trx) => {
      const invoice = await trx('invoices').where({ id: req.params.invoiceId, tenant_id: tenantId }).forUpdate().first();
      if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      const ticket = await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id: tenantId, branch_id: req.user?.branch_id }).first();
      if (!ticket) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      if (invoice.status !== 'unpaid') throw Object.assign(new Error('Hanya invoice Belum bayar yang dapat dibatalkan; invoice Lunas harus direfund'), { status: 409 });
      const payments = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id });
      if (payments.some((payment: any) => payment.status === 'paid' || (payment.gateway === 'midtrans' && payment.status === 'pending' && (!payment.expires_at || new Date(payment.expires_at) > new Date())))) {
        throw Object.assign(new Error('Selesaikan atau batalkan transaksi pembayaran aktif sebelum membatalkan invoice'), { status: 409 });
      }
      await trx('invoices').where({ id: invoice.id, tenant_id: tenantId }).update({ status: 'cancelled', updated_at: trx.fn.now() });
      await logAudit(trx, req, {
        action: 'invoice.voided', entityType: 'invoice', entityId: invoice.id, ticketId: invoice.ticket_id,
        oldValues: { status: invoice.status }, newValues: { status: 'cancelled', reason }, note: reason,
      });
    });
    return res.json({ data: { status: 'cancelled', reason } });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal membatalkan invoice' });
  }
});

paymentRouter.post('/:invoiceId/refund', async (req: AuthRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason || reason.length > 255) return res.status(400).json({ error: 'Alasan refund wajib diisi (maksimal 255 karakter)' });
    const tenantId = req.user!.tenant_id;
    const payment = await withTenantContext(tenantId, async (trx) => {
      const invoice = await trx('invoices').where({ id: req.params.invoiceId, tenant_id: tenantId }).forUpdate().first();
      if (!invoice) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      const ticket = await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id: tenantId, branch_id: req.user?.branch_id }).first();
      if (!ticket) throw Object.assign(new Error('Invoice tidak ditemukan'), { status: 404 });
      if (invoice.status === 'unpaid') {
        const legacyPayments = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, status: 'paid', is_full_settlement: false }).forUpdate();
        if (legacyPayments.length) {
          const amount = legacyPayments.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
          if (amount >= Number(invoice.total)) throw Object.assign(new Error('Pembayaran lama sudah menutup total invoice; perlu rekonsiliasi sebelum koreksi'), { status: 409 });
          if (req.body?.external_refund_confirmed !== true) throw Object.assign(new Error('Konfirmasi pengembalian dana historis sebelum menyelesaikan rekonsiliasi'), { status: 409 });
          const reason = String(req.body?.reason ?? '').trim();
          const referenceNo = String(req.body?.refund_reference ?? '').trim() || null;
          await trx('payments').whereIn('id', legacyPayments.map((item: any) => item.id)).where({ tenant_id: tenantId }).update({
            status: 'refunded', refund_reason: reason, refund_reference: referenceNo, refunded_at: new Date(), updated_at: trx.fn.now(),
          });
          await logAudit(trx, req, {
            action: 'payment.refunded', entityType: 'invoice', entityId: invoice.id, ticketId: invoice.ticket_id,
            oldValues: { status: invoice.status, historical_paid_amount: amount },
            newValues: { status: 'unpaid', refunded_amount: amount, reason, reference_no: referenceNo }, note: reason,
          });
          return { invoice, payment: null, gateway: false, legacy: true };
        }
      }
      if (invoice.status !== 'paid') throw Object.assign(new Error('Hanya invoice Lunas yang dapat direfund'), { status: 409 });
      const settled = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, is_full_settlement: true })
        .whereIn('status', ['paid', 'refunding']).forUpdate().first();
      if (!settled) {
        const historical = await trx('payments').where({ tenant_id: tenantId, invoice_id: invoice.id, status: 'paid', is_full_settlement: false }).forUpdate();
        const historicalAmount = historical.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        if (!historical.length || historicalAmount < Number(invoice.total)) throw Object.assign(new Error('Pembayaran penuh tidak ditemukan atau pembayaran lama belum menutup invoice'), { status: 409 });
        if (req.body?.external_refund_confirmed !== true) throw Object.assign(new Error('Konfirmasi pengembalian dana historis sebelum menyelesaikan refund'), { status: 409 });
        const referenceNo = String(req.body?.refund_reference ?? '').trim() || null;
        await trx('payments').whereIn('id', historical.map((item: any) => item.id)).where({ tenant_id: tenantId }).update({
          status: 'refunded', refund_reason: reason, refund_reference: referenceNo, refunded_at: new Date(), updated_at: trx.fn.now(),
        });
        await trx('invoices').where({ id: invoice.id, tenant_id: tenantId }).update({ status: 'cancelled', updated_at: trx.fn.now() });
        await logAudit(trx, req, {
          action: 'payment.refunded', entityType: 'invoice', entityId: invoice.id, ticketId: invoice.ticket_id,
          oldValues: { status: invoice.status, historical_paid_amount: historicalAmount },
          newValues: { status: 'cancelled', refunded_amount: historicalAmount, reason, reference_no: referenceNo }, note: reason,
        });
        return { invoice, payment: null, gateway: false, legacy: true };
      }
      const autoRefundTypes = new Set(['credit_card', 'gopay', 'qris', 'shopeepay', 'akulaku']);
      const autoRefund = settled.gateway === 'midtrans' && settled.gateway_status === 'settlement' && autoRefundTypes.has(settled.gateway_payment_type);
      if (settled.gateway === 'midtrans' && !autoRefund && req.body?.external_refund_confirmed !== true) {
        throw Object.assign(new Error('Metode ini perlu direfund melalui dashboard Midtrans atau transfer manual terlebih dahulu; konfirmasi setelah dana dikembalikan.'), { status: 409 });
      }
      if (autoRefund) {
        if (!settled.order_id) throw Object.assign(new Error('Order ID Midtrans tidak ditemukan'), { status: 409 });
        const [refunding] = settled.status === 'refunding'
          ? [settled]
          : await trx('payments').where({ id: settled.id, tenant_id: tenantId }).update({ status: 'refunding', refund_reason: reason, updated_at: trx.fn.now() }).returning('*');
        return { invoice, payment: refunding, gateway: true };
      }
      const [refunded] = await trx('payments').where({ id: settled.id, tenant_id: tenantId }).update({ status: 'refunded', refund_reason: reason, refund_reference: String(req.body?.refund_reference ?? '').trim() || null, refunded_at: new Date(), updated_at: trx.fn.now() }).returning('*');
      await trx('invoices').where({ id: invoice.id, tenant_id: tenantId }).update({ status: 'cancelled', updated_at: trx.fn.now() });
      await logAudit(trx, req, { action: 'payment.refunded', entityType: 'payment', entityId: settled.id, newValues: { reason, amount: Number(settled.amount), gateway: null } });
      return { invoice, payment: refunded, gateway: false, legacy: false };
    });

    if (payment.legacy) return res.json({ data: { status: 'refunded', invoice_status: payment.invoice.status === 'unpaid' ? 'unpaid' : 'cancelled', reason } });
    if (payment.gateway) {
      try {
        await getPaymentGateway().refund({ orderId: payment.payment.order_id, transactionId: payment.payment.gateway_transaction_id, refundKey: `refund-${payment.payment.id}`, amount: Number(payment.payment.amount), reason });
      } catch (error) {
        await withTenantContext(tenantId, async (trx) => {
          await trx('payments').where({ id: payment.payment.id, tenant_id: tenantId, status: 'refunding' }).update({ status: 'paid', updated_at: trx.fn.now() });
          await trx('audit_logs').insert({ tenant_id: tenantId, user_id: req.user?.user_id, action: 'payment.refund_failed', entity_type: 'payment', entity_id: payment.payment.id, actor_type: 'user', new_values: { reason }, note: (error as Error).message });
        });
        throw error;
      }
      await withTenantContext(tenantId, async (trx) => {
        await trx('payments').where({ id: payment.payment.id, tenant_id: tenantId, status: 'refunding' }).update({ status: 'refunded', refund_reference: `refund-${payment.payment.id}`, refunded_at: new Date(), updated_at: trx.fn.now() });
        await trx('invoices').where({ id: payment.invoice.id, tenant_id: tenantId }).update({ status: 'cancelled', updated_at: trx.fn.now() });
        await logAudit(trx, req, { action: 'payment.refunded', entityType: 'payment', entityId: payment.payment.id, newValues: { reason, amount: Number(payment.payment.amount), gateway: 'midtrans' } });
      });
    }
    return res.json({ data: { status: 'refunded', invoice_status: 'cancelled', reason } });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal memproses refund' });
  }
});
