import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { authMiddleware, AuthRequest, branchResolver, withTenantContext, requireRole } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { notifyCourierEvent } from '@services/notifications/events';
import { logAudit } from '@services/auditLog';
import { CourierRoutingError, getCourierRoute } from '@services/osrmRouting';
import { resolveCourierDestination } from '@common/utils/courierDestination';
import {
  COURIER_ALLOWED_TRANSITIONS,
  COURIER_FAILURE_STATUSES,
  COURIER_GPS_STATUSES,
  COURIER_TERMINAL_STATUSES,
  isCourierAssignmentComplete,
  isValidCourierFailure,
} from '@services/courierWorkflow';

export const courierRouter = Router();
courierRouter.use(authMiddleware, tenantResolver, branchResolver);

const failureStatuses = new Set<string>(COURIER_FAILURE_STATUSES);
const gpsStatuses = new Set<string>(COURIER_GPS_STATUSES);
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
  .join('users as cu', function (this: any) { this.on('cu.id', '=', 'ca.courier_id').andOn('cu.tenant_id', '=', 'ca.tenant_id').andOn('cu.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('bookings as b', function (this: any) { this.on('b.id', '=', 'ca.booking_id').andOn('b.tenant_id', '=', 'ca.tenant_id').andOn('b.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('service_tickets as t', function (this: any) { this.on('t.id', '=', 'ca.ticket_id').andOn('t.tenant_id', '=', 'ca.tenant_id').andOn('t.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('service_tickets as pt', function (this: any) { this.on('pt.booking_id', '=', 'ca.booking_id').andOn('pt.tenant_id', '=', 'ca.tenant_id').andOn('pt.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('bookings as tb', function (this: any) { this.on('tb.id', '=', 't.booking_id').andOn('tb.tenant_id', '=', 'ca.tenant_id').andOn('tb.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('customers as cb', function (this: any) { this.on('cb.id', '=', 'b.customer_id').andOn('cb.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('customers as ct', function (this: any) { this.on('ct.id', '=', 't.customer_id').andOn('ct.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('branches as br', function (this: any) { this.on('br.id', '=', 'ca.branch_id').andOn('br.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('tenants as tn', 'tn.id', 'ca.tenant_id')
  .leftJoin('devices as db', function (this: any) { this.on('db.id', '=', 'b.device_id').andOn('db.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('devices as dt', function (this: any) { this.on('dt.id', '=', 't.device_id').andOn('dt.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('devices as dp', function (this: any) { this.on('dp.id', '=', 'pt.device_id').andOn('dp.tenant_id', '=', 'ca.tenant_id'); })
  .leftJoin('booking_slots as bs', function (this: any) { this.on('bs.id', '=', 'b.slot_id').andOn('bs.tenant_id', '=', 'ca.tenant_id').andOn('bs.branch_id', '=', 'ca.branch_id'); })
  .leftJoin('invoices as i', function (this: any) { this.on('i.ticket_id', '=', 't.id').andOn('i.tenant_id', '=', 'ca.tenant_id'); })
  .select('ca.*', 'cu.name as courier_name', 'b.booking_code', 'b.tracking_code as booking_tracking_code', 'b.customer_phone as booking_customer_phone_snapshot', 'b.pickup_address', 'b.pickup_latitude', 'b.pickup_longitude', 'b.pickup_time', 'bs.slot_date', 'b.created_at as booking_created_at', 't.tracking_token', 'i.status as invoice_status', 'cb.name as booking_customer_name', 'ct.name as ticket_customer_name', 'br.name as branch_name', 'br.address as branch_address', 'tn.name as tenant_name', 'tn.address as tenant_address', 'tn.latitude as store_latitude', 'tn.longitude as store_longitude')
  .select(
    query.raw('COALESCE(t.ticket_code, pt.ticket_code) as ticket_code'),
    query.raw('COALESCE(t.current_status, pt.current_status) as service_status'),
    query.raw('COALESCE(t.created_at, pt.created_at) as ticket_created_at'),
    query.raw("COALESCE(NULLIF(t.customer_phone_snapshot, ''), NULLIF(b.customer_phone, ''), NULLIF(tb.customer_phone, ''), cb.phone_wa, ct.phone_wa) as customer_phone"),
    query.raw("COALESCE(NULLIF(t.customer_address_snapshot, ''), NULLIF(b.pickup_address, ''), NULLIF(tb.pickup_address, ''), NULLIF(cb.address, ''), NULLIF(ct.address, '')) as customer_address"),
    query.raw('COALESCE(t.customer_latitude, b.pickup_latitude, tb.pickup_latitude) as customer_latitude'),
    query.raw('COALESCE(t.customer_longitude, b.pickup_longitude, tb.pickup_longitude) as customer_longitude'),
    query.raw(`(ca.assignment_type = 'pickup' AND (
      ca.status IN ('PERANGKAT_DIJEMPUT', 'MENUJU_TOKO', 'PERANGKAT_TIBA_DI_WORKSHOP', 'SELESAI')
      OR EXISTS (
        SELECT 1 FROM courier_location_events cle
        WHERE cle.tenant_id = ca.tenant_id AND cle.assignment_id = ca.id AND cle.status = 'PERANGKAT_DIJEMPUT'
      )
    )) as device_picked_up`),
  )
   .select(query.raw("COALESCE(db.model, dt.model, dp.model) as device_model"), query.raw("COALESCE(bs.slot_date, t.created_at::date, pt.created_at::date) as schedule_date"), query.raw("COALESCE(b.pickup_time, to_char(COALESCE(t.created_at, pt.created_at) AT TIME ZONE 'Asia/Makassar', 'HH24:MI')) as schedule_time"))
   .select(query.raw("COALESCE(NULLIF(t.tracking_code, ''), NULLIF(b.tracking_code, ''), NULLIF(pt.tracking_code, ''), NULLIF(tb.tracking_code, '')) as tracking_code"), query.raw("COALESCE(cb.name, ct.name) as customer_name"));

// Courier can only read its own branch assignments. Never trust courier_id from query/body.
courierRouter.get('/dashboard', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const s = scope(req);
    const rows = await assignmentSelect(query).where({ 'ca.tenant_id': s.tenant_id, 'ca.branch_id': s.branch_id, 'ca.courier_id': s.courier_id }).orderBy('ca.assigned_at', 'asc');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const active = rows.filter((row: any) => !COURIER_TERMINAL_STATUSES.includes(row.status));
    const todayRows = rows.filter((row: any) => new Date(row.assigned_at) >= today);
    const count = (type: string, predicate = (_row: any) => true) => todayRows.filter((row: any) => row.assignment_type === type && predicate(row)).length;
    res.json({ data: { stats: { pickup_hari_ini: count('pickup'), delivery_hari_ini: count('delivery'), dalam_perjalanan: active.filter((r: any) => ['MENUJU_LOKASI', 'MENUJU_TOKO', 'MENUJU_CUSTOMER'].includes(r.status)).length, selesai_hari_ini: count('pickup', (r) => ['SELESAI', 'PERANGKAT_TIBA_DI_WORKSHOP'].includes(r.status)) + count('delivery', (r) => r.status === 'SELESAI'), pickup_gagal: count('pickup', (r) => failureStatuses.has(r.status)), delivery_gagal: count('delivery', (r) => failureStatuses.has(r.status)) }, active, schedule: todayRows } });
  } catch (error) { errorResponse(res, error); }
});

// Admin/frontdesk queue: these records are recommendations only and are not assignments yet.
courierRouter.get('/queue', requireRole('admin', 'frontdesk'), async (req: AuthRequest, res: Response) => {
  try {
    const query = reqDb(req); const tenant_id = req.user!.tenant_id; const branch_id = req.user!.branch_id;
    const pickups = await query('bookings as b').join('customers as c', 'c.id', 'b.customer_id').where({ 'b.tenant_id': tenant_id, 'b.branch_id': branch_id }).whereIn('b.service_method', ['pickup_only', 'pickup_delivery']).whereNotIn('b.status', ['cancelled', 'no_show']).whereNotExists(query('courier_assignments as ca').select(query.raw('1')).whereRaw('ca.booking_id = b.id').where('ca.tenant_id', tenant_id)).select('b.id', 'b.booking_code as reference', 'b.customer_id', 'c.name as customer_name', query.raw('COALESCE(b.customer_phone, c.phone_wa) as customer_phone'), query.raw('COALESCE(b.pickup_address, c.address) as address'), 'b.pickup_latitude as latitude', 'b.pickup_longitude as longitude', 'b.created_at', query.raw("'pickup' as assignment_type"));
    const deliveries = await query('service_tickets as t').join('customers as c', 'c.id', 't.customer_id').leftJoin('bookings as b', function (this: any) { this.on('b.id', '=', 't.booking_id').andOn('b.tenant_id', '=', 't.tenant_id').andOn('b.branch_id', '=', 't.branch_id'); }).where({ 't.tenant_id': tenant_id, 't.branch_id': branch_id }).whereIn('t.current_status', ['siap_diambil', 'siap_diantar']).whereNotExists(query('courier_assignments as ca').select(query.raw('1')).whereRaw('ca.ticket_id = t.id').where('ca.tenant_id', tenant_id)).select('t.id', 't.ticket_code as reference', 't.customer_id', 'c.name as customer_name', query.raw("COALESCE(NULLIF(t.customer_phone_snapshot, ''), b.customer_phone, c.phone_wa) as customer_phone"), query.raw("COALESCE(NULLIF(t.customer_address_snapshot, ''), b.pickup_address, c.address) as address"), query.raw('COALESCE(t.customer_latitude, b.pickup_latitude) as latitude'), query.raw('COALESCE(t.customer_longitude, b.pickup_longitude) as longitude'), 't.created_at', query.raw("'delivery' as assignment_type"));
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
    const terminalPlaceholders = COURIER_TERMINAL_STATUSES.map(() => '?').join(', ');
    const candidates = await query('users as u').join('roles as r', 'r.id', 'u.role_id').where({ 'u.tenant_id': tenant_id, 'u.branch_id': branch_id, 'u.is_active': true, 'r.code': 'kurir', 'u.courier_status': 'ONLINE' }).whereNull('u.deleted_at').select('u.id', 'u.name', 'u.phone', 'u.courier_status').select(query.raw(`(SELECT count(*) FROM courier_assignments ca WHERE ca.courier_id = u.id AND ca.tenant_id = ? AND ca.branch_id = ? AND ca.status NOT IN (${terminalPlaceholders})) as active_tasks`, [tenant_id!, branch_id!, ...COURIER_TERMINAL_STATUSES])).orderBy('active_tasks', 'asc').orderBy('u.name', 'asc');
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

// Route coordinates are resolved from this courier's assignment, never from request input.
courierRouter.get('/assignments/:id/route', requireRole('kurir'), async (req: AuthRequest, res: Response) => {
  try {
    const s = scope(req);
    const row = await assignmentSelect(reqDb(req))
      .where({ 'ca.id': req.params.id, 'ca.tenant_id': s.tenant_id, 'ca.branch_id': s.branch_id, 'ca.courier_id': s.courier_id })
      .first();
    if (!row) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

    const destination = resolveCourierDestination(row);
    const origin = destination.label === 'Alamat toko'
      ? resolveCourierDestination({ ...row, assignment_type: 'delivery', status: 'SIAP_DIANTAR', device_picked_up: false })
      : resolveCourierDestination({ ...row, assignment_type: 'pickup', status: 'PERANGKAT_DIJEMPUT', device_picked_up: true });
    const routeOrigin = origin.latitude !== null && origin.longitude !== null
      ? { latitude: origin.latitude, longitude: origin.longitude }
      : null;
    const routeDestination = destination.latitude !== null && destination.longitude !== null
      ? { latitude: destination.latitude, longitude: destination.longitude }
      : null;
    if (!routeOrigin || !routeDestination) {
      return res.status(422).json({ error: 'Koordinat rute belum lengkap.' });
    }

    const data = await getCourierRoute(req.user!.user_id, routeOrigin, routeDestination);
    return res.json({ data });
  } catch (error) {
    const status = error instanceof CourierRoutingError ? error.status : 503;
    return res.status(status).json({ error: status === 429 ? 'Tunggu sebentar sebelum meminta rute lagi.' : 'Rute jalan belum tersedia.' });
  }
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
    if (failureStatuses.has(status) && !isValidCourierFailure(failure_reason, failure_notes)) return res.status(400).json({ error: 'Pilih alasan gagal yang valid dan isi catatan untuk alasan Lainnya.' });
    if (gpsStatuses.has(status) && (latitude === undefined || longitude === undefined)) return res.status(400).json({ error: 'latitude dan longitude wajib diisi untuk status ini' });
    const s = scope(req);
    const result = await withTenantContext(s.tenant_id, async (trx) => {
      const assignment = await trx('courier_assignments').where({ id: req.params.id, ...s }).forUpdate().first();
      if (!assignment) throw Object.assign(new Error('Tugas tidak ditemukan'), { status: 404 });
      if (!COURIER_ALLOWED_TRANSITIONS[assignment.status]?.includes(status)) throw Object.assign(new Error(`Perubahan status ${assignment.status} ke ${status} tidak diizinkan`), { status: 409 });
      if (assignment.assignment_type === 'delivery' && ['MENUJU_CUSTOMER', 'SAMPAI_DI_LOKASI', 'PERANGKAT_DISERAHKAN', 'SELESAI'].includes(status)) {
        const invoice = await trx('invoices').where({ ticket_id: assignment.ticket_id, tenant_id: s.tenant_id }).where('status', 'paid').first();
        if (!invoice) throw Object.assign(new Error('Perangkat belum dapat diantar karena invoice belum lunas.'), { status: 409 });
      }
      const completed = isCourierAssignmentComplete(assignment.assignment_type, status);
      const [updated] = await trx('courier_assignments').where({ id: assignment.id }).update({ status, started_at: assignment.started_at || new Date(), completed_at: completed ? new Date() : null, failure_reason: failure_reason || null, failure_notes: failure_notes || null, updated_at: trx.fn.now() }).returning('*');
      if (gpsStatuses.has(status)) await trx('courier_location_events').insert({ tenant_id: s.tenant_id, assignment_id: assignment.id, status, latitude, longitude });
      await trx('courier_status_logs').insert({
        tenant_id: s.tenant_id,
        assignment_id: assignment.id,
        event_type: 'status',
        status,
        actor_id: req.user!.user_id,
        courier_id: assignment.courier_id,
        failure_reason: failure_reason || null,
      });
      if (completed || failureStatuses.has(status)) {
        const remaining = await trx('courier_assignments').where({ tenant_id: s.tenant_id, branch_id: s.branch_id, courier_id: assignment.courier_id }).whereNotIn('status', [...COURIER_TERMINAL_STATUSES]).count('id as count').first();
        if (Number(remaining?.count || 0) === 0) await trx('users').where({ id: assignment.courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: trx.fn.now() });
      }
      const courier = await trx('users').where({ id: assignment.courier_id, tenant_id: s.tenant_id }).select('name').first();
       const booking = assignment.booking_id
         ? await trx('bookings').where({ id: assignment.booking_id, tenant_id: s.tenant_id }).select('booking_code', 'customer_id', 'tracking_code').first()
         : null;
       const ticket = assignment.ticket_id
         ? await trx('service_tickets').where({ id: assignment.ticket_id, tenant_id: s.tenant_id }).select('ticket_code', 'customer_id', 'tracking_code').first()
         : assignment.booking_id
           ? await trx('service_tickets').where({ booking_id: assignment.booking_id, tenant_id: s.tenant_id }).select('ticket_code', 'customer_id', 'tracking_code').first()
           : null;
      const customer = await trx('customers').where({ id: booking?.customer_id ?? ticket?.customer_id, tenant_id: s.tenant_id }).first();
      await logAudit(trx, req, {
        action: 'courier_assignment.status_changed',
        entityType: 'courier_assignment',
        entityId: assignment.id,
        oldValues: { courier_name: courier?.name, booking_code: booking?.booking_code, ticket_code: ticket?.ticket_code, status: assignment.status },
        newValues: { courier_name: courier?.name, booking_code: booking?.booking_code, ticket_code: ticket?.ticket_code, status, failure_reason: failure_reason || null, failure_notes: failure_notes || null },
      });
       return {
         assignment: updated,
         customer,
         trackingCode: ticket ? ticket.tracking_code ?? '' : booking?.tracking_code ?? '',
         previousStatus: assignment.status,
       };
     });
    if (result.customer?.phone_wa) void notifyCourierEvent({
      tenantId: s.tenant_id,
      customerId: result.customer.id,
      phone: result.customer.phone_wa,
      assignmentId: result.assignment.id,
      assignmentType: result.assignment.assignment_type,
      trackingCode: result.trackingCode,
      previousStatus: result.previousStatus,
      status,
      failureReason: failure_reason ?? null,
    });
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
    const reference = assignment_type === 'pickup'
      ? await reqDb(req)('bookings').where({ id: booking_id, tenant_id: s.tenant_id, branch_id: s.branch_id }).select('booking_code').first()
      : await reqDb(req)('service_tickets').where({ id: ticket_id, tenant_id: s.tenant_id, branch_id: s.branch_id }).select('ticket_code').first();
    const [row] = await reqDb(req)('courier_assignments').insert({ tenant_id: s.tenant_id, branch_id: s.branch_id, courier_id, assignment_type, booking_id: booking_id || null, ticket_id: ticket_id || null, status, assigned_by: req.user!.user_id, assignment_reason: assignment_reason || null }).returning('*');
    await reqDb(req)('courier_status_logs').insert({
      tenant_id: s.tenant_id,
      assignment_id: row.id,
      event_type: 'assigned',
      status,
      actor_id: req.user!.user_id,
      courier_id,
      created_at: row.assigned_at,
    });
    await reqDb(req)('users').where({ id: courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: reqDb(req).fn.now() });
    await logAudit(reqDb(req), req, {
      action: 'courier.assigned',
      entityType: 'courier_assignment',
      entityId: row.id,
      newValues: { courier_name: target.name, booking_code: reference?.booking_code, ticket_code: reference?.ticket_code, assignment_type, status, reason: assignment_reason || null },
    });
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
      const previous = await trx('users').where({ id: current.courier_id, tenant_id: s.tenant_id }).select('name').first();
      const booking = current.booking_id
        ? await trx('bookings').where({ id: current.booking_id, tenant_id: s.tenant_id }).select('booking_code').first()
        : null;
      const ticket = current.ticket_id
        ? await trx('service_tickets').where({ id: current.ticket_id, tenant_id: s.tenant_id }).select('ticket_code').first()
        : null;
      const [updated] = await trx('courier_assignments').where({ id: current.id }).update({ courier_id, reassigned_by: req.user!.user_id, reassignment_reason: reason || null, updated_at: trx.fn.now() }).returning('*');
      await trx('users').where({ id: courier_id, tenant_id: s.tenant_id }).update({ courier_status: 'ONLINE', updated_at: trx.fn.now() });
      const [audit] = await trx('courier_assignment_audits').insert({ tenant_id: s.tenant_id, assignment_id: current.id, from_courier_id: current.courier_id, to_courier_id: courier_id, changed_by: req.user!.user_id, reason: reason || null }).returning('id');
      await trx('courier_status_logs').insert({
        tenant_id: s.tenant_id,
        assignment_id: current.id,
        event_type: 'reassigned',
        status: current.assignment_type === 'delivery' ? 'SIAP_DIANTAR' : 'KURIR_DITUGASKAN',
        actor_id: req.user!.user_id,
        courier_id,
        source_assignment_audit_id: audit.id,
      });
      await logAudit(trx, req, {
        action: 'courier.reassigned',
        entityType: 'courier_assignment',
        entityId: current.id,
        oldValues: { courier_name: previous?.name, booking_code: booking?.booking_code, ticket_code: ticket?.ticket_code },
        newValues: { courier_name: target.name, booking_code: booking?.booking_code, ticket_code: ticket?.ticket_code, reason: reason || null },
      });
      return updated;
    });
    return res.json({ data: result });
  } catch (error) { return errorResponse(res, error); }
});
