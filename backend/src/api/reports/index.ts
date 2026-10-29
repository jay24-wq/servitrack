import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);
reportsRouter.use(tenantResolver);
reportsRouter.use(branchResolver);

const ACTIVE_STATUSES = ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check'];
const DONE_STATUSES = ['selesai', 'siap_diambil'];
const STATUS_LABELS: Record<string, string> = { antrian: 'Antrian', pengecekan: 'Pengecekan', menunggu_part: 'Menunggu Part', pengerjaan: 'Pengerjaan', quality_check: 'Quality Control', selesai: 'Selesai', siap_diambil: 'Siap Diambil' };
const METHODS = ['cash', 'qris', 'va', 'ewallet'];

function dateRange(query: any) {
  const from = query.from ? new Date(String(query.from)) : new Date(Date.now() - 30 * 86400000);
  const to = query.to ? new Date(`${String(query.to).slice(0, 10)}T23:59:59.999Z`) : new Date();
  return { from, to, length: Math.max(to.getTime() - from.getTime(), 86400000) };
}

function applyBranch(query: any, branch_id: string | undefined, column: string) {
  if (branch_id && branch_id !== 'Semua cabang') query.where(column, branch_id);
}

async function dashboardData(req: AuthRequest, from: Date, to: Date, branch_id?: string, granularity = 'harian') {
  const tenant_id = req.user!.tenant_id;
  branch_id = req.user!.branch_id;
  const db = reqDb(req);
  const previousFrom = new Date(from.getTime() - Math.max(to.getTime() - from.getTime(), 86400000));
  const previousTo = new Date(from.getTime() - 1);
  const paymentSum = async (start: Date, end: Date) => {
    const q = db('payments').where({ 'payments.tenant_id': tenant_id, 'payments.status': 'paid' }).whereBetween('payments.paid_at', [start, end]);
    applyBranch(q, branch_id, 'invoices.branch_id');
    const row = await q.join('invoices', 'payments.invoice_id', 'invoices.id').sum('payments.amount as total').first();
    return Number(row?.total || 0);
  };
  const invoiceSum = async (start: Date, end: Date) => {
    const q = db('invoices').where({ 'invoices.tenant_id': tenant_id }).whereIn('invoices.status', ['unpaid', 'partial']).whereBetween('invoices.issued_at', [start, end]);
    applyBranch(q, branch_id, 'service_tickets.branch_id');
    const row = await q.join('service_tickets', 'invoices.ticket_id', 'service_tickets.id').sum('invoices.total as total').count('invoices.id as count').first();
    return { total: Number(row?.total || 0), count: Number(row?.count || 0) };
  };
  const ticketCount = async (statuses: string[], start: Date, end: Date) => {
    const q = db('service_tickets').where({ tenant_id }).whereIn('current_status', statuses).whereBetween('created_at', [start, end]);
    applyBranch(q, branch_id, 'branch_id');
    const row = await q.count('id as count').first();
    return Number(row?.count || 0);
  };
  const [revenue, previousRevenue, receivable, previousReceivable, active, previousActive, done, previousDone] = await Promise.all([
    paymentSum(from, to), paymentSum(previousFrom, previousTo), invoiceSum(from, to), invoiceSum(previousFrom, previousTo), ticketCount(ACTIVE_STATUSES, from, to), ticketCount(ACTIVE_STATUSES, previousFrom, previousTo), ticketCount(DONE_STATUSES, from, to), ticketCount(DONE_STATUSES, previousFrom, previousTo),
  ]);

  const paidCountQuery = db('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'p.tenant_id': tenant_id, 'p.status': 'paid', 't.branch_id': branch_id }).whereBetween('p.paid_at', [from, to]);
  const paidCountRow = await paidCountQuery.count('id as count').first();
  const trend = await db('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'p.tenant_id': tenant_id, 'p.status': 'paid', 't.branch_id': branch_id }).whereBetween('p.paid_at', [from, to]).select(db.raw(`date_trunc(?, p.paid_at) as bucket`, [granularity === 'mingguan' ? 'week' : granularity === 'bulanan' ? 'month' : 'day'])).sum('p.amount as total').groupBy('bucket').orderBy('bucket');
  const previousTrend = await db('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'p.tenant_id': tenant_id, 'p.status': 'paid', 't.branch_id': branch_id }).whereBetween('p.paid_at', [previousFrom, previousTo]).select(db.raw(`date_trunc(?, p.paid_at) as bucket`, [granularity === 'mingguan' ? 'week' : granularity === 'bulanan' ? 'month' : 'day'])).sum('p.amount as total').groupBy('bucket').orderBy('bucket');
  const previousByKey = Object.fromEntries(previousTrend.map((row: any) => [new Date(row.bucket).toISOString().slice(0, granularity === 'bulanan' ? 7 : 10), Number(row.total || 0)]));
  const series = trend.map((row: any) => { const key = new Date(row.bucket).toISOString().slice(0, granularity === 'bulanan' ? 7 : 10); return { label: new Intl.DateTimeFormat('id-ID', { month: 'short', day: granularity === 'bulanan' ? undefined : 'numeric' }).format(new Date(row.bucket)), omzet: Number(row.total || 0) / 1000000, sebelumnya: (previousByKey[key] || 0) / 1000000 }; });
  const methodRows = await db('payments as p').join('invoices as i', 'i.id', 'p.invoice_id').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'p.tenant_id': tenant_id, 'p.status': 'paid', 't.branch_id': branch_id }).whereBetween('p.paid_at', [from, to]).select('p.method').sum('p.amount as total').groupBy('p.method');
  const methodTotals = METHODS.map((method) => ({ method, total: Number(methodRows.find((row: any) => row.method === method)?.total || 0) }));
  const statusRows = await db('service_tickets').where({ tenant_id, branch_id }).whereBetween('created_at', [from, to]).select('current_status as status').count('id as count').groupBy('current_status');
  const statusCounts = [...Object.keys(STATUS_LABELS)].map((status) => ({ status: STATUS_LABELS[status], count: Number(statusRows.find((row: any) => row.status === status)?.count || 0) }));
  const topParts = await db('ticket_part_usages as u').join('parts as p', 'u.part_id', 'p.id').join('service_tickets as t', 'u.ticket_id', 't.id').where('u.tenant_id', tenant_id).whereBetween('u.created_at', [from, to]).select('p.name').sum('u.qty as qty').sum(db.raw('u.qty * u.unit_price as value')).groupBy('p.id', 'p.name').orderBy('qty', 'desc').limit(5);
  const techRows = await db('users as u').leftJoin('service_tickets as t', function () { this.on('t.technician_id', '=', 'u.id').andOn('t.tenant_id', '=', db.raw('?', [tenant_id])).andOn('t.current_status', '=', db.raw('?', ['selesai'])).andOn('t.created_at', '>=', db.raw('?', [from])).andOn('t.created_at', '<=', db.raw('?', [to])); }).join('roles as r', 'u.role_id', 'r.id').where({ 'u.tenant_id': tenant_id, 'u.is_active': true, 'r.code': 'teknisi' }).select('u.name as technician').count('t.id as done').select(db.raw('COALESCE(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 60), 0) as avg_turnaround')).groupBy('u.id', 'u.name').orderBy('done', 'desc');
  const techTotals = techRows.map((row: any) => ({ technician: row.technician, done: Number(row.done || 0), avgTurnaround: Number(row.avg_turnaround || 0), slaRate: 0 }));
  const agingRows = await db('invoices as i').join('service_tickets as t', 'i.ticket_id', 't.id').where({ 'i.tenant_id': tenant_id, 't.branch_id': branch_id }).whereIn('i.status', ['unpaid', 'partial']).whereBetween('i.issued_at', [from, to]).select(db.raw(`CASE WHEN now() - i.issued_at <= interval '7 days' THEN '0 – 7 hari' WHEN now() - i.issued_at <= interval '30 days' THEN '8 – 30 hari' ELSE '> 30 hari' END as label`)).count('i.id as count').sum('i.total as total').groupBy('label');
  const aging = [{ label: '0 – 7 hari', tone: 'bg-sky-500' }, { label: '8 – 30 hari', tone: 'bg-amber-500' }, { label: '> 30 hari', tone: 'bg-rose-500' }].map((bucket) => ({ ...bucket, count: Number(agingRows.find((row: any) => row.label === bucket.label)?.count || 0), total: Number(agingRows.find((row: any) => row.label === bucket.label)?.total || 0) }));
  const invoices = await db('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'i.tenant_id': tenant_id, 't.branch_id': branch_id }).whereBetween('i.issued_at', [from, to]).select('i.id', 'i.invoice_no', 'i.total', 'i.status');
  const tickets = await db('service_tickets').where({ tenant_id, branch_id }).whereBetween('created_at', [from, to]).select('id', 'ticket_code', 'final_cost as total', 'current_status as status');
  return { revenue, prevRevenue: previousRevenue, receivable: receivable.total, prevReceivable: previousReceivable.total, active, prevActive: previousActive, done, prevDone: previousDone, paidCount: Number(paidCountRow?.count || 0), unpaidCount: receivable.count, series, methodTotals, statusCounts, topParts: topParts.map((row: any) => ({ name: row.name, qty: Number(row.qty || 0), value: Number(row.value || 0) })), techTotals, aging, invoices, tickets, totalTickets: statusCounts.reduce((sum, row) => sum + row.count, 0) };
}

reportsRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try { const { from, to, length } = dateRange(req.query); return res.json({ data: await dashboardData(req, from, to, req.query.branch_id as string, String(req.query.granularity || 'harian')), range: { from, to, length } }); } catch (error: any) { return res.status(500).json({ error: error.message || 'Gagal mengambil laporan' }); }
});

reportsRouter.get('/audit', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id; if (!tenant_id) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25)); const search = String(req.query.search || '').trim(); const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000); const to = req.query.to ? new Date(`${String(req.query.to).slice(0, 10)}T23:59:59.999Z`) : new Date();
    const base = reqDb(req)('audit_logs as a').leftJoin('users as u', 'a.user_id', 'u.id').where('a.tenant_id', tenant_id).whereBetween('a.created_at', [from, to]).modify((query) => { if (req.query.action && req.query.action !== 'Semua') query.where('a.action', req.query.action); if (req.query.actor && req.query.actor !== 'Semua') query.where('u.name', req.query.actor); if (req.query.entity && req.query.entity !== 'Semua') query.where('a.entity_type', req.query.entity); if (search) query.where((builder) => builder.whereILike('a.action', `%${search}%`).orWhereILike('a.entity_type', `%${search}%`).orWhereRaw('a.entity_id::text ILIKE ?', [`%${search}%`]).orWhereILike('u.name', `%${search}%`)); });
    const count = await base.clone().clearSelect().clearOrder().count('a.id as count').first(); const rows = await base.clone().select('a.id', 'a.created_at', 'a.action', 'a.entity_type', 'a.entity_id', 'a.old_values', 'a.new_values', 'a.ip_address', 'u.name as actor').orderBy('a.created_at', 'desc').limit(limit).offset((page - 1) * limit); const options = await reqDb(req)('audit_logs').where({ tenant_id }).distinct('action', 'entity_type'); const actors = await reqDb(req)('audit_logs as a').leftJoin('users as u', 'a.user_id', 'u.id').where('a.tenant_id', tenant_id).whereNotNull('u.name').distinct('u.name').pluck('u.name'); const actions = await reqDb(req)('audit_logs').where({ tenant_id }).distinct('action').pluck('action');
    const data = rows.map((row: any) => ({ id: row.id, at: new Date(row.created_at).toLocaleString('id-ID'), actor: row.actor || 'Sistem', role: row.actor ? 'Staff' : 'Sistem', action: row.action, actionTone: row.action.includes('delete') || row.action.includes('failed') ? 'rose' : row.action.includes('create') || row.action.includes('paid') ? 'emerald' : 'sky', entity: row.entity_id || '-', entityType: row.entity_type, summary: `${row.action} pada ${row.entity_type}`, before: JSON.stringify(row.old_values || '-'), after: JSON.stringify(row.new_values || '-'), ip: row.ip_address || '-' }));
    return res.json({ data, options, actors, actions, pagination: { page, limit, total: Number(count?.count || 0), totalPages: Math.max(1, Math.ceil(Number(count?.count || 0) / limit)) } });
  } catch (error: any) { return res.status(500).json({ error: error.message || 'Gagal mengambil audit trail' }); }
});

reportsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try { const { from, to } = dateRange(req.query); const report = await dashboardData(req, from, to, req.query.branch_id as string, String(req.query.granularity || 'harian')); return res.json({ data: report }); } catch (error: any) { return res.status(500).json({ error: error.message || 'Gagal export laporan' }); }
});
