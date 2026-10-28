import { Router, Response } from 'express';
import db from '@models/index';
import { authMiddleware, AuthRequest, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { generateBookingCode, generateTrackingCode } from '@utils/code';
import { normalizePickupArea, normalizePickupTime } from '@utils/booking';
import { computePickupFeeSnapshot } from '@utils/pickup-fee';
import { logBookingEvent } from '@repositories/bookingTimelineRepo';
import { nextDropoffQueueNumber } from '@services/bookingQueueService';
import { notifyBookingCreated } from '@services/notifications/events';
import { ensureBookingSlots } from '@services/bookingSlotService';

export const bookingRouter = Router();

bookingRouter.use(authMiddleware);
bookingRouter.use(tenantResolver);

// GET /api/bookings - List booking
bookingRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const query = reqDb(req);
    const bookings = await query('bookings')
      .where({ 'bookings.tenant_id': tenant_id })
      .leftJoin('customers', 'bookings.customer_id', 'customers.id')
      .leftJoin('devices', 'bookings.device_id', 'devices.id')
      .leftJoin('booking_slots', 'bookings.slot_id', 'booking_slots.id')
      .select(
        'bookings.*',
        query.raw('COALESCE(bookings.customer_name, customers.name) as customer_name'),
        query.raw('COALESCE(bookings.customer_phone, customers.phone_wa) as phone_wa'),
        'devices.category as device_category',
        'devices.brand as device_brand',
        'devices.model as device_model',
        'devices.serial_number as device_serial',
        'booking_slots.slot_date',
        'bookings.pickup_time',
        'bookings.pickup_area',
        'bookings.pickup_fee'
      )
      .orderBy('bookings.created_at', 'desc');
    res.json({ data: bookings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data booking' });
  }
});

// POST /api/bookings - Create booking
bookingRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { branch_id, customer_id, device_id, slot_id, service_method, complaint } = req.body;

    if (!branch_id || !customer_id || !device_id || !slot_id || !service_method) {
      res.status(400).json({ error: 'branch_id, customer_id, device_id, slot_id, service_method wajib diisi' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      await ensureBookingSlots(trx, tenant_id, branch_id);

      // Cek ketersediaan slot
      const slot = await trx('booking_slots')
        .where({ id: slot_id, tenant_id, branch_id })
        .forUpdate()
        .first();

      if (!slot) {
        throw new Error('Slot booking tidak ditemukan');
      }
      if (!slot.is_open) {
        throw new Error('Slot tidak tersedia');
      }
      if (slot.booked_count >= slot.capacity) {
        throw new Error('Kuota slot harian sudah penuh');
      }

      const customer = await trx('customers')
        .where({ id: customer_id, tenant_id })
        .select('id', 'name', 'phone_wa')
        .first();
      if (!customer) throw Object.assign(new Error('Customer tidak ditemukan'), { status: 404 });

      const queueNumber = service_method === 'dropoff'
        ? await nextDropoffQueueNumber(trx, branch_id, slot.id)
        : null;

      // Buat booking
      const [booking] = await trx('bookings')
        .insert({
          tenant_id,
          branch_id,
           slot_id,
           customer_id,
           customer_name: customer.name,
           customer_phone: customer.phone_wa,
           device_id,
          booking_code: generateBookingCode(),
          tracking_code: generateTrackingCode(),
          queue_number: queueNumber,
          service_method,
          complaint: complaint || '',
          pickup_time: null,
          pickup_area: null,
          pickup_fee: computePickupFeeSnapshot(service_method, null),
          status: 'booked',
        })
        .returning('*');

      // Update booked_count
      await trx('booking_slots')
        .where({ id: slot_id })
        .increment('booked_count', 1);

      // Timeline: Booking Servis Berhasil Dibuat
      await logBookingEvent(
        {
          tenant_id,
          booking_id: booking.id,
          event_code: 'BOOKING_CREATED',
          to_status: 'booked',
          actor_id: req.user?.user_id ?? null,
          actor_type: 'frontdesk',
          note: 'Booking servis berhasil dibuat',
          meta: { booking_code: booking.booking_code, service_method: booking.service_method },
        },
        trx
      );

      // Timeline: Permintaan Pickup Diterima (hanya untuk metode pickup)
      if (service_method === 'pickup_only' || service_method === 'pickup_delivery') {
        await logBookingEvent(
          {
            tenant_id,
            booking_id: booking.id,
            event_code: 'PICKUP_REQUESTED',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: 'Permintaan pickup diterima',
            meta: { service_method: booking.service_method },
          },
          trx
        );

        await logBookingEvent(
          {
            tenant_id,
            booking_id: booking.id,
            event_code: 'PICKUP_SCHEDULED',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'system',
            note: 'Pickup dijadwalkan',
            meta: { slot_id },
          },
          trx
        );
      }

      return { booking, customerPhone: customer.phone_wa, slotDate: slot.slot_date };
    });

    void notifyBookingCreated({
      tenantId: tenant_id,
      customerId: result.booking.customer_id,
      phone: result.customerPhone,
      serviceMethod: result.booking.service_method,
      trackingCode: result.booking.tracking_code,
      queueNumber: result.booking.queue_number,
      bookingDate: result.slotDate,
    });

    res.status(201).json({ message: 'Booking berhasil dibuat', data: result.booking });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat booking' });
  }
});

// PUT /api/bookings/:id - Update booking
bookingRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { status, scheduled_at, notes, pickup_time, pickup_area, service_method, pickup_confirmed } = req.body;

    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const pickupTimeSafe = pickup_time === undefined ? undefined : normalizePickupTime(pickup_time);
    const pickupAreaSafe = pickup_area === undefined ? undefined : normalizePickupArea(pickup_area);

    const result = await withTenantContext(tenant_id, async (trx) => {
      const existing = await trx('bookings').where({ id, tenant_id }).first();
      if (!existing) {
        throw Object.assign(new Error('Booking tidak ditemukan'), { status: 404 });
      }

      const methodChanged =
        service_method !== undefined && service_method !== existing.service_method;
      const areaChanged =
        pickupAreaSafe !== undefined && pickupAreaSafe !== existing.pickup_area;
      const nextPickupArea =
        pickupAreaSafe !== undefined ? pickupAreaSafe : existing.pickup_area;
      const nextPickupFee =
        methodChanged || areaChanged
          ? computePickupFeeSnapshot(service_method ?? existing.service_method, nextPickupArea)
          : undefined;

      const [updated] = await trx('bookings')
        .where({ id, tenant_id })
        .update({
          ...(status && { status }),
          ...(scheduled_at !== undefined && { scheduled_at: scheduled_at ? new Date(scheduled_at) : null }),
          ...(notes !== undefined && { notes }),
          ...(pickupTimeSafe !== undefined && { pickup_time: pickupTimeSafe }),
          ...(pickupAreaSafe !== undefined && { pickup_area: pickupAreaSafe }),
          ...(nextPickupFee !== undefined && { pickup_fee: nextPickupFee }),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      // Timeline: Pickup dikonfirmasi
      if (pickup_confirmed === true) {
        const alreadyConfirmed = await trx('booking_status_logs')
          .where({ booking_id: id, event_code: 'PICKUP_CONFIRMED' })
          .first();

        if (!alreadyConfirmed) {
          await logBookingEvent(
            {
              tenant_id,
              booking_id: id,
              event_code: 'PICKUP_CONFIRMED',
              from_status: existing.status,
              to_status: existing.status,
              actor_id: req.user?.user_id ?? null,
              actor_type: 'frontdesk',
              note: notes || 'Pickup dikonfirmasi',
              meta: { booking_code: existing.booking_code },
            },
            trx
          );
        }
      }

      // Timeline: Unit Diterima Cabang
      if (status === 'arrived' && existing.status !== 'arrived') {
        await logBookingEvent(
          {
            tenant_id,
            booking_id: id,
            event_code: 'UNIT_RECEIVED',
            from_status: existing.status,
            to_status: 'arrived',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: 'Unit diterima cabang',
            meta: { booking_code: existing.booking_code },
          },
          trx
        );
      }

      // Timeline: Booking dibatalkan / tidak hadir
      if (status === 'cancelled' && existing.status !== 'cancelled') {
        await logBookingEvent(
          {
            tenant_id,
            booking_id: id,
            event_code: 'BOOKING_CANCELLED',
            from_status: existing.status,
            to_status: 'cancelled',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: notes || 'Booking dibatalkan',
            meta: { booking_code: existing.booking_code },
          },
          trx
        );
      }

      if (status === 'no_show' && existing.status !== 'no_show') {
        await logBookingEvent(
          {
            tenant_id,
            booking_id: id,
            event_code: 'NO_SHOW',
            from_status: existing.status,
            to_status: 'no_show',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: notes || 'Customer tidak hadir',
            meta: { booking_code: existing.booking_code },
          },
          trx
        );
      }

      // Timeline: Pickup dijadwalkan ulang
      if (pickupTimeSafe && existing.pickup_time !== pickupTimeSafe) {
        await logBookingEvent(
          {
            tenant_id,
            booking_id: id,
            event_code: 'PICKUP_SCHEDULED',
            actor_id: req.user?.user_id ?? null,
            actor_type: 'frontdesk',
            note: 'Pickup dijadwalkan',
            meta: {
          pickup_time: pickupTimeSafe,
          pickup_area: pickupAreaSafe !== undefined ? pickupAreaSafe : existing.pickup_area,
          ...(nextPickupFee !== undefined ? { pickup_fee: nextPickupFee } : {}),
        },
          },
          trx
        );
      }

      return updated;
    });

    res.json({ message: 'Booking berhasil diperbarui', data: result });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal memperbarui booking' });
  }
});

// DELETE /api/bookings/:id - Cancel/delete booking
bookingRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    const deleted = await db('bookings').where({ id, tenant_id }).delete();
    if (!deleted) {
      res.status(404).json({ error: 'Booking tidak ditemukan' });
      return;
    }
    res.json({ message: 'Booking berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus booking' });
  }
});
