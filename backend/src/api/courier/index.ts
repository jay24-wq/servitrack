import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { authMiddleware, AuthRequest, branchResolver, withTenantContext, requireRole } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { notifyCourierEvent } from '@services/notifications/events';

export const courierRouter = Router();
courierRouter.use(authMiddleware, tenantResolver, branchResolver);

const failureStatuses = new Set(['PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE']);
const gpsStatuses = new Set(['MENUJU_LOKASI', 'TIBA_DI_LOKASI', 'PERANGKAT_DIJEMPUT', 'MENUJU_CUSTOMER', 'SAMPAI_DI_LOKASI', 'PERANGKAT_DISERAHKAN']);
const allowedTransitions: Record<string, string[]> = {
  MENUNGGU_PICKUP: ['MENUJU_LOKASI', ...Array.from(failureStatuses)], KURIR_DITUGASKAN: ['MENUJU_LOKASI', ...Array.from(failureStatuses)],
  MENUJU_LOKASI: ['TIBA_DI_LOKASI', ...Array.from(failureStatuses)], TIBA_DI_LOKASI: ['PERANGKAT_DIJEMPUT', ...Array.from(failureStatuses)],
  PERANGKAT_DIJEMPUT: ['MENUNGGU_CHECK_IN', ...Array.from(failureStatuses)], SIAP_DIANTAR: ['MENUJU_CUSTOMER', ...Array.from(failureStatuses)],
  MENUJU_CUSTOMER: ['SAMPAI_DI_LOKASI', ...Array.from(failureStatuses)], SAMPAI_DI_LOKASI: ['PERANGKAT_DISERAHKAN', ...Array.from(failureStatuses)],
  PERANGKAT_DISERAHKAN: ['SELESAI', ...Array.from(failureStatuses)],
};
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 8 * 1024 * 1024 } });

function scope(req: AuthRequest) {
  const user = req.user!;
  return { tenant_id: user.tenant_id, branch_id: user.branch_id, courier_id: user.user_id };
}

function errorResponse(res: Response, error: any) {
  const status = error?.status ?? (error?.code === '23514' ? 400 : 500);
  res.status(status).json({ error: error?.message || 'Gagal memproses tugas kurir' });
}

const assignmentSelect = (query: any) => query('courier_assignments as ca')
  .join('users as cu', 'cu.id', 'ca.courier_id')
  .leftJoin('bookings as b', 'b.id', 'ca.booking_id')
  .leftJoin('service_tickets as t', 't.id', 'ca.ticket_id')
  .leftJoin('customers as cb', 'cb.id', 'b.customer_id')
  .leftJoin('customers as ct', 'ct.id', 't.customer_id')
  .leftJoin('devices as db', 'db.id', 'b.device_id')
  .leftJoin('devices as dt', 'dt.id', 't.device_id')
  .leftJoin('booking_slots as bs', 'bs.id', 'b.slot_id')
  .leftJoin('invoices as i', 'i.ticket_id', 't.id')
  .select('ca.*', 'cu.name as courier_name', 'b.booking_code', 'b.tracking_code as booking_tracking_code', 'b.customer_phone as booking_customer_phone_snapshot', 'b.pickup_address', 'b.pickup_latitude', 'b.pickup_longitude', 'b.pickup_time', 'bs.slot_date', 'b.created_at as booking_created_at', 't.ticket_code', 't.tracking_token', 't.current_status as service_status', 't.created_at as ticket_created_at', 'i.status as invoice_status', 'cb.name as booking_customer_name', 'ct.name as ticket_customer_name')
  .select(query.raw("COALESCE(db.model, dt.model) as device_model"), query.raw("COALESCE(db.serial_number, dt.serial_number) as device_serial"), query.raw("COALESCE(bs.slot_date, t.created_at::date) as schedule_date"), query.raw("COALESCE(b.pickup_time, to_char(t.created_at AT TIME ZONE 'Asia/Makassar', 'HH24:MI')) as schedule_time"))
  .select(query.raw("COALESCE(cb.name, ct.name) as customer_name"), query.raw("COALESCE(b.tracking_code, t.tracking_token) as tracking_code"));

// Courier can only read its own branch assignments. Never trust courier_id from query/body.
courierRouter.get('/dashboard', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const s = scope(req);
    const rows = await assignmentSelect(query).where({ 'ca.tenant_id': s.tenant_id, 'ca.branch_id': s.branch_id, 'ca.courier_id': s.courier_id }).orderBy('ca.assigned_at', 'asc');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const active = rows.filter((row: any) => !['SELESAI', 'PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE'].includes(row.status));
    const todayRows = rows.filter((row: any) => new Date(row.assigned_at) >= today);
    const count = (type: string, predicate = (_row: any) => true) => todayRows.filter((row: any) => row.assignment_type === type && predicate(row)).length;
    res.json({ data: { stats: { pickup_hari_ini: count('pickup'), delivery_hari_ini: count('delivery'), dalam_perjalanan: active.filter((r: any) => ['MENUJU_LOKASI', 'MENUJU_CUSTOMER'].includes(r.status)).length, selesai_hari_ini: count('pickup', (r) => r.status === 'SELESAI') + count('delivery', (r) => r.status === 'SELESAI'), pickup_gagal: count('pickup', (r) => failureStatuses.has(r.status)), delivery_gagal: count('delivery', (r) => failureStatuses.has(r.status)) }, active, schedule: todayRows } });
  } catch (error) { errorResponse(res, error); }
});

// Admin/frontdesk queue: these records are recommendations only and are not assignments yet.
courierRouter.get('/queue', requireRole('admin', 'frontdesk'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const tenant_id = req.user!.tenant_id; const branch_id = req.user!.branch_id;
    const pickups = await query('bookings as b').join('customers as c', 'c.id', 'b.customer_id').where({ 'b.tenant_id': tenant_id, 'b.branch_id': branch_id }).whereIn('b.service_method', ['pickup_only', 'pickup_delivery']).whereNotIn('b.status', ['cancelled', 'no_show']).whereNotExists(query('courier_assignments as ca').select(query.raw('1')).whereRaw('ca.booking_id = b.id').where('ca.tenant_id', tenant_id)).select('b.id', 'b.booking_code as reference', 'b.customer_id', 'c.name as customer_name', 'c.phone_wa as customer_phone', 'b.pickup_address as address', 'b.pickup_latitude as latitude', 'b.pickup_longitude as longitude', 'b.created_at', query.raw("'pickup' as assignment_type"));
    const deliveries = await query('service_tickets as t').join('customers as c', 'c.id', 't.customer_id').where({ 't.tenant_id': tenant_id, 't.branch_id': branch_id }).whereIn('t.current_status', ['siap_diambil', 'siap_diantar']).whereNotExists(query('courier_assignments as ca').select(query.raw('1')).whereRaw('ca.ticket_id = t.id').where('ca.tenant_id', tenant_id)).select('t.id', 't.ticket_code as reference', 't.customer_id', 'c.name as customer_name', 'c.phone_wa as customer_phone', query.raw('NULL as address'), query.raw('NULL as latitude'), query.raw('NULL as longitude'), 't.created_at', query.raw("'delivery' as assignment_type"));
    res.json({ data: [...pickups, ...deliveries].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) });
  } catch (error) { errorResponse(res, error); }
});

courierRouter.get('/queue/:type/:id/recommendations', requireRole('admin', 'frontdesk'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const tenant_id = req.user!.tenant_id; const branch_id = req.user!.branch_id;
    if (!['pickup', 'delivery'].includes(req.params.type)) return res.status(400).json({ error: 'Tipe assignment tidak valid' });
    const link = req.params.type === 'pickup' ? { 'b.id': req.params.id } : { 't.id': req.params.id };
    const source = req.params.type === 'pickup' ? query('bookings as b').where({ 'b.tenant_id': tenant_id, 'b.branch_id': branch_id }).where(link).first() : query('service_tickets as t').where({ 't.tenant_id': tenant_id, 't.branch_id': branch_id }).where(link).first();
    if (!(await source)) return res.status(404).json({ error: 'Tugas belum tersedia untuk assignment' });
    const activeStatuses = ['SELESAI', 'PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE'];
    const candidates = await query('users as u').join('roles as r', 'r.id', 'u.role_id').where({ 'u.tenant_id': tenant_id, 'u.branch_id': branch_id, 'u.is_active': true, 'r.code': 'kurir', 'u.courier_status': 'ONLINE' }).whereNull('u.deleted_at').select('u.id', 'u.name', 'u.courier_status').select(query.raw('(SELECT count(*) FROM courier_assignments ca WHERE ca.courier_id = u.id AND ca.tenant_id = ? AND ca.branch_id = ? AND ca.status NOT IN (?, ?, ?, ?, ?, ?, ?)) as active_tasks', [tenant_id!, branch_id!, ...activeStatuses])).orderBy('active_tasks', 'asc').orderBy('u.name', 'asc');
    return res.json({ data: candidates.map((candidate: any, index: number) => ({ ...candidate, active_tasks: Number(candidate.active_tasks), recommended: index === 0, reason: `cabang sama, aktif, beban kerja ${Number(candidate.active_tasks)} tugas` })) });
  } catch (error) { return errorResponse(res, error); }
});

courierRouter.patch('/availability', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['ONLINE', 'OFFLINE'].includes(status)) return res.status(400).json({ error: 'Status availability tidak valid' });
    const user = req.user!;
    await reqDb(req)('users').where({ id: user.user_id, tenant_id: user.tenant_id, branch_id: user.branch_id }).update({ courier_status: status, updated_at: reqDb(req).fn.now() });
    return res.json({ data: { status } });
  } catch (error) { return errorResponse(res, error); }
});

courierRouter.get('/assignments', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const s = scope(req);
    const rows = await assignmentSelect(query).where({ 'ca.tenant_id': s.tenant_id, 'ca.branch_id': s.branch_id, 'ca.courier_id': s.courier_id }).modify((builder: any) => { if (req.query.type) builder.where('ca.assignment_type', req.query.type); }).orderBy('ca.assigned_at', 'desc');
    res.json({ data: rows });
  } catch (error) { errorResponse(res, error); }
});

courierRouter.get('/assignments/:id', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const s = scope(req); const query = reqDb(req);
    const row = await assignmentSelect(query).where({ 'ca.id': req.params.id, 'ca.tenant_id': s.tenant_id, 'ca.branch_id': s.branch_id, 'ca.courier_id': s.courier_id }).first();
    if (!row) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
    const [locations, proofs] = await Promise.all([query('courier_location_events').where({ tenant_id: s.tenant_id, assignment_id: row.id }).orderBy('recorded_at', 'asc'), query('courier_proofs').where({ tenant_id: s.tenant_id, assignment_id: row.id }).orderBy('created_at', 'desc')]);
    return res.json({ data: { ...row, locations, proofs } });
  } catch (error) { return errorResponse(res, error); }
});

courierRouter.patch('/assignments/:id/status', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, latitude, longitude, failure_reason, failure_notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status wajib diisi' });
    if (failureStatuses.has(status) && (!failure_reason || !String(failure_notes || '').trim())) return res.status(400).json({ error: 'failure_reason dan failure_notes wajib diisi untuk status gagal' });
    if (gpsStatuses.has(status) && (latitude === undefined || longitude === undefined)) return res.status(400).json({ error: 'latitude dan longitude wajib diisi untuk status ini' });
    const s = scope(req);
    const result = await withTenantContext(s.tenant_id, async (trx) => {
      const assignment = await trx('courier_assignments').where({ id: req.params.id, ...s }).forUpdate().first();
      if (!assignment) throw Object.assign(new Error('Tugas tidak ditemukan'), { status: 404 });
      if (!allowedTransitions[assignment.status]?.includes(status)) throw Object.assign(new Error(`Perubahan status ${assignment.status} ke ${status} tidak diizinkan`), { status: 409 });
      if (assignment.assignment_type === 'delivery' && ['MENUJU_CUSTOMER', 'SAMPAI_DI_LOKASI', 'PERANGKAT_DISERAHKAN', 'SELESAI'].includes(status)) {
        const invoice = await trx('invoices').where({ ticket_id: assignment.ticket_id, tenant_id: s.tenant_id }).where('status', 'paid').first();
        if (!invoice) throw Object.assign(new Error('Perangkat belum dapat diantar karena invoice belum lunas.'), { status: 409 });
      }
      const completed = status === 'SELESAI';
      const [updated] = await trx('courier_assignments').where({ id: assignment.id }).update({ status, started_at: assignment.started_at || new Date(), completed_at: completed ? new Date() : null, failure_reason: failure_reason || null, failure_notes: failure_notes || null, updated_at: trx.fn.now() }).returning('*');
      if (gpsStatuses.has(status)) await trx('courier_location_events').insert({ tenant_id: s.tenant_id, assignment_id: assignment.id, status, latitude, longitude });
      if (completed || failureStatuses.has(status)) {
        const remaining = await trx('courier_assignments').where({ tenant_id: s.tenant_id, branch_id: s.branch_id, courier_id: assignment.courier_id }).whereNotIn('status', ['SELESAI', ...Array.from(failureStatuses)]).count('id as count').first();
        if (Number(remaining?.count || 0) === 0) await trx('users').where({ id: assignment.courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: trx.fn.now() });
      }
      return { assignment: updated, customer: await trx('customers').where({ id: assignment.assignment_type === 'pickup' ? (await trx('bookings').where({ id: assignment.booking_id }).first()).customer_id : (await trx('service_tickets').where({ id: assignment.ticket_id }).first()).customer_id }).first() };
    });
    if (result.customer?.phone_wa) void notifyCourierEvent({ tenantId: s.tenant_id, customerId: result.customer.id, phone: result.customer.phone_wa, trackingCode: result.assignment.booking_id || result.assignment.ticket_id, status });
    return res.json({ message: 'Status tugas diperbarui', data: result.assignment });
  } catch (error) { return errorResponse(res, error); }
});

courierRouter.post('/assignments/:id/proofs', requireRole('kurir'), upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const s = scope(req); const query = reqDb(req);
    const assignment = await query('courier_assignments').where({ id: req.params.id, ...s }).first();
    if (!assignment) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
    const type = req.body.type || assignment.assignment_type;
    const photoUrl = req.file ? `/uploads/${path.basename(req.file.path)}` : req.body.photo_url;
    if (!photoUrl || !['pickup', 'delivery'].includes(type)) return res.status(400).json({ error: 'Foto dan type proof wajib diisi' });
    const [proof] = await query('courier_proofs').insert({ tenant_id: s.tenant_id, assignment_id: assignment.id, type, photo_url: photoUrl, notes: req.body.notes || null, latitude: req.body.latitude || null, longitude: req.body.longitude || null }).returning('*');
    return res.status(201).json({ message: 'Bukti serah terima tersimpan', data: proof });
  } catch (error) { return errorResponse(res, error); }
});

// Assignment and reassignment are administrative actions; history is append-only.
courierRouter.post('/assignments', requireRole('admin', 'frontdesk'), async (req: AuthRequest, res: Response) => {
  try {
    const s = scope(req); const { courier_id, assignment_type, booking_id, ticket_id, assignment_reason } = req.body;
    const status = assignment_type === 'delivery' ? 'SIAP_DIANTAR' : 'KURIR_DITUGASKAN';
    if (!courier_id || !assignment_type || (assignment_type === 'pickup' && (!booking_id || ticket_id)) || (assignment_type === 'delivery' && !ticket_id)) return res.status(400).json({ error: 'Relasi assignment tidak valid' });
    const target = await reqDb(req)('users').join('roles', 'users.role_id', 'roles.id').where({ 'users.id': courier_id, 'users.tenant_id': s.tenant_id, 'users.branch_id': s.branch_id, 'users.is_active': true, 'users.courier_status': 'ONLINE', 'roles.code': 'kurir' }).whereNull('users.deleted_at').first();
    if (!target) return res.status(409).json({ error: 'Kurir harus aktif, online, dan berada di cabang yang sama' });
    const [row] = await reqDb(req)('courier_assignments').insert({ tenant_id: s.tenant_id, branch_id: s.branch_id, courier_id, assignment_type, booking_id: booking_id || null, ticket_id: ticket_id || null, status, assigned_by: req.user!.user_id, assignment_reason: assignment_reason || null }).returning('*');
    await reqDb(req)('users').where({ id: courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: reqDb(req).fn.now() });
    return res.status(201).json({ data: row });
  } catch (error) { return errorResponse(res, error); }
});

courierRouter.post('/assignments/:id/reassign', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const s = scope(req); const { courier_id, reason } = req.body;
    if (!courier_id) return res.status(400).json({ error: 'courier_id wajib diisi' });
    const result = await withTenantContext(s.tenant_id, async (trx) => {
      const current = await trx('courier_assignments').where({ id: req.params.id, tenant_id: s.tenant_id, branch_id: s.branch_id }).forUpdate().first();
      if (!current) throw Object.assign(new Error('Tugas tidak ditemukan'), { status: 404 });
      const target = await trx('users').join('roles', 'users.role_id', 'roles.id').where({ 'users.id': courier_id, 'users.tenant_id': s.tenant_id, 'users.branch_id': s.branch_id, 'users.is_active': true, 'users.courier_status': 'ONLINE', 'roles.code': 'kurir' }).whereNull('users.deleted_at').first();
      if (!target) throw Object.assign(new Error('Kurir tujuan harus aktif, online, dan berada di cabang yang sama'), { status: 409 });
      const [updated] = await trx('courier_assignments').where({ id: current.id }).update({ courier_id, reassigned_by: req.user!.user_id, reassignment_reason: reason || null, updated_at: trx.fn.now() }).returning('*');
      await trx('users').where({ id: courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: trx.fn.now() });
      await trx('courier_assignment_audits').insert({ tenant_id: s.tenant_id, assignment_id: current.id, from_courier_id: current.courier_id, to_courier_id: courier_id, changed_by: s.courier_id, reason: reason || null });
      return updated;
    });
    return res.json({ data: result });
  } catch (error) { return errorResponse(res, error); }
});
