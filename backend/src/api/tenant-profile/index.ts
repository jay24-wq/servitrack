import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest, requireRole } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { syncBookingSlotOperatingHours } from '@services/bookingSlotService';
import { logAudit } from '@services/auditLog';

export const tenantProfileRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^628[1-9]\d{7,11}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WITA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' });

function normalizeIndonesianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

async function getOperationalSettings(query: any, tenantId: string) {
  const tenant = await query('tenants').where({ id: tenantId }).select('tracking_prefix', 'default_booking_capacity').first();
  const operatingHours = await query('tenant_operating_hours')
    .where({ tenant_id: tenantId })
    .select('weekday', 'is_open', 'open_time', 'close_time')
    .orderBy('weekday', 'asc');
  return {
    tracking_prefix: tenant?.tracking_prefix ?? null,
    default_booking_capacity: tenant?.default_booking_capacity ?? null,
    operating_hours: operatingHours,
  };
}

tenantProfileRouter.use(authMiddleware, requireRole('admin'), tenantResolver);

tenantProfileRouter.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });

    const profile = await reqDb(req)('tenants')
      .where({ id: tenantId })
      .select('name', 'description', 'phone', 'email', 'address', 'logo_data_url', 'latitude', 'longitude')
      .first();
    if (!profile) return res.status(404).json({ error: 'Profil workshop tidak ditemukan' });
    return res.json({ data: profile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil profil workshop' });
  }
});

tenantProfileRouter.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });

    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const phone = typeof body.phone === 'string' ? normalizeIndonesianPhone(body.phone) : '';
    const emailInput = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const latitude = body.latitude === null || body.latitude === undefined || body.latitude === '' ? Number.NaN : Number(body.latitude);
    const longitude = body.longitude === null || body.longitude === undefined || body.longitude === '' ? Number.NaN : Number(body.longitude);

    if (!name || name.length > 120) return res.status(400).json({ error: 'Nama workshop wajib diisi dan maksimal 120 karakter' });
    if (description.length > 1000) return res.status(400).json({ error: 'Deskripsi workshop maksimal 1000 karakter' });
    if (!PHONE_PATTERN.test(phone)) return res.status(400).json({ error: 'Masukkan nomor WhatsApp seluler Indonesia yang valid' });
    if (emailInput && (emailInput.length > 150 || !EMAIL_PATTERN.test(emailInput))) return res.status(400).json({ error: 'Format email workshop tidak valid' });
    if (!address || address.length > 500) return res.status(400).json({ error: 'Alamat workshop wajib diisi dan maksimal 500 karakter' });
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Pilih titik lokasi workshop yang valid pada peta' });
    }

    if (body.logo_data_url !== undefined && body.logo_data_url !== null && (
      typeof body.logo_data_url !== 'string' ||
      body.logo_data_url.length > 70000 ||
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(body.logo_data_url)
    )) {
      return res.status(400).json({ error: 'Logo harus berupa PNG, JPG, atau WebP dengan ukuran maksimal 70 KB setelah kompresi' });
    }

    const existing = await reqDb(req)('tenants')
      .where({ id: tenantId })
      .select('name', 'description', 'phone', 'email', 'address', 'latitude', 'longitude', 'logo_data_url')
      .first();
    if (!existing) return res.status(404).json({ error: 'Profil workshop tidak ditemukan' });

    const updateData: Record<string, unknown> = {
      name,
      description: description || null,
      phone,
      email: emailInput || null,
      address,
      latitude,
      longitude,
      updated_at: reqDb(req).fn.now(),
    };
    if (body.logo_data_url !== undefined) updateData.logo_data_url = body.logo_data_url;

    const [profile] = await reqDb(req)('tenants')
      .where({ id: tenantId })
      .update(updateData)
      .returning(['name', 'description', 'phone', 'email', 'address', 'logo_data_url', 'latitude', 'longitude']);
    if (!profile) return res.status(404).json({ error: 'Profil workshop tidak ditemukan' });
    await logAudit(reqDb(req), req, {
      action: 'settings.workshop_profile_updated',
      entityType: 'tenant_settings',
      entityId: tenantId,
      oldValues: { name: existing.name, description: existing.description, phone: existing.phone, email: existing.email, address: existing.address, latitude: existing.latitude, longitude: existing.longitude, logo_configured: Boolean(existing.logo_data_url) },
      newValues: { name: profile.name, description: profile.description, phone: profile.phone, email: profile.email, address: profile.address, latitude: profile.latitude, longitude: profile.longitude, logo_configured: Boolean(profile.logo_data_url), logo_changed: body.logo_data_url !== undefined },
    });
    return res.json({ message: 'Profil workshop berhasil diperbarui', data: profile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperbarui profil workshop' });
  }
});

const TRACKING_CONTACT_VISIBILITIES = ['full', 'masked', 'hidden'] as const;

tenantProfileRouter.get('/public-tracking', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const settings = await reqDb(req)('tenants')
      .where({ id: tenantId })
      .select('public_tracking_contact_visibility')
      .first();
    if (!settings) return res.status(404).json({ error: 'Pengaturan tracking publik tidak ditemukan' });
    return res.json({ data: { contact_visibility: settings.public_tracking_contact_visibility } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil pengaturan tracking publik' });
  }
});

tenantProfileRouter.put('/public-tracking', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const visibility = req.body?.contact_visibility;
    if (!TRACKING_CONTACT_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: 'Pilihan tampilan kontak petugas tidak valid' });
    }

    const query = reqDb(req);
    const previous = await query('tenants').where({ id: tenantId }).select('public_tracking_contact_visibility').first();
    const [updated] = await query('tenants')
      .where({ id: tenantId })
      .update({ public_tracking_contact_visibility: visibility, updated_at: query.fn.now() })
      .returning('public_tracking_contact_visibility');
    if (!updated) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    await logAudit(query, req, {
      action: 'settings.public_tracking_contact_updated',
      entityType: 'tenant_settings',
      entityId: tenantId,
      oldValues: { contact_visibility: previous?.public_tracking_contact_visibility ?? 'masked' },
      newValues: { contact_visibility: updated.public_tracking_contact_visibility },
    });
    return res.json({ message: 'Pengaturan tracking publik berhasil disimpan', data: { contact_visibility: updated.public_tracking_contact_visibility } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan pengaturan tracking publik' });
  }
});

tenantProfileRouter.get('/operational', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    return res.json({ data: await getOperationalSettings(reqDb(req), tenantId) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil pengaturan operasional' });
  }
});

tenantProfileRouter.put('/operational', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });

    const body = req.body ?? {};
    const trackingPrefix = typeof body.tracking_prefix === 'string' ? body.tracking_prefix.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(trackingPrefix)) return res.status(400).json({ error: 'Prefix tracking harus tepat 3 huruf A-Z' });
    const defaultBookingCapacity = Number(body.default_booking_capacity);
    if (!Number.isInteger(defaultBookingCapacity) || defaultBookingCapacity < 1 || defaultBookingCapacity > 10000) {
      return res.status(400).json({ error: 'Maksimal booking per hari harus berupa bilangan bulat positif' });
    }
    if (!Array.isArray(body.operating_hours) || body.operating_hours.length > 7) {
      return res.status(400).json({ error: 'Pengaturan jam operasional tidak valid' });
    }

    const query = reqDb(req);
    const oldSettings = await getOperationalSettings(query, tenantId);

    const seenWeekdays = new Set<number>();
    const hours = [];
    for (const day of body.operating_hours) {
      const weekday = Number(day.weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || seenWeekdays.has(weekday) || typeof day.is_open !== 'boolean') {
        return res.status(400).json({ error: 'Data hari operasional tidak valid' });
      }
      const openTime = day.open_time === null || day.open_time === '' ? null : day.open_time;
      const closeTime = day.close_time === null || day.close_time === '' ? null : day.close_time;
      if ((openTime !== null && (typeof openTime !== 'string' || !TIME_PATTERN.test(openTime))) ||
          (closeTime !== null && (typeof closeTime !== 'string' || !TIME_PATTERN.test(closeTime)))) {
        return res.status(400).json({ error: 'Jam operasional harus menggunakan format HH:mm' });
      }
      if ((openTime === null) !== (closeTime === null) || (openTime !== null && closeTime !== null && openTime >= closeTime)) {
        return res.status(400).json({ error: 'Jam tutup harus setelah jam buka dan keduanya harus diisi berpasangan' });
      }
      if (day.is_open && (openTime === null || closeTime === null)) {
        return res.status(400).json({ error: 'Jam buka dan jam tutup wajib diisi untuk hari yang buka' });
      }
      seenWeekdays.add(weekday);
      hours.push({ tenant_id: tenantId, weekday, is_open: day.is_open, open_time: openTime, close_time: closeTime, updated_at: new Date() });
    }
    const hasCalendarException = () => query('booking_calendar_exceptions as exception')
      .select(query.raw('1'))
      .whereRaw('exception.tenant_id = slots.tenant_id')
      .whereRaw('exception.branch_id = slots.branch_id')
      .whereRaw('exception.slot_date = slots.slot_date');
    const overCapacity = await query('booking_slots as slots')
      .where('slots.tenant_id', tenantId)
      .where('slots.slot_date', '>=', WITA_DATE.format(new Date()))
      .where('slots.booked_count', '>', defaultBookingCapacity)
      .whereNotExists(hasCalendarException())
      .select('slots.slot_date', 'slots.booked_count')
      .first();
    if (overCapacity) {
      return res.status(409).json({ error: 'Kapasitas tidak dapat di bawah jumlah booking yang sudah tercatat pada tanggal mendatang' });
    }

    const [tenant] = await query('tenants')
      .where({ id: tenantId })
      .update({ tracking_prefix: trackingPrefix, default_booking_capacity: defaultBookingCapacity, updated_at: query.fn.now() })
      .returning('id');
    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

    if (hours.length) {
      await query('tenant_operating_hours')
        .insert(hours)
        .onConflict(['tenant_id', 'weekday'])
        .merge(['is_open', 'open_time', 'close_time', 'updated_at']);
    }

    if (hours.length) {
      if (!req.db) return res.status(500).json({ error: 'Konteks tenant tidak tersedia' });
      const branches = await query('branches').where({ tenant_id: tenantId, is_active: true }).select('id');
      for (const branch of branches) await syncBookingSlotOperatingHours(req.db, tenantId, branch.id);
    }

    await query('booking_slots as slots')
      .where('slots.tenant_id', tenantId)
      .where('slots.slot_date', '>=', WITA_DATE.format(new Date()))
      .whereNotExists(hasCalendarException())
      .update({ capacity: defaultBookingCapacity, updated_at: query.fn.now() });

    const settings = await getOperationalSettings(query, tenantId);
    await logAudit(query, req, {
      action: 'settings.operational_updated',
      entityType: 'tenant_settings',
      entityId: tenantId,
      oldValues: oldSettings,
      newValues: settings,
    });
    return res.json({ message: 'Pengaturan operasional berhasil disimpan', data: settings });
  } catch (error: any) {
    if (error.code === '23514') return res.status(409).json({ error: 'Kapasitas tidak dapat di bawah jumlah booking yang sudah tercatat pada tanggal mendatang' });
    return res.status(500).json({ error: error.message || 'Gagal menyimpan pengaturan operasional' });
  }
});
