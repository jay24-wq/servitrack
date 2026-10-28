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
        branch: { id: branch.id, name: branch.name },
        slots,
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
    res.json({ data: { tenant_id: id, slug: req.params.slug } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
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
          brand,
          model,
          serial_number,
          complaint,
          symptoms,
          service_method,
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
    });

    const customerName = String(name || '').trim();
    if (!slug || !customerName || !phone_wa || !service_method) {
      console.warn('[Booking] request validation failed', { slug: Boolean(slug), name: Boolean(name), phone_wa: Boolean(phone_wa), service_method });
      res.status(400).json({ error: 'slug, name, phone_wa, service_method wajib diisi' });
      return;
    }

    const tenantRes = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [slug]);
    const tenantId: string | null = tenantRes.rows?.[0]?.id ?? null;
    if (!tenantId) {
      res.status(404).json({ error: 'Toko tidak ditemukan' });
      return;
    }

    const method = METHOD_MAP[service_method] ?? 'dropoff';
      const slotDate = DATE_RE.test(slot_date || '') ? slot_date : WITA_DATE.format(new Date());
    const todayDate = new Date(`${WITA_DATE.format(new Date())}T00:00:00Z`);
    const bookingEndDate = new Date(todayDate);
    bookingEndDate.setUTCDate(bookingEndDate.getUTCDate() + 5);
    const bookingEnd = bookingEndDate.toISOString().slice(0, 10);
    const slotWeekday = new Date(`${slotDate}T00:00:00Z`).getUTCDay();
    if (slotDate < WITA_DATE.format(new Date()) || slotDate > bookingEnd || slotWeekday === 0) {
      throw Object.assign(new Error('Tanggal booking hanya tersedia dari hari ini sampai 5 hari ke depan, kecuali Minggu'), { status: 400 });
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
    const brandSafe = String(brand || model || '-').slice(0, 50);
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

      let device = serial_number
        ? await trx('devices').where({ tenant_id: tenantId, customer_id: customer.id, serial_number }).first()
        : null;
      if (!device) {
        [device] = await trx('devices').insert({
          tenant_id: tenantId,
          customer_id: customer.id,
          category: categorySafe,
          brand: brandSafe,
          model: model || null,
          serial_number: serial_number || null,
        }).returning('*');
      }

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

      console.debug('[Booking] slot resolved', {
        slot_id: slot.id,
        slot_date: slot.slot_date,
        capacity: slot.capacity,
        booked_count: slot.booked_count,
      });

      const queueNumber = method === 'dropoff'
        ? await nextDropoffQueueNumber(trx, branch.id, slot.id)
        : null;

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
          tracking_code: generateTrackingCode(),
          queue_number: queueNumber,
          service_method: method,
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
