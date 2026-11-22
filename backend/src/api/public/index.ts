import { Router, Request, Response } from 'express';
import db from '@models/index';
import { withTenantContext } from '@middleware/AuthMiddleware';
import { generateBookingCode, generateTrackingCode } from '@utils/code';
import { logBookingEvent } from '@repositories/bookingTimelineRepo';
import { nextDropoffQueueNumber } from '@services/bookingQueueService';
import { notifyBookingCreated } from '@services/notifications/events';
import { getTrackingByCode } from '@repositories/trackingRepo';
import { normalizePickupArea, normalizePickupCoordinate, normalizePickupTime } from '@utils/booking';
import { computePickupFeeFromCoordinates, computePickupFeeSnapshot } from '@utils/pickup-fee';
import { ensureBookingSlots } from '@services/bookingSlotService';
import { findOrCreateCustomerByPhone } from '@services/customerService';
import { encryptSecretField } from '@utils/secretField';
import { notifyTicketStatusChanged } from '@services/notifications/events';
import { decideQuotation } from '@services/quotationWorkflow';
import { hashQuotationToken } from '@utils/quotationToken';
import { transitionQuotationPartRequests } from '@services/partRequests';

export const publicRouter = Router();

const METHOD_MAP: Record<string, string> = {
  mandiri: 'dropoff',
  terjadwal: 'pickup_only',
  antar_jemput: 'pickup_delivery',
  dropoff: 'dropoff',
  pickup_only: 'pickup_only',
  pickup_delivery: 'pickup_delivery',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WITA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' });
const MONTH_RE = /^\d{4}-\d{2}$/;
const QUOTATION_TOKEN_RE = /^(?:[A-F0-9]{48}|[A-F0-9]{64})$/i;

async function resolveQuotationTenant(token: string): Promise<string | null> {
  const result = await db.raw('SELECT public.resolve_tenant_by_quotation_token(?) AS id', [hashQuotationToken(token)]);
  return result.rows?.[0]?.id ?? null;
}

function isoWeekday(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

// GET /api/public/capacity - kapasitas booking untuk tenant dan cabang publik aktif
publicRouter.get('/capacity', async (req: Request, res: Response) => {
  try {
    const slug = String(req.query.slug || '');
    const month = String(req.query.month || WITA_DATE.format(new Date()).slice(0, 7));
    const monthNumber = Number(month.slice(5, 7));
    if (!slug || !MONTH_RE.test(month) || monthNumber < 1 || monthNumber > 12) {
      res.status(400).json({ error: 'slug dan month yang valid wajib diisi' });
      return;
    }

    const tenantRes = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [slug]);
    const tenantId: string | null = tenantRes.rows?.[0]?.id ?? null;
    if (!tenantId) {
      res.status(404).json({ error: 'Toko tidak ditemukan' });
      return;
    }

    const firstDate = `${month}-01`;
    const lastDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
      .toISOString()
      .slice(0, 10);
    const today = WITA_DATE.format(new Date());

    const data = await withTenantContext(tenantId, async (trx) => {
      const branch = await trx('branches')
        .where({ tenant_id: tenantId, is_active: true })
        .orderBy([{ column: 'is_main', order: 'desc' }, { column: 'created_at', order: 'asc' }])
        .first();
      if (!branch) return null;

      const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
      await ensureBookingSlots(trx, tenantId, branch.id, firstDate, daysInMonth);

      const hours = await trx('tenant_operating_hours').where({ tenant_id: tenantId }).select('weekday', 'open_time', 'close_time');
      const hoursByWeekday = new Map(hours.map((day) => [Number(day.weekday), day]));
      const slots = await trx('booking_slots')
        .where({ 'booking_slots.tenant_id': tenantId, 'booking_slots.branch_id': branch.id })
        .whereBetween('booking_slots.slot_date', [firstDate, lastDate])
        .leftJoin('booking_calendar_exceptions', function () {
          this.on('booking_calendar_exceptions.branch_id', '=', 'booking_slots.branch_id')
            .andOn('booking_calendar_exceptions.slot_date', '=', 'booking_slots.slot_date');
        })
        .select('booking_slots.slot_date', 'booking_slots.capacity', 'booking_slots.booked_count', 'booking_slots.is_open')
        .select(
          'booking_calendar_exceptions.status as exception_status',
          'booking_calendar_exceptions.title as exception_title',
        )
        .orderBy('booking_slots.slot_date', 'asc');
      const slotsWithHours = slots.map((slot) => {
        const day = hoursByWeekday.get(isoWeekday(String(slot.slot_date).slice(0, 10)));
        return { ...slot, open_time: day?.open_time ?? null, close_time: day?.close_time ?? null };
      });

      const todaySlot = await trx('booking_slots')
        .where({ tenant_id: tenantId, branch_id: branch.id, slot_date: today })
        .select('capacity', 'booked_count')
        .first();

      const [turnaround] = await trx('service_tickets')
        .where({ tenant_id: tenantId, branch_id: branch.id })
        .whereNotNull('completed_at')
        .select(trx.raw('COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400), 0) AS days'));

      const [sla] = await trx('service_tickets')
        .where({ tenant_id: tenantId, branch_id: branch.id })
        .whereNotNull('completed_at')
        .whereNotNull('estimated_done_at')
        .select(trx.raw('COUNT(*) FILTER (WHERE completed_at <= estimated_done_at) AS on_time, COUNT(*) AS total'));

      return {
        branch: { id: branch.id, name: branch.name, address: branch.address ?? null },
         slots: slotsWithHours,
        today: todaySlot ?? null,
        average_turnaround_days: Number(turnaround?.days || 0),
        on_time_rate: Number(sla?.total || 0) ? Number(sla.on_time || 0) / Number(sla.total) : null,
      };
    });

    if (!data) {
      res.status(404).json({ error: 'Cabang aktif tidak ditemukan' });
      return;
    }
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Gagal mengambil kapasitas booking' });
  }
});

// GET /api/public/tenant/:slug
publicRouter.get('/tenant/:slug', async (req: Request, res: Response) => {
  try {
    const r = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [req.params.slug]);
    const id = r.rows?.[0]?.id;
    if (!id) {
      res.status(404).json({ error: 'Toko tidak ditemukan' });
      return;
    }
    const branch = await withTenantContext(id, async (trx) => {
      const result = await trx('branches')
        .where({ tenant_id: id, is_active: true })
        .orderBy([{ column: 'is_main', order: 'desc' }, { column: 'created_at', order: 'asc' }])
        .select('id', 'name', 'address')
        .first();
      return result ?? null;
    });
    res.json({ data: { tenant_id: id, slug: req.params.slug, branch } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/public/quotations/:token - public, read-only customer approval page data
publicRouter.get('/quotations/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? '');
    if (!QUOTATION_TOKEN_RE.test(token)) {
      res.status(400).json({ error: 'Tautan persetujuan tidak valid' });
      return;
    }
    const tenantId = await resolveQuotationTenant(token);
    if (!tenantId) {
      res.status(404).json({ error: 'Quotation tidak ditemukan' });
      return;
    }

    const quotation = await withTenantContext(tenantId, async (trx) => {
      const quote = await trx('quotations as q')
        .join('service_tickets as t', 't.id', 'q.ticket_id')
        .join('customers as c', 'c.id', 't.customer_id')
        .where({ 'q.tenant_id': tenantId, 'q.approval_token_hash': hashQuotationToken(token) })
        .select(
          'q.id', 'q.status', 'q.total_amount', 'q.expires_at', 'q.decided_at', 'q.decision_note',
          'q.technician_diagnosis_snapshot as technician_diagnosis',
          't.ticket_code', 't.complaint', 't.work_type',
          'c.name as customer_name'
        )
        .first();
      if (!quote) return null;
      const devDraftPreview = process.env.NODE_ENV === 'development' && quote.status === 'draft';
      if ((!devDraftPreview && quote.status !== 'sent') || new Date(quote.expires_at).getTime() <= Date.now()) {
        if (quote.status === 'sent') {
          const ticketRef = await trx('quotations').where({ id: quote.id, tenant_id: tenantId }).select('ticket_id').first();
          await trx('quotations').where({ id: quote.id, tenant_id: tenantId, status: 'sent' }).update({ status: 'expired', decided_at: new Date(), decision_note: 'Tautan persetujuan kedaluwarsa' });
          await transitionQuotationPartRequests(trx, {
            tenantId, quotationId: quote.id, to: 'CANCELLED', reason: 'Quotation kedaluwarsa',
          });
          await trx('audit_logs').insert({
            tenant_id: tenantId,
            action: 'quotation.expired',
            entity_type: 'quotation',
            entity_id: quote.id,
            ticket_id: ticketRef?.ticket_id ?? null,
            quotation_id: quote.id,
            actor_type: 'system',
            old_values: { status: 'sent' },
            new_values: { status: 'expired', ticket_code: quote.ticket_code },
          });
        }
        return null;
      }
      const items = await trx('quotation_items as item')
        .leftJoin('parts as part', 'part.id', 'item.part_id')
        .where({ 'item.tenant_id': tenantId, 'item.quotation_id': quote.id })
        .select(
          'item.id', 'item.part_id', 'item.item_type', 'item.description', 'item.qty',
          'item.unit_price', 'item.subtotal', 'item.damage_description', 'item.labor_cost', 'item.part_cost',
          'item.part_name_snapshot', 'item.part_specification_snapshot', 'item.part_is_registered',
          'item.availability_status', 'item.available_qty_snapshot', 'item.estimated_part_arrival_days',
          trx.raw('COALESCE(part.name, item.part_name_snapshot) as part_name'), 'part.sku as part_sku'
        )
        .orderBy('item.created_at', 'asc');
      return {
        ...quote,
        quotation_number: `QUO-${quote.id.slice(0, 8).toUpperCase()}`,
        is_expired: false,
        items,
      };
    });

    if (!quotation) {
      res.status(404).json({ error: 'Quotation tidak ditemukan' });
      return;
    }
    res.json({ data: quotation });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat quotation' });
  }
});

// POST /api/public/quotations/:token/decision - customer approves or rejects once
publicRouter.post('/quotations/:token/decision', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token ?? '');
    const decision = req.body?.decision;
    const note = String(req.body?.note ?? '').trim();
    if (!QUOTATION_TOKEN_RE.test(token) || !['approve', 'reject'].includes(decision) || note.length > 500) {
      res.status(400).json({ error: 'Pilihan persetujuan tidak valid' });
      return;
    }
    const tenantId = await resolveQuotationTenant(token);
    if (!tenantId) {
      res.status(404).json({ error: 'Quotation tidak ditemukan' });
      return;
    }

    const result = await withTenantContext(tenantId, (trx) => decideQuotation(trx, {
      tenantId,
      approvalTokenHash: hashQuotationToken(token),
      decision: decision === 'approve' ? 'approved' : 'rejected',
      note,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }));
    if (result.expired) {
      res.status(410).json({ error: 'Tautan persetujuan quotation sudah kedaluwarsa' });
      return;
    }

    if (result.ticket.current_status !== result.ticketStatus && result.customerPhone) {
      const statusNotification = await notifyTicketStatusChanged({
        tenantId,
        customerId: result.ticket.customer_id,
        phone: result.customerPhone,
        ticketId: result.ticket.id,
        trackingCode: result.ticket.tracking_code,
        previousStatus: result.ticket.current_status,
        status: result.ticketStatus,
        details: result.partShortages?.map((part: any) => `${part.part_name}: kurang ${part.shortage_qty} (tersedia ${part.available_qty}/${part.required_qty})`).join('\n'),
      });
      await withTenantContext(tenantId, (trx) => trx('audit_logs').insert({
        tenant_id: tenantId, action: 'ticket.status_notification', entity_type: 'service_ticket',
        entity_id: result.ticket.id, ticket_id: result.ticket.id, quotation_id: result.quotation.id,
        notification_id: 'id' in statusNotification ? statusNotification.id : null, actor_type: 'system',
        new_values: { status: result.ticketStatus, notification_status: statusNotification.status, provider_message_id: 'providerMessageId' in statusNotification ? statusNotification.providerMessageId ?? null : null },
      }));
    }
    const safeQuotation = { ...result.quotation };
    delete safeQuotation.approval_token;
    delete safeQuotation.approval_token_hash;
    res.json({ data: { quotation: safeQuotation, ticket_status: result.ticketStatus } });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal menyimpan keputusan quotation' });
  }
});

// GET /api/public/track/:code - legacy path, tetap memakai nomor resi customer
publicRouter.get('/track/:code', async (req: Request, res: Response) => {
  try {
    const data = await getTrackingByCode(req.params.code);
    if (!data) {
      res.status(404).json({ error: 'Nomor resi tidak ditemukan' });
      return;
    }
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/bookings
publicRouter.post('/bookings', async (req: Request, res: Response) => {
  try {
        const {
          slug,
          name,
           phone_wa,
           category,
           model,
          complaint,
          symptoms,
           service_method,
           device_pin,
           device_pin_refused,
           slot_date,
           pickup_time,
           pickup_area,
           pickup_address,
           pickup_latitude,
           pickup_longitude,
         } = req.body ?? {};

    console.debug('[Booking] POST /api/public/bookings payload', {
      ...req.body,
      phone_wa: req.body?.phone_wa ? '[redacted]' : undefined,
      device_pin: req.body?.device_pin ? '[redacted]' : undefined,
    });

    const customerName = String(name || '').trim();
    if (!slug || !customerName || !phone_wa || !service_method) {
      console.warn('[Booking] request validation failed', { slug: Boolean(slug), name: Boolean(name), phone_wa: Boolean(phone_wa), service_method });
      res.status(400).json({ error: 'slug, name, phone_wa, service_method wajib diisi' });
      return;
    }

    if (typeof model !== 'string' || !model.trim() || model.trim() === '-' || model.length > 80) {
      res.status(400).json({ error: 'Model perangkat wajib diisi (maksimal 80 karakter)' });
      return;
    }

    const tenantRes = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [slug]);
    const tenantId: string | null = tenantRes.rows?.[0]?.id ?? null;
    if (!tenantId) {
      res.status(404).json({ error: 'Toko tidak ditemukan' });
      return;
    }

    const method = METHOD_MAP[service_method] ?? 'dropoff';
    if (device_pin !== undefined && typeof device_pin !== 'string') {
      throw Object.assign(new Error('PIN / password tidak valid'), { status: 400 });
    }
    const devicePin = typeof device_pin === 'string' ? device_pin.trim() : '';
    const pinRefused = device_pin_refused === true;
    if (device_pin_refused !== undefined && typeof device_pin_refused !== 'boolean') {
      throw Object.assign(new Error('Pilihan PIN tidak valid'), { status: 400 });
    }
    if (devicePin.length > 128 || (method !== 'dropoff' && (
      (pinRefused && devicePin) ||
      (!pinRefused && (devicePin.length < 4 || devicePin.length > 128))
    ))) {
      throw Object.assign(new Error('Isi PIN / password atau pilih pelanggan menolak memberi PIN'), { status: 400 });
    }
      const slotDate = DATE_RE.test(slot_date || '') ? slot_date : WITA_DATE.format(new Date());
    const todayDate = new Date(`${WITA_DATE.format(new Date())}T00:00:00Z`);
    const bookingEndDate = new Date(todayDate);
    bookingEndDate.setUTCDate(bookingEndDate.getUTCDate() + 5);
    const bookingEnd = bookingEndDate.toISOString().slice(0, 10);
    if (slotDate < WITA_DATE.format(new Date()) || slotDate > bookingEnd) {
      throw Object.assign(new Error('Tanggal booking hanya tersedia dari hari ini sampai 5 hari ke depan'), { status: 400 });
    }
    const pickupTimeSafe = normalizePickupTime(pickup_time);
    const pickupAreaSafe = normalizePickupArea(pickup_area);
    const pickupAddressSafe = pickup_address === undefined ? null : String(pickup_address).trim().slice(0, 500) || null;
    const pickupLatitudeSafe = normalizePickupCoordinate(pickup_latitude, 'pickup_latitude', -90, 90);
    const pickupLongitudeSafe = normalizePickupCoordinate(pickup_longitude, 'pickup_longitude', -180, 180);
    if (method !== 'dropoff' && (!pickupAddressSafe || pickupLatitudeSafe === null || pickupLongitudeSafe === null)) {
      throw Object.assign(new Error('Lokasi penjemputan wajib dipilih'), { status: 400 });
    }
    const pickupFeeSnapshot = pickupLatitudeSafe !== null && pickupLongitudeSafe !== null
      ? await computePickupFeeFromCoordinates(method, pickupLatitudeSafe, pickupLongitudeSafe)
      : computePickupFeeSnapshot(method, pickupAreaSafe);
    const gejala = Array.isArray(symptoms) ? symptoms.join(', ') : '';
    const fullComplaint =
      [complaint, gejala && `Gejala: ${gejala}`].filter(Boolean).join(' | ') || 'Tanpa keluhan';
    const categorySafe = String(category || 'lainnya').slice(0, 30);

    const result = await withTenantContext(tenantId, async (trx) => {
      let branch = await trx('branches').where({ tenant_id: tenantId, is_main: true }).first();
      if (!branch) branch = await trx('branches').where({ tenant_id: tenantId }).orderBy('created_at', 'asc').first();
      if (!branch) {
        [branch] = await trx('branches')
          .insert({ tenant_id: tenantId, name: 'Cabang Utama', is_main: true, is_active: true })
          .returning('*');
      }

      await ensureBookingSlots(trx, tenantId, branch.id);

      const customer = await findOrCreateCustomerByPhone(trx, tenantId, customerName, phone_wa);

      const [device] = await trx('devices').insert({
        tenant_id: tenantId,
        customer_id: customer.id,
        category: categorySafe,
        model,
      }).returning('*');

      let slot = await trx('booking_slots')
        .where({ tenant_id: tenantId, branch_id: branch.id, slot_date: slotDate })
        .forUpdate()
        .first();
      if (!slot) {
        slot = await trx('booking_slots').where({ tenant_id: tenantId, branch_id: branch.id, slot_date: slotDate }).forUpdate().first();
      }
      if (!slot?.is_open) throw Object.assign(new Error('Slot tidak tersedia'), { status: 409 });
      if (slot.booked_count >= slot.capacity)
        throw Object.assign(new Error('Kuota slot harian penuh'), { status: 409 });

      if (method !== 'dropoff') {
        const weekday = isoWeekday(String(slot.slot_date).slice(0, 10));
        const hours = await trx('tenant_operating_hours').where({ tenant_id: tenantId, weekday }).first();
        if (hours) {
          const openTime = String(hours.open_time ?? '').slice(0, 5);
          const closeTime = String(hours.close_time ?? '').slice(0, 5);
          const selectedTime = String(pickupTimeSafe ?? '').slice(0, 5);
          if (!/^\d{2}:\d{2}$/.test(selectedTime) || selectedTime < openTime || selectedTime > closeTime) {
            throw Object.assign(new Error('Waktu penjemputan harus berada dalam jam operasional workshop'), { status: 400 });
          }
        }
      }

      console.debug('[Booking] slot resolved', {
        slot_id: slot.id,
        slot_date: slot.slot_date,
        capacity: slot.capacity,
        booked_count: slot.booked_count,
      });

      const queueNumber = method === 'dropoff'
        ? await nextDropoffQueueNumber(trx, branch.id, slot.id)
        : null;
      const tenant = await trx('tenants').where({ id: tenantId }).select('tracking_prefix').first();
      if (!tenant) throw Object.assign(new Error('Tenant tidak ditemukan'), { status: 404 });

      const [booking] = await trx('bookings')
        .insert({
          tenant_id: tenantId,
          branch_id: branch.id,
          slot_id: slot.id,
          customer_id: customer.id,
          customer_name: customerName,
          customer_phone: phone_wa,
          device_id: device.id,
          booking_code: generateBookingCode(),
          tracking_code: generateTrackingCode(tenant.tracking_prefix),
          queue_number: queueNumber,
           service_method: method,
           device_pin_enc: method !== 'dropoff' && !pinRefused ? encryptSecretField(devicePin) : null,
           device_pin_refused: method !== 'dropoff' && pinRefused,
           complaint: fullComplaint,
          pickup_time: pickupTimeSafe,
           pickup_area: pickupAreaSafe,
           pickup_address: pickupAddressSafe,
           pickup_latitude: pickupLatitudeSafe,
           pickup_longitude: pickupLongitudeSafe,
          pickup_fee: pickupFeeSnapshot,
          status: 'booked',
        })
        .returning('*');

      console.info('[Booking] database insert succeeded', {
        booking_id: booking.id,
        booking_code: booking.booking_code,
        slot_id: booking.slot_id,
      });

      await trx('booking_slots').where({ id: slot.id }).increment('booked_count', 1);

      // Timeline: Booking Servis Berhasil Dibuat
      await logBookingEvent(
        {
          tenant_id: tenantId,
          booking_id: booking.id,
          event_code: 'BOOKING_CREATED',
          to_status: 'booked',
          actor_type: 'customer',
          note: 'Booking servis berhasil dibuat',
          meta: { booking_code: booking.booking_code, service_method: booking.service_method },
        },
        trx
      );

      // Timeline: Permintaan Pickup Diterima + Pickup Dijadwalkan
      if (booking.service_method === 'pickup_only' || booking.service_method === 'pickup_delivery') {
        await logBookingEvent(
          {
            tenant_id: tenantId,
            booking_id: booking.id,
            event_code: 'PICKUP_REQUESTED',
            actor_type: 'customer',
            note: 'Permintaan pickup diterima',
            meta: { service_method: booking.service_method },
          },
          trx
        );

        await logBookingEvent(
          {
            tenant_id: tenantId,
            booking_id: booking.id,
            event_code: 'PICKUP_SCHEDULED',
            actor_type: 'system',
            note: 'Pickup dijadwalkan',
            meta: {
              slot_date: slot.slot_date,
              pickup_time: pickupTimeSafe,
         pickup_area: pickupAreaSafe,
         pickup_address: pickupAddressSafe,
         pickup_latitude: pickupLatitudeSafe,
         pickup_longitude: pickupLongitudeSafe,
              pickup_fee: pickupFeeSnapshot,
            },
          },
          trx
        );
      }

       return { booking, slot, customerPhone: customer.phone_wa };
     });

    void notifyBookingCreated({
      tenantId,
      customerId: result.booking.customer_id,
      bookingId: result.booking.id,
      phone: result.customerPhone,
      serviceMethod: result.booking.service_method,
      trackingCode: result.booking.tracking_code,
      queueNumber: result.booking.queue_number,
      bookingDate: result.slot.slot_date,
    });

    res.status(201).json({
      message: 'Booking berhasil dibuat',
      data: {
        booking_code: result.booking.booking_code,
        tracking_code: result.booking.tracking_code,
        queue_number: result.booking.queue_number,
        slot_date: result.slot.slot_date,
        service_method: result.booking.service_method,
        pickup_area: pickupAreaSafe,
        pickup_time: pickupTimeSafe,
        pickup_fee: pickupFeeSnapshot,
        capacity: result.slot.capacity,
        booked_count: result.slot.booked_count + 1,
      },
    });
  } catch (e: any) {
    console.error('[Booking] POST /api/public/bookings failed', {
      status: e.status || 500,
      message: e.message,
      code: e.code,
      detail: e.detail,
    });
    res.status(e.status || 500).json({ error: e.message || 'Gagal membuat booking' });
  }
});
