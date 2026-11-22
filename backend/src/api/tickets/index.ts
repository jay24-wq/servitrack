import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { generateTicketCode, generateTrackingCode, generateTrackingToken } from '@utils/code';
import { logBookingEvent } from '@repositories/bookingTimelineRepo';
import { notifyTicketCreated, notifyTicketStatusChanged } from '@services/notifications/events';
import { findActiveTechnician } from '@repositories/ticketAssignmentRepo';
import {
  getTechnicianWorkload,
  logAutomaticAssignment,
  logExplicitAssignment,
  pickAutoTechnician,
} from '@services/ticketAssignmentService';
import { logAudit } from '@services/auditLog';
import { recalculateTicketFinalCost } from '@services/ticketCost';
import { decryptSecretField, encryptSecretField } from '@utils/secretField';
import { validate as isUuid } from 'uuid';
import { statusRouter } from './status';
import { notesRouter } from './notes';
import { photosRouter } from './photos';
import { canTransitionTicket } from '@common/utils/TicketStatuses';
import { MAX_INSPECTION_LENGTH, mergeInspectionResult } from '@services/ticketInspection';
import { createQueuedWhatsAppNotification } from '@services/notifications/notificationService';
import { getDeviceDisplayName } from '@common/utils/device';
import { ticketCustomerSnapshot } from '@services/ticketCustomerSnapshot';

export const ticketRouter = Router();
const COURIER_PICKUP_METHODS = new Set(['pickup_only', 'pickup_delivery', 'terjadwal', 'antar_jemput']);

function safeTicketData<T extends Record<string, any>>(ticket: T): T {
  const data = { ...ticket };
  delete data.device_pin_enc;
  delete data.device_pin_refused;
  delete data.owner_id_number_enc;
  delete data.technician_note;
  delete data.customer_phone_snapshot;
  delete data.customer_address_snapshot;
  delete data.customer_latitude;
  delete data.customer_longitude;
  return data;
}

async function existingTicketResponse(trx: import('knex').Knex.Transaction, ticket: any) {
  const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id: ticket.tenant_id }).select('name', 'phone_wa').first();
  const device = await trx('devices').where({ id: ticket.device_id, tenant_id: ticket.tenant_id }).select('model').first();
  const branch = await trx('branches').where({ id: ticket.branch_id, tenant_id: ticket.tenant_id }).select('name', 'address').first();
  const tenant = await trx('tenants').where({ id: ticket.tenant_id }).select('name', 'address').first();
  const technician = ticket.technician_id
    ? await trx('users').where({ id: ticket.technician_id, tenant_id: ticket.tenant_id }).select('name').first()
    : null;
  return {
    ...safeTicketData(ticket),
    technician_name: technician?.name ?? null,
    customerPhone: customer?.phone_wa ?? '',
    customer_name: customer?.name ?? null,
    device_model: device?.model ?? null,
    branch_name: branch?.name ?? null,
    branch_address: branch?.address ?? null,
    tenant_name: tenant?.name ?? null,
    tenant_address: tenant?.address ?? null,
  };
}

ticketRouter.use(authMiddleware);
ticketRouter.use(tenantResolver);
ticketRouter.use(branchResolver);
ticketRouter.use(statusRouter);
ticketRouter.use(notesRouter);
ticketRouter.use(photosRouter);

// GET /api/tickets - List service tickets
ticketRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const query = reqDb(req);
    const tickets = await query('service_tickets as t')
      .where({ 't.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id })
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .leftJoin('users as u', 'u.id', 't.technician_id')
      .leftJoin('bookings as b', 'b.id', 't.booking_id')
      .leftJoin('branches as br', 'br.id', 't.branch_id')
      .select(
        't.*',
        'br.name as branch_name',
        'br.address as branch_address',
        'b.booking_code',
        'c.name as customer_name',
        'c.phone_wa as customer_phone',
        'd.model as device_model',
        'u.name as technician_name',
        query.raw(`
          upper(
            concat(
              left(split_part(u.name, ' ', 1), 1),
              left(split_part(u.name, ' ', 2), 1)
            )
          ) as technician_initials
        `)
      )
      .orderBy('t.created_at', 'desc');
    res.json({ data: tickets.map((ticket: any) => safeTicketData(ticket)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data tiket' });
  }
});

// GET /api/tickets/technician/dashboard - data personal teknisi login
ticketRouter.get('/technician/dashboard', requireRole('teknisi'), async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const technician_id = req.user?.user_id;
    if (!tenant_id || !technician_id) {
      res.status(401).json({ error: 'Identitas tenant atau teknisi tidak ditemukan' });
      return;
    }

    const search = String(req.query.search || '').trim();
    const query = reqDb(req);
    const assigned = query('service_tickets as t')
      .where({ 't.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id, 't.technician_id': technician_id })
      .leftJoin('customers as c', 'c.id', 't.customer_id')
      .leftJoin('devices as d', 'd.id', 't.device_id')
      .modify((builder) => {
        if (search) {
          builder.where((filter) => filter
            .whereILike('t.ticket_code', `%${search}%`)
            .orWhereILike('t.tracking_code', `%${search}%`)
            .orWhereILike('d.model', `%${search}%`)
            .orWhereILike('c.name', `%${search}%`));
        }
      });

    const tickets = await assigned
      .clone()
      .select(
        't.id',
        't.ticket_code',
        't.tracking_code',
        't.technician_id',
        't.current_status',
        't.work_type',
        't.diagnosis_status',
        't.technician_diagnosis',
        't.additional_damage',
        't.requested_part_id',
        't.requested_part_qty',
        't.part_shortages',
        't.device_pin_enc',
        't.device_pin_refused',
        't.complaint',
        't.service_method',
        't.estimated_done_at',
        't.completed_at',
        't.created_at',
        'c.name as customer_name',
        'c.phone_wa as customer_phone',
        'd.model as device_model'
      )
      .orderBy('t.created_at', 'desc');
    const ticketData = tickets.map((ticket: any) => {
      const { device_pin_enc, device_pin_refused, ...safeTicket } = ticket;
      return {
        ...safeTicket,
        device_pin: decryptSecretField(device_pin_enc),
        device_pin_refused: Boolean(device_pin_refused),
      };
    });

    const [stats] = await query('service_tickets as t')
      .where({ 't.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id, 't.technician_id': technician_id })
      .select(query.raw(`
        COUNT(*) FILTER (WHERE t.current_status = 'antrian') AS antrean,
        COUNT(*) FILTER (
          WHERE (t.estimated_done_at AT TIME ZONE 'Asia/Makassar')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        ) AS prioritas,
        COUNT(*) FILTER (WHERE t.current_status = 'menunggu_part') AS menunggu_part,
        COUNT(*) FILTER (
          WHERE t.current_status IN ('selesai', 'siap_diambil')
            AND (t.completed_at AT TIME ZONE 'Asia/Makassar')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        ) AS selesai
      `));

    res.json({
      data: {
        stats: {
          antrean: Number(stats?.antrean || 0),
          prioritas: Number(stats?.prioritas || 0),
          menunggu_part: Number(stats?.menunggu_part || 0),
          selesai: Number(stats?.selesai || 0),
        },
        tickets: ticketData,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil dashboard teknisi' });
  }
});

// GET /api/tickets/technicians/workload - Active workload per technician
ticketRouter.get('/technicians/workload', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const workload = await getTechnicianWorkload(reqDb(req), tenant_id, req.user!.branch_id!);
    const phones = workload.length
      ? await reqDb(req)('users').where({ tenant_id }).whereIn('id', workload.map((technician) => technician.id)).select('id', 'phone')
      : [];
    const phoneById = new Map(phones.map((user: any) => [user.id, user.phone]));
    const totalActive = workload.reduce((sum, technician) => sum + technician.active_count, 0);
    const topTechnician = [...workload].sort(
      (a, b) => b.total_count - a.total_count || a.name.localeCompare(b.name)
    )[0] ?? null;

    res.json({
      data: workload.map((technician) => ({ ...technician, phone: phoneById.get(technician.id) ?? null })),
      summary: {
        total_active: totalActive,
        total_technicians: workload.length,
        busiest_technician: topTechnician,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil beban kerja teknisi' });
  }
});

// POST /api/tickets/:id/assessment - persist inspection and select the next workflow status
ticketRouter.post('/:id/assessment', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { work_type, diagnosis_status, technician_diagnosis, technician_note: legacyNote, part_id, part_qty } = req.body ?? {};
    const diagnosis = mergeInspectionResult(technician_diagnosis, legacyNote);
    if (!isUuid(id) || !['without_parts', 'with_parts'].includes(work_type) ||
      diagnosis_status !== 'matches_complaint' || !diagnosis || diagnosis.length > MAX_INSPECTION_LENGTH ||
      (work_type === 'with_parts' && (!isUuid(part_id) || !Number.isSafeInteger(part_qty) || part_qty <= 0))) {
      res.status(400).json({ error: 'Lengkapi jenis pengerjaan, status diagnosa, dan Hasil Pemeriksaan Teknisi (maksimal 4000 karakter)' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets')
        .where({ id, tenant_id, branch_id: req.user?.branch_id })
        .forUpdate()
        .first();
      if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });
      if (ticket.current_status !== 'pengecekan') {
        throw Object.assign(new Error('Tiket tidak lagi berada pada tahap Pengecekan'), { status: 409 });
      }

      let requestedPart: any = null;
      let nextStatus = 'pengerjaan';
      let partShortages: Array<Record<string, unknown>> = [];
      if (work_type === 'with_parts') {
        requestedPart = await trx('parts')
          .where({ id: part_id, tenant_id, branch_id: ticket.branch_id, is_active: true })
          .forUpdate()
          .first();
        if (!requestedPart) throw Object.assign(new Error('Sparepart tidak ditemukan di cabang tiket atau sudah tidak aktif'), { status: 404 });
        if (Number(requestedPart.stock_qty) < part_qty) {
          nextStatus = 'menunggu_part';
          partShortages = [{
            part_id: requestedPart.id,
            part_name: requestedPart.name,
            required_qty: part_qty,
            available_qty: Number(requestedPart.stock_qty),
            shortage_qty: part_qty - Number(requestedPart.stock_qty),
          }];
        }
      }

      const [updated] = await trx('service_tickets')
        .where({ id, tenant_id, branch_id: ticket.branch_id })
        .update({
          work_type,
          diagnosis_status,
          technician_diagnosis: diagnosis,
          additional_damage: null,
          requested_part_id: requestedPart?.id ?? null,
          requested_part_qty: requestedPart ? part_qty : null,
          part_shortages: JSON.stringify(partShortages),
          workflow_resolution: null,
          cancelled_at: null,
          current_status: nextStatus,
        })
        .returning('*');
      await trx('ticket_status_logs').insert({
        tenant_id,
        ticket_id: id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status: nextStatus,
        note: nextStatus === 'menunggu_part'
          ? 'Diagnosa sesuai keluhan; menunggu sparepart tersedia'
          : 'Diagnosa sesuai keluhan; pekerjaan dilanjutkan',
      });
      await logAudit(trx, req, {
        action: 'ticket.assessment_recorded',
        entityType: 'service_ticket',
        entityId: id,
        oldValues: { current_status: ticket.current_status, work_type: ticket.work_type, diagnosis_status: ticket.diagnosis_status },
        newValues: {
          ticket_code: ticket.ticket_code,
          current_status: nextStatus,
          work_type,
          diagnosis_status,
          hasil_pemeriksaan_teknisi: diagnosis,
          requested_part_id: requestedPart?.id ?? null,
          requested_part_qty: requestedPart ? part_qty : null,
        },
      });
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id }).select('phone_wa').first();
      return { ticket: updated, customerPhone: customer?.phone_wa ?? '', previousStatus: ticket.current_status };
    });

    if (result.ticket.current_status !== result.previousStatus) void notifyTicketStatusChanged({
      tenantId: tenant_id,
      customerId: result.ticket.customer_id,
      phone: result.customerPhone,
      ticketId: id,
      trackingCode: result.ticket.tracking_code,
      previousStatus: result.previousStatus,
      status: result.ticket.current_status,
    });
    res.json({ data: safeTicketData(result.ticket) });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal menyimpan hasil pengecekan' });
  }
});

// Post-send corrections update the ticket's current finding, never the sent quotation snapshot.
ticketRouter.put('/:id/inspection-result', requireRole('admin', 'teknisi'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { id } = req.params;
    const diagnosis = mergeInspectionResult(req.body?.technician_diagnosis, req.body?.technician_note);
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(id) || !diagnosis || diagnosis.length > MAX_INSPECTION_LENGTH) {
      return res.status(400).json({ error: 'Hasil Pemeriksaan Teknisi wajib diisi (maksimal 4000 karakter)' });
    }

    const result = await withTenantContext(tenantId, async (trx) => {
      const ticket = await trx('service_tickets').where({ id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });
      const quote = await trx('quotations').where({ tenant_id: tenantId, ticket_id: id, status: 'sent' }).orderBy('created_at', 'desc').forUpdate().first();
      if (!quote || ticket.current_status !== 'menunggu_persetujuan') {
        throw Object.assign(new Error('Hasil pemeriksaan hanya dapat dikoreksi setelah quotation terkirim dan sebelum keputusan pelanggan'), { status: 409 });
      }
      const oldDiagnosis = ticket.technician_diagnosis ?? '';
      const [updated] = await trx('service_tickets').where({ id, tenant_id: tenantId }).update({ technician_diagnosis: diagnosis }).returning('*');
      await logAudit(trx, req, {
        action: 'ticket.inspection_result_updated_after_send',
        entityType: 'service_ticket',
        entityId: id,
        ticketId: id,
        quotationId: quote.id,
        oldValues: { hasil_pemeriksaan_teknisi: oldDiagnosis },
        newValues: { hasil_pemeriksaan_teknisi: diagnosis, quotation_snapshot_unchanged: true },
        note: 'Koreksi hasil pemeriksaan setelah quotation terkirim',
      });
      return updated;
    });
    return res.json({ data: safeTicketData(result) });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal memperbarui Hasil Pemeriksaan Teknisi' });
  }
});

// PUT /api/tickets/:id/service-fee - Save technician labor fee and refresh final cost
ticketRouter.put('/:id/service-fee', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    if (!tenant_id) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });

    const serviceFee = Number(req.body?.service_fee);
    if (!isUuid(id) || !Number.isFinite(serviceFee) || serviceFee < 0) {
      return res.status(400).json({ error: 'Biaya jasa tidak valid' });
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets')
        .where({ id, tenant_id, branch_id: req.user?.branch_id })
        .forUpdate()
        .first();
      if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });
      if (!['pengerjaan', 'quality_check'].includes(ticket.current_status)) {
        throw Object.assign(new Error('Biaya jasa hanya dapat diisi saat pengerjaan atau quality check'), { status: 409 });
      }

      await trx('service_tickets').where({ id, tenant_id }).update({ service_fee: serviceFee });
      const cost = await recalculateTicketFinalCost(trx, tenant_id, id);

      await logAudit(trx, req, {
        action: 'ticket.service_fee_updated',
        entityType: 'service_ticket',
        entityId: id,
        oldValues: { ticket_code: ticket.ticket_code, service_fee: ticket.service_fee },
        newValues: { ticket_code: ticket.ticket_code, service_fee: serviceFee, final_cost: cost.finalCost },
      });

      return { service_fee: serviceFee, ...cost };
    });

    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menyimpan biaya jasa' });
  }
});

ticketRouter.put('/:id/diagnostic-fee', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { id } = req.params;
    const fee = Number(req.body?.diagnostic_fee);
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(id) || !Number.isFinite(fee) || fee < 0) return res.status(400).json({ error: 'Biaya diagnosa tidak valid' });
    const result = await withTenantContext(tenantId, async (trx) => {
      const ticket = await trx('service_tickets').where({ id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!ticket) throw Object.assign(new Error('Tiket tidak ditemukan'), { status: 404 });
      if (!['menunggu_persetujuan', 'batal', 'siap_diambil'].includes(ticket.current_status)) {
        throw Object.assign(new Error('Biaya diagnosa hanya dapat ditagihkan pada tiket ditolak atau dibatalkan'), { status: 409 });
      }
      if (ticket.current_status === 'menunggu_persetujuan') {
        const quote = await trx('quotations').where({ tenant_id: tenantId, ticket_id: id }).orderBy('created_at', 'desc').first();
        if (quote?.status !== 'rejected') throw Object.assign(new Error('Biaya diagnosa hanya dapat diisi setelah quotation ditolak'), { status: 409 });
      }
      await trx('service_tickets').where({ id, tenant_id: tenantId }).update({ diagnostic_fee: fee });
      const costs = await recalculateTicketFinalCost(trx, tenantId, id);
      await logAudit(trx, req, {
        action: 'ticket.diagnostic_fee_updated', entityType: 'service_ticket', entityId: id,
        oldValues: { diagnostic_fee: ticket.diagnostic_fee }, newValues: { diagnostic_fee: fee, final_cost: costs.finalCost },
      });
      return { diagnostic_fee: fee, ...costs };
    });
    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menyimpan biaya diagnosa' });
  }
});

// GET /api/tickets/:id - Detail ticket
ticketRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    const query = reqDb(req);
    const ticket = await query('service_tickets as t')
      .leftJoin('branches as br', 'br.id', 't.branch_id')
      .leftJoin('bookings as b', 'b.id', 't.booking_id')
      .where({ 't.id': id, 't.tenant_id': tenant_id, 't.branch_id': req.user?.branch_id })
      .select('t.*', 'br.name as branch_name', 'br.address as branch_address', 'b.pickup_fee')
      .first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const photos = await query('ticket_photos').where({ ticket_id: id, tenant_id });
    const notes = await query('ticket_notes').where({ ticket_id: id, tenant_id });
    const statusLogs = await query('ticket_status_logs').where({ ticket_id: id, tenant_id });
    const assignmentLogs = await query('ticket_assignment_logs')
      .where({ ticket_id: id, tenant_id })
      .orderBy('created_at', 'desc');
    const quotation = await query('quotations')
      .where({ ticket_id: id, tenant_id })
      .orderBy('created_at', 'desc')
      .first();
    const quotationItems = quotation
      ? await query('quotation_items as item')
          .leftJoin('parts as part', 'part.id', 'item.part_id')
          .where({ 'item.quotation_id': quotation.id, 'item.tenant_id': tenant_id })
          .select(
            'item.id', 'item.part_id', 'item.item_type', 'item.description', 'item.damage_description', 'item.qty',
            'item.unit_price', 'item.subtotal', 'item.labor_cost', 'item.part_cost', 'item.part_unit_price_snapshot',
            'item.part_name_snapshot', 'item.part_specification_snapshot', 'item.part_is_registered', 'item.created_at',
            'item.availability_status', 'item.available_qty_snapshot', 'item.estimated_part_arrival_days',
            query.raw('COALESCE(part.name, item.part_name_snapshot) as part_name'), 'part.sku as part_sku'
          )
          .orderBy('item.created_at', 'asc')
      : [];
    const safeQuotation = quotation ? { ...quotation, items: quotationItems } : null;
    if (safeQuotation) delete (safeQuotation as any).approval_token;
    if (safeQuotation) delete (safeQuotation as any).approval_token_hash;
    if (safeQuotation && req.user?.role?.toLowerCase() === 'admin') {
      (safeQuotation as any).notification = await query('notification_logs')
        .where({ quotation_id: quotation.id, tenant_id })
        .select(
          'status', 'error_code', 'error_message', 'attempt_count', 'last_attempt_at',
          ...(process.env.NODE_ENV === 'development' ? ['approval_url'] : []),
          'created_at'
        )
        .orderBy('created_at', 'desc')
        .first() ?? null;
    }

    res.json({ data: { ...safeTicketData(ticket), photos, notes, statusLogs, assignmentLogs, quotation: safeQuotation } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil detail tiket' });
  }
});

// POST /api/tickets - Create service ticket (convert from booking or manual/walk-in)
ticketRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const idempotencyKey = req.get('Idempotency-Key')?.trim();
    if (!idempotencyKey || !isUuid(idempotencyKey)) {
      res.status(400).json({ error: 'Header Idempotency-Key wajib berisi UUID yang valid' });
      return;
    }

    const {
      booking_id,
      customer_id,
      device_id,
      technician_id,
      problem,
      complaint,
      service_method,
      owner_id_type,
      owner_id_number,
      device_pin,
      device_pin_refused,
      initial_estimate_cost,
      // Walk-in: data pelanggan & perangkat dibuat otomatis bila id belum ada
      customer_name,
      customer_phone,
      device_category,
      device_model,
    } = req.body;

    if (!service_method) {
      res.status(400).json({ error: 'service_method wajib diisi' });
      return;
    }

    if (typeof device_model !== 'string' || !device_model.trim() || device_model.trim() === '-' || device_model.length > 80) {
      res.status(400).json({ error: 'Model perangkat wajib diisi (maksimal 80 karakter)' });
      return;
    }

    let normalizedInitialEstimate: number | null = null;
    if (initial_estimate_cost !== undefined && initial_estimate_cost !== null && initial_estimate_cost !== '') {
      const parsed = Number(initial_estimate_cost);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: 'initial_estimate_cost tidak boleh negatif' });
        return;
      }
      normalizedInitialEstimate = parsed;
    }

    const requestedTechnicianId =
      typeof technician_id === 'string' && technician_id.trim() ? technician_id.trim() : null;

    if ((device_pin !== undefined && typeof device_pin !== 'string') ||
      (device_pin_refused !== undefined && typeof device_pin_refused !== 'boolean')) {
      res.status(400).json({ error: 'Pilihan PIN tidak valid' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))', [
        `ticket-idempotency:${tenant_id}`,
        `${req.user?.branch_id}:${idempotencyKey}`,
      ]);
      const idempotentTicket = await trx('service_tickets')
        .where({ tenant_id, branch_id: req.user?.branch_id, idempotency_key: idempotencyKey })
        .first();
      if (idempotentTicket) {
        return { ...(await existingTicketResponse(trx, idempotentTicket)), replayed: true, notificationLogId: null };
      }

      let booking: any = null;
      if (booking_id) {
        booking = await trx('bookings').where({ id: booking_id, tenant_id, branch_id: req.user?.branch_id }).first();
        if (!booking) throw Object.assign(new Error('Booking tidak ditemukan'), { status: 404 });

        const existing = await trx('service_tickets').where({ booking_id: booking.id, tenant_id, branch_id: req.user?.branch_id }).first();
        if (existing) {
          return { ...(await existingTicketResponse(trx, existing)), replayed: true, notificationLogId: null };
        }

        if (COURIER_PICKUP_METHODS.has(booking.service_method)) {
          const pickup = await trx('courier_assignments')
            .where({ tenant_id, branch_id: req.user?.branch_id, booking_id: booking.id, assignment_type: 'pickup' })
            .orderBy('assigned_at', 'desc')
            .first();
          if (!pickup || !['PERANGKAT_TIBA_DI_WORKSHOP', 'SELESAI'].includes(pickup.status)) {
            throw Object.assign(new Error('Check-in menunggu konfirmasi kurir bahwa perangkat telah tiba di workshop'), { status: 409 });
          }
        }
      }

      let ticketPin = typeof device_pin === 'string' ? device_pin.trim() : '';
      let ticketPinRefused = device_pin_refused === true;
      if (booking && COURIER_PICKUP_METHODS.has(booking.service_method)) {
        const bookingPin = decryptSecretField(booking.device_pin_enc);
        if (booking.device_pin_refused || bookingPin) {
          ticketPin = bookingPin ?? '';
          ticketPinRefused = Boolean(booking.device_pin_refused);
        }
      }
      if (ticketPinRefused) ticketPin = '';
      if (!ticketPinRefused && (ticketPin.length < 4 || ticketPin.length > 128)) {
        throw Object.assign(new Error('Isi PIN / password atau tandai pelanggan menolak memberi PIN'), { status: 400 });
      }

      const resolvedBranchId = req.user?.branch_id;
      if (!resolvedBranchId) {
        throw Object.assign(new Error('Cabang tidak ditemukan untuk tenant ini'), { status: 400 });
      }

      // Pelanggan: pakai dari booking/id, atau cari/buat berdasarkan nomor WA
      let resolvedCustomerId = customer_id || booking?.customer_id;
      if (!resolvedCustomerId) {
        const phone = String(customer_phone || '').trim();
        const name = String(customer_name || '').trim();
        if (!phone) throw Object.assign(new Error('customer_phone wajib diisi'), { status: 400 });

        const existingCustomer = await trx('customers').where({ tenant_id, phone_wa: phone }).first();
        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          if (!name) throw Object.assign(new Error('customer_name wajib diisi untuk pelanggan baru'), { status: 400 });
          const [created] = await trx('customers').insert({ tenant_id, name, phone_wa: phone }).returning('*');
          resolvedCustomerId = created.id;
        }
      }

      // Booking yang sama sudah dijaga oleh booking_id dan idempotency key.
      // Untuk walk-in, tolak pengiriman ulang model yang sama ke pelanggan yang sama.
      if (!booking) {
        await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))', [
          `ticket-walkin-duplicate:${tenant_id}`,
          `${resolvedBranchId}:${resolvedCustomerId}:${device_model.trim().toLowerCase()}`,
        ]);
        const duplicate = await trx('service_tickets as t')
          .join('devices as d', 'd.id', 't.device_id')
          .where({ 't.tenant_id': tenant_id, 't.branch_id': resolvedBranchId, 't.customer_id': resolvedCustomerId })
          .whereNotIn('t.current_status', ['batal', 'selesai', 'siap_diambil'])
          .whereRaw('lower(btrim(d.model)) = lower(btrim(?))', [device_model])
          .whereRaw("t.created_at >= now() - interval '10 minutes'")
          .select('t.ticket_code')
          .first();
        if (duplicate) {
          throw Object.assign(new Error(`Tiket ${duplicate.ticket_code} untuk pelanggan dan model ini baru dibuat. Periksa tiket aktif sebelum mencoba lagi.`), { status: 409 });
        }
      }

      // Perangkat booking dipertahankan; walk-in baru mendapat record perangkat baru.
      let resolvedDeviceId = device_id || booking?.device_id;
      if (!resolvedDeviceId) {
        const [device] = await trx('devices')
          .insert({
            tenant_id,
            customer_id: resolvedCustomerId,
            category: String(device_category || 'lainnya').slice(0, 30),
            model: device_model,
          })
          .returning('*');
        resolvedDeviceId = device.id;
      } else {
        await trx('devices')
          .where({ id: resolvedDeviceId, tenant_id, customer_id: resolvedCustomerId })
          .update({ model: device_model });
      }

      const requestedTechnician = requestedTechnicianId
      ? await findActiveTechnician(trx, tenant_id, requestedTechnicianId, resolvedBranchId)
        : null;
      if (requestedTechnicianId && !requestedTechnician) {
        throw Object.assign(new Error('Teknisi tidak ditemukan atau tidak aktif'), { status: 400 });
      }

      const autoTechnician = requestedTechnician ? null : await pickAutoTechnician(trx, tenant_id, resolvedBranchId);
      const assignedTechnician = requestedTechnician ?? autoTechnician;
      const assignedAt = assignedTechnician ? new Date() : null;
      const trackingPrefix = booking
        ? null
        : await trx('tenants').where({ id: tenant_id }).select('tracking_prefix').first();
      if (!booking && !trackingPrefix) throw Object.assign(new Error('Tenant tidak ditemukan'), { status: 404 });

      const customerSnapshot = await trx('customers')
        .where({ id: resolvedCustomerId, tenant_id })
        .select('phone_wa', 'address')
        .first();

      const [ticket] = await trx('service_tickets')
        .insert({
          tenant_id,
          branch_id: resolvedBranchId,
          idempotency_key: idempotencyKey,
          booking_id: booking?.id ?? null,
          customer_id: resolvedCustomerId,
          device_id: resolvedDeviceId,
          received_by: req.user?.user_id,
          technician_id: assignedTechnician?.id ?? null,
          assignment_type: requestedTechnician ? 'MANUAL' : autoTechnician ? 'AUTO' : null,
          assigned_at: assignedAt,
          assigned_by: requestedTechnician ? req.user?.user_id ?? null : null,
          ticket_code: generateTicketCode(),
          tracking_code: booking?.tracking_code ?? generateTrackingCode(trackingPrefix!.tracking_prefix),
          tracking_token: generateTrackingToken(),
          service_method: booking?.service_method ?? service_method,
           owner_id_type: owner_id_type || null,
           owner_id_number_enc: owner_id_number || null,
           ...ticketCustomerSnapshot(booking, customerSnapshot),
           device_pin_enc: ticketPinRefused ? null : encryptSecretField(ticketPin),
           device_pin_refused: ticketPinRefused,
           complaint: complaint || problem || booking?.complaint || '',
           current_status: 'antrian',
           initial_estimate_cost: normalizedInitialEstimate,
         })
        .returning('*');

      if (autoTechnician) {
        await logAutomaticAssignment(trx, {
          tenantId: tenant_id,
          ticketId: ticket.id,
          technician: autoTechnician,
        });
      }

      if (requestedTechnician) {
        await logExplicitAssignment(trx, {
          tenantId: tenant_id,
          ticketId: ticket.id,
          technician: requestedTechnician,
          assignedBy: req.user?.user_id,
          actorName: req.user?.name,
          actorRole: req.user?.role,
        });
      }

      if (booking) {
        // Timeline: Unit Diterima Cabang (hanya bila belum tercatat sebelumnya)
        if (booking.status !== 'arrived') {
          await logBookingEvent(
            {
              tenant_id,
              booking_id: booking.id,
              event_code: 'UNIT_RECEIVED',
              from_status: booking.status,
              to_status: 'arrived',
              actor_id: req.user?.user_id ?? null,
              actor_type: 'frontdesk',
              note: 'Unit diterima cabang',
              meta: { booking_code: booking.booking_code },
            },
            trx
          );
        }

        await trx('bookings').where({ id: booking.id }).update({ status: 'arrived' });

        // Timeline: Tiket Servis Diterbitkan
        await logBookingEvent(
          {
            tenant_id,
            booking_id: booking.id,
            event_code: 'TICKET_ISSUED',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: 'Tiket servis diterbitkan',
            meta: { ticket_id: ticket.id, ticket_code: ticket.ticket_code },
          },
          trx
        );
      }

      // Catat status awal
      await trx('ticket_status_logs').insert({
        tenant_id,
        ticket_id: ticket.id,
        changed_by: req.user?.user_id,
        to_status: 'antrian',
        note: booking ? 'Tiket dibuat dari booking' : 'Tiket walk-in dibuat',
      });

       const customer = await trx('customers').where({ id: resolvedCustomerId, tenant_id }).select('name', 'phone_wa').first();
        const device = await trx('devices').where({ id: resolvedDeviceId, tenant_id }).select('model').first();
        const branch = await trx('branches').where({ id: ticket.branch_id, tenant_id }).select('name', 'address').first();
        const tenant = await trx('tenants').where({ id: tenant_id }).select('name', 'address').first();
        const deviceLabel = getDeviceDisplayName(device?.model);
       await logAudit(trx, req, {
         action: 'ticket.created',
         entityType: 'service_ticket',
         entityId: ticket.id,
         newValues: {
           ticket_code: ticket.ticket_code,
           customer_name: customer?.name ?? null,
            device_label: deviceLabel,
           current_status: ticket.current_status,
           service_method: ticket.service_method,
           technician_name: assignedTechnician?.name ?? null,
           branch_name: branch?.name ?? null,
         },
        });
        const notificationLogId = await createQueuedWhatsAppNotification(trx, {
          tenantId: tenant_id,
          customerId: resolvedCustomerId,
          toPhone: customer?.phone_wa ?? '',
           ticketId: ticket.id,
           templateName: 'service_ticket_created',
           dedupeKey: `ticket:${ticket.id}:created`,
           variables: { ticketCode: ticket.ticket_code, trackingCode: ticket.tracking_code },
        });
        return {
         ...safeTicketData(ticket),
         technician_name: assignedTechnician?.name ?? null,
         customerPhone: customer?.phone_wa ?? '',
         customer_name: customer?.name ?? null,
          device_model: device?.model ?? null,
         branch_name: branch?.name ?? null,
          branch_address: branch?.address ?? null,
          tenant_name: tenant?.name ?? null,
          tenant_address: tenant?.address ?? null,
          replayed: false,
          notificationLogId,
        };
      });

    const { replayed, notificationLogId, ...ticketData } = result;
    if (replayed) {
      res.status(200).json({ message: 'Tiket sudah dibuat', data: ticketData });
      return;
    }

    if (notificationLogId) void notifyTicketCreated({
      tenantId: tenant_id,
      customerId: result.customer_id,
      phone: result.customerPhone,
      ticketId: result.id,
      ticketCode: result.ticket_code,
      trackingCode: result.tracking_code,
      notificationLogId,
    }).catch((error) => console.error('[WhatsApp] gagal menjadwalkan notifikasi check-in', error));

    res.status(201).json({ message: 'Tiket servis berhasil dibuat', data: ticketData });
  } catch (error: any) {
    const constraint = String(error?.constraint ?? '');
    if (error?.code === '23505' && (constraint.includes('idempotency_key') || constraint.includes('booking_id'))) {
      try {
        const tenantId = req.user?.tenant_id;
        const idempotencyKey = req.get('Idempotency-Key')?.trim();
        if (tenantId && idempotencyKey) {
          const existing = await withTenantContext(tenantId, async (trx) => {
            const byKey = await trx('service_tickets')
              .where({ tenant_id: tenantId, branch_id: req.user?.branch_id, idempotency_key: idempotencyKey })
              .first();
            const ticket = byKey ?? (req.body?.booking_id
              ? await trx('service_tickets').where({ tenant_id: tenantId, branch_id: req.user?.branch_id, booking_id: req.body.booking_id }).first()
              : null);
            return ticket ? existingTicketResponse(trx, ticket) : null;
          });
          if (existing) {
            res.status(200).json({ message: 'Tiket sudah dibuat', data: existing });
            return;
          }
        }
      } catch (lookupError) {
        console.error('[Check-in] gagal mengambil tiket idempotent', lookupError);
      }
    }
    res.status(error.status || 500).json({ error: error.message || 'Gagal membuat tiket' });
  }
});

// PUT /api/tickets/:id/status - Update ticket status
ticketRouter.put('/:id/status', async (req: AuthRequest, res: Response) => {
  const tenant_id = req.user?.tenant_id;
  let transitionAttempt: { ticketId: string; from: string; to: string; message: string } | null = null;
  try {
    if (!tenant_id) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const { id } = req.params;
    const { to_status, note } = req.body;

    if (!to_status) {
      res.status(400).json({ error: 'to_status wajib diisi' });
      return;
    }

    const valid = ['antrian', 'pengecekan', 'menunggu_part', 'menunggu_persetujuan', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil', 'batal'];
    if (!valid.includes(to_status)) {
      res.status(400).json({ error: 'Status tidak valid' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!ticket) return { error: 'not_found' as const };
      transitionAttempt = { ticketId: id, from: ticket.current_status, to: to_status, message: '' };
      if (ticket.current_status !== to_status && !canTransitionTicket(ticket.current_status, to_status)) {
        throw Object.assign(new Error(`Transisi status tidak diizinkan: ${ticket.current_status} → ${to_status}`), { status: 409 });
      }
      if (to_status === 'menunggu_persetujuan') {
        throw Object.assign(new Error('Tahap persetujuan hanya dapat dimulai dengan membuat quotation'), { status: 409 });
      }
      if (ticket.current_status === 'menunggu_persetujuan') {
        const latestQuotation = await trx('quotations').where({ ticket_id: id, tenant_id }).orderBy('created_at', 'desc').first();
        if (['batal', 'siap_diambil'].includes(to_status) && latestQuotation?.status && ['rejected', 'expired', 'cancelled', 'superseded'].includes(latestQuotation.status)) {
          // Rejection resolution is recorded through the dedicated endpoint.
        } else if (to_status === 'pengerjaan' && latestQuotation?.status === 'approved') {
          // Approved quotation can proceed; stock checks below still apply.
        } else {
          throw Object.assign(new Error('Tahap quotation harus diselesaikan melalui workflow persetujuan'), { status: 409 });
        }
      }
      if (req.user?.role?.toLowerCase() === 'teknisi' && ticket.current_status === 'pengecekan' && to_status !== 'pengecekan') {
        throw Object.assign(new Error('Simpan hasil Pengecekan sebelum melanjutkan status tiket'), { status: 409 });
      }
      if (to_status === 'pengerjaan' && ticket.work_type === 'with_parts') {
        const quote = await trx('quotations').where({ ticket_id: id, tenant_id }).orderBy('created_at', 'desc').first();
        if (ticket.diagnosis_status === 'additional_damage' && ticket.workflow_resolution !== 'continue_original' && quote?.status !== 'approved') {
          throw Object.assign(new Error('Pengerjaan diblokir karena quotation belum disetujui pelanggan'), { status: 409 });
        }
        const requirements = new Map<string, number>();
        if (quote?.status === 'approved' && ticket.workflow_resolution !== 'continue_original') {
          const openRequests = await trx('part_requests')
            .where({ tenant_id, quotation_id: quote.id })
            .whereIn('status', ['OPEN', 'ORDERED'])
            .whereNull('linked_part_id');
          if (openRequests.length) {
            throw Object.assign(new Error(`Part belum diterima: ${openRequests.map((item) => item.requested_name).join(', ')}`), { status: 409 });
          }
          const quoteItems = await trx('quotation_items').where({ tenant_id, quotation_id: quote.id, item_type: 'part' });
          if (quoteItems.some((item) => item.part_is_registered === false && !item.part_id)) {
            throw Object.assign(new Error('Part custom harus ditautkan ke inventory sebelum pengerjaan'), { status: 409 });
          }
          for (const item of quoteItems) {
            if (item.part_id) requirements.set(item.part_id, (requirements.get(item.part_id) ?? 0) + Number(item.qty));
          }
        } else if (ticket.requested_part_id) {
          requirements.set(ticket.requested_part_id, Number(ticket.requested_part_qty ?? 0));
        }
        for (const [partId, qty] of requirements) {
          const part = await trx('parts').where({ id: partId, tenant_id, branch_id: ticket.branch_id, is_active: true }).forUpdate().first();
          if (!part || Number(part.stock_qty) < qty) {
            throw Object.assign(new Error(`Stok ${part?.name ?? 'sparepart'} belum cukup untuk memulai pengerjaan`), { status: 409 });
          }
        }
      }
      if (to_status === 'pengerjaan' && ticket.current_status === 'pengecekan') {
        if (!ticket.work_type || ticket.diagnosis_status !== 'matches_complaint') {
          throw Object.assign(new Error('Simpan hasil pengecekan dengan diagnosa sesuai keluhan sebelum memulai pengerjaan'), { status: 409 });
        }
      }
      if (to_status === 'quality_check' && ticket.work_type === 'with_parts') {
        const usage = await trx('ticket_part_usages as usage')
          .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
          .where({ 'usage.tenant_id': tenant_id, 'usage.ticket_id': id })
          .select(trx.raw('COALESCE(SUM(usage.qty - COALESCE(reversal.qty, 0)), 0) as qty'))
          .first();
        if (Number(usage?.qty ?? 0) <= 0) throw Object.assign(new Error('Catat minimal satu pemakaian sparepart sebelum Quality Control'), { status: 409 });
      }
      let partShortages: Array<Record<string, unknown>> | null = null;
      if (to_status === 'menunggu_part') {
        if (ticket.work_type !== 'with_parts') throw Object.assign(new Error('Tiket tanpa sparepart tidak dapat menunggu part'), { status: 409 });
        let required = new Map<string, number>();
        const approvedQuote = ticket.workflow_resolution !== 'continue_original'
          ? await trx('quotations').where({ tenant_id, ticket_id: id, status: 'approved' }).orderBy('created_at', 'desc').first()
          : null;
        if (approvedQuote) {
          const items = await trx('quotation_items').where({ tenant_id, quotation_id: approvedQuote.id, item_type: 'part' });
          const missingRequests = await trx('part_requests').where({ tenant_id, quotation_id: approvedQuote.id }).whereIn('status', ['OPEN', 'ORDERED']).whereNull('linked_part_id');
          for (const item of items) {
            if (item.part_id) required.set(item.part_id, (required.get(item.part_id) ?? 0) + Number(item.qty));
            else if (item.part_is_registered === false) {
              partShortages ??= [];
              partShortages.push({
                part_id: `request:${item.id}`,
                part_name: item.part_name_snapshot ?? item.description,
                required_qty: Number(item.qty),
                available_qty: 0,
                shortage_qty: Number(item.qty),
                part_request_id: missingRequests.find((request) => request.quotation_item_id === item.id)?.id ?? null,
                part_request_status: missingRequests.find((request) => request.quotation_item_id === item.id)?.status ?? 'CANCELLED',
                estimated_arrival_days: item.estimated_part_arrival_days,
              });
            }
          }
        } else if (ticket.requested_part_id) {
          required.set(ticket.requested_part_id, Number(ticket.requested_part_qty ?? 0));
        }
        if (!required.size && !partShortages?.length) throw Object.assign(new Error('Tiket ini tidak memiliki sparepart yang dibutuhkan'), { status: 409 });
        partShortages ??= [];
        for (const [partId, qty] of required) {
          const part = await trx('parts').where({ id: partId, tenant_id, branch_id: ticket.branch_id }).forUpdate().first();
          const [used] = await trx('ticket_part_usages as usage')
            .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
            .where({ 'usage.tenant_id': tenant_id, 'usage.ticket_id': id, 'usage.part_id': partId })
            .select(trx.raw('COALESCE(SUM(usage.qty - COALESCE(reversal.qty, 0)), 0) AS qty'));
          const remaining = Math.max(0, qty - Number(used?.qty ?? 0));
          const available = Number(part?.stock_qty ?? 0);
          if (!part || available < remaining) partShortages.push({
            part_id: partId, part_name: part?.name ?? 'Sparepart', required_qty: remaining,
            available_qty: available, shortage_qty: Math.max(0, remaining - available),
          });
        }
        if (!partShortages.length) throw Object.assign(new Error('Stok sparepart masih cukup; tiket belum perlu menunggu part'), { status: 409 });
      }
      const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id }).select('name', 'phone_wa').first();
        const device = await trx('devices').where({ id: ticket.device_id, tenant_id }).select('model').first();
        const deviceLabel = getDeviceDisplayName(device?.model);
      await trx('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).update({
        current_status: to_status,
        ...(to_status === 'pengerjaan' ? { part_shortages: JSON.stringify([]) } : {}),
        ...(partShortages ? { part_shortages: JSON.stringify(partShortages) } : {}),
      });
      await trx('ticket_status_logs').insert({
        tenant_id: tenant_id!,
        ticket_id: id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status,
        note: note || null,
      });
      if (ticket.current_status !== to_status) {
        await logAudit(trx, req, {
          action: 'ticket.status_changed',
          entityType: 'service_ticket',
          entityId: id,
          oldValues: { ticket_code: ticket.ticket_code, customer_name: customer?.name, device_label: deviceLabel, current_status: ticket.current_status },
          newValues: { ticket_code: ticket.ticket_code, customer_name: customer?.name, device_label: deviceLabel, current_status: to_status, note: note || null },
        });
      }
      return { ticket, customerPhone: customer?.phone_wa ?? '', partShortages, previousStatus: ticket.current_status };
    });
    if ('error' in result) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

    if (result.ticket.current_status !== to_status) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id!,
        customerId: result.ticket.customer_id,
        phone: result.customerPhone,
        ticketId: result.ticket.id,
        trackingCode: result.ticket.tracking_code,
        previousStatus: result.previousStatus,
        status: to_status,
        details: result.partShortages?.map((part: any) => `${part.part_name}: kurang ${part.shortage_qty} (tersedia ${part.available_qty}/${part.required_qty})${part.estimated_arrival_days ? ` · estimasi ${part.estimated_arrival_days} hari` : ''}`).join('\n'),
      });
    }

    return res.json({ message: 'Status tiket berhasil diperbarui' });
  } catch (error: any) {
    if (transitionAttempt && tenant_id && error.status === 409) {
      try {
        await withTenantContext(tenant_id, (trx) => logAudit(trx, req, {
          action: 'ticket.status_transition_rejected',
          entityType: 'service_ticket',
          entityId: transitionAttempt!.ticketId,
          oldValues: { current_status: transitionAttempt!.from },
          newValues: { attempted_status: transitionAttempt!.to, error: error.message },
          note: error.message,
        }));
      } catch {
        // Keep the transition error if the independent audit write also fails.
      }
    }
    return res.status(error.status || 500).json({ error: error.message || 'Gagal memperbarui status tiket' });
  }
});

// POST /api/tickets/:id/close - Close ticket (validasi invoice paid + parts recorded)
ticketRouter.post('/:id/close', async (req: AuthRequest, res: Response) => {
  const tenant_id = req.user?.tenant_id;
  let closeAttempt: { ticketId: string; from: string; to: string } | null = null;
  try {
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const { id } = req.params;
    const { to_status } = req.body;
    const finalStatus = to_status === 'selesai' || to_status === 'siap_diambil' ? to_status : 'selesai';

    const notification = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!ticket) throw new Error('Tiket tidak ditemukan');
      closeAttempt = { ticketId: id, from: ticket.current_status, to: finalStatus };
      if (!canTransitionTicket(ticket.current_status, finalStatus)) {
        throw Object.assign(new Error(`Transisi status tidak diizinkan: ${ticket.current_status} → ${finalStatus}`), { status: 409 });
      }

      const invoice = await trx('invoices').where({ ticket_id: id, tenant_id }).first();
      if (!invoice) throw new Error('Invoice belum ada, tiket tidak bisa ditutup');
      if (invoice.status !== 'paid') throw new Error('Invoice belum paid, tiket tidak bisa ditutup');

      const pendingQuotation = await trx('quotations').where({ ticket_id: id, tenant_id }).whereNot({ status: 'approved' }).first();
      if (pendingQuotation) throw new Error('Masih ada quotation pending');

      await trx('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).update({ current_status: finalStatus, completed_at: new Date(), closed_by: req.user?.user_id });

      await trx('ticket_status_logs').insert({
        tenant_id,
        ticket_id: id,
        changed_by: req.user?.user_id,
        from_status: ticket.current_status,
        to_status: finalStatus,
        note: 'Tiket ditutup',
      });
       const customer = await trx('customers').where({ id: ticket.customer_id, tenant_id }).select('name', 'phone_wa').first();
        const device = await trx('devices').where({ id: ticket.device_id, tenant_id }).select('model').first();
        const deviceLabel = getDeviceDisplayName(device?.model);
       await logAudit(trx, req, {
         action: 'ticket.closed',
         entityType: 'service_ticket',
         entityId: id,
         oldValues: { ticket_code: ticket.ticket_code, customer_name: customer?.name, device_label: deviceLabel, current_status: ticket.current_status },
         newValues: { ticket_code: ticket.ticket_code, customer_name: customer?.name, device_label: deviceLabel, current_status: finalStatus },
       });
        return { ticket, customerPhone: customer?.phone_wa ?? '', previousStatus: ticket.current_status };
    });

    if (notification.ticket.current_status !== finalStatus) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id,
        customerId: notification.ticket.customer_id,
        phone: notification.customerPhone,
         ticketId: notification.ticket.id,
         trackingCode: notification.ticket.tracking_code,
         previousStatus: notification.previousStatus,
         status: finalStatus,
      });
    }

    res.json({ message: 'Tiket berhasil ditutup' });
  } catch (error: any) {
    if (closeAttempt && tenant_id && error.status === 409) {
      try {
        await withTenantContext(tenant_id, (trx) => logAudit(trx, req, {
          action: 'ticket.status_transition_rejected',
          entityType: 'service_ticket', entityId: closeAttempt!.ticketId,
          oldValues: { current_status: closeAttempt!.from },
          newValues: { attempted_status: closeAttempt!.to, error: error.message },
          note: error.message,
        }));
      } catch { /* Keep the transition error. */ }
    }
    res.status(error.status || 400).json({ error: error.message || 'Gagal menutup tiket' });
  }
});

// POST /api/tickets/:id/notes - Add note
ticketRouter.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { note_type, content } = req.body;

    if (!note_type || !content) {
      res.status(400).json({ error: 'note_type dan content wajib diisi' });
      return;
    }

    const ticket = await reqDb(req)('service_tickets').where({ id, tenant_id, branch_id: req.user?.branch_id }).first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const [note] = await withTenantContext(tenant_id!, async (trx) => {
      return trx('ticket_notes')
        .insert({
          tenant_id: tenant_id!,
          ticket_id: id,
          author_id: req.user?.user_id,
          note_type,
          content,
        })
        .returning('*');
    }).then((rows) => rows as any[]);

    res.status(201).json({ data: note });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambah catatan' });
  }
});
