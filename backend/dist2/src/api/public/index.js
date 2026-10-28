import { Router } from 'express';
import db from '@models/index';
import { withTenantContext } from '@middleware/AuthMiddleware';
import { generateBookingCode } from '@utils/code';
export const publicRouter = Router();
const METHOD_MAP = {
    mandiri: 'dropoff',
    terjadwal: 'pickup_only',
    antar_jemput: 'pickup_delivery',
    dropoff: 'dropoff',
    pickup_only: 'pickup_only',
    pickup_delivery: 'pickup_delivery',
};
const SLOT_CAPACITY = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// GET /api/public/tenant/:slug
publicRouter.get('/tenant/:slug', async (req, res) => {
    try {
        const r = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [req.params.slug]);
        const id = r.rows?.[0]?.id;
        if (!id) {
            res.status(404).json({ error: 'Toko tidak ditemukan' });
            return;
        }
        res.json({ data: { tenant_id: id, slug: req.params.slug } });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/public/track/:code
publicRouter.get('/track/:code', async (req, res) => {
    try {
        const r = await db.raw('SELECT track_public(?) AS data', [req.params.code]);
        const data = r.rows?.[0]?.data;
        if (!data) {
            res.status(404).json({ error: 'Tiket tidak ditemukan' });
            return;
        }
        res.json({ data });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/public/bookings
publicRouter.post('/bookings', async (req, res) => {
    try {
        const { slug, name, phone_wa, category, brand, model, serial_number, complaint, symptoms, service_method, slot_date, } = req.body ?? {};
        if (!slug || !name || !phone_wa || !service_method) {
            res.status(400).json({ error: 'slug, name, phone_wa, service_method wajib diisi' });
            return;
        }
        const tenantRes = await db.raw('SELECT resolve_tenant_by_slug(?) AS id', [slug]);
        const tenantId = tenantRes.rows?.[0]?.id ?? null;
        if (!tenantId) {
            res.status(404).json({ error: 'Toko tidak ditemukan' });
            return;
        }
        const method = METHOD_MAP[service_method] ?? 'dropoff';
        const slotDate = DATE_RE.test(slot_date || '') ? slot_date : new Date().toISOString().slice(0, 10);
        const gejala = Array.isArray(symptoms) ? symptoms.join(', ') : '';
        const fullComplaint = [complaint, gejala && `Gejala: ${gejala}`].filter(Boolean).join(' | ') || 'Tanpa keluhan';
        const brandSafe = String(brand || model || '-').slice(0, 50);
        const categorySafe = String(category || 'lainnya').slice(0, 30);
        const result = await withTenantContext(tenantId, async (trx) => {
            let branch = await trx('branches').where({ tenant_id: tenantId, is_main: true }).first();
            if (!branch)
                branch = await trx('branches').where({ tenant_id: tenantId }).orderBy('created_at', 'asc').first();
            if (!branch) {
                [branch] = await trx('branches')
                    .insert({ tenant_id: tenantId, name: 'Cabang Utama', is_main: true, is_active: true })
                    .returning('*');
            }
            let customer = await trx('customers').where({ tenant_id: tenantId, phone_wa }).first();
            if (!customer) {
                [customer] = await trx('customers').insert({ tenant_id: tenantId, name, phone_wa }).returning('*');
            }
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
                await trx('booking_slots')
                    .insert({
                    tenant_id: tenantId,
                    branch_id: branch.id,
                    slot_date: slotDate,
                    capacity: SLOT_CAPACITY,
                    booked_count: 0,
                    is_open: true,
                })
                    .onConflict(['branch_id', 'slot_date'])
                    .ignore();
                slot = await trx('booking_slots')
                    .where({ tenant_id: tenantId, branch_id: branch.id, slot_date: slotDate })
                    .forUpdate()
                    .first();
            }
            if (!slot?.is_open)
                throw Object.assign(new Error('Slot tidak tersedia'), { status: 409 });
            if (slot.booked_count >= slot.capacity)
                throw Object.assign(new Error('Kuota slot harian penuh'), { status: 409 });
            const [booking] = await trx('bookings')
                .insert({
                tenant_id: tenantId,
                branch_id: branch.id,
                slot_id: slot.id,
                customer_id: customer.id,
                device_id: device.id,
                booking_code: generateBookingCode(),
                service_method: method,
                complaint: fullComplaint,
                status: 'booked',
            })
                .returning('*');
            await trx('booking_slots').where({ id: slot.id }).increment('booked_count', 1);
            return { booking, slot };
        });
        res.status(201).json({
            message: 'Booking berhasil dibuat',
            data: {
                booking_code: result.booking.booking_code,
                booking_id: result.booking.id,
                slot_date: result.slot.slot_date,
                service_method: result.booking.service_method,
                capacity: result.slot.capacity,
                booked_count: result.slot.booked_count + 1,
            },
        });
    }
    catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Gagal membuat booking' });
    }
});
//# sourceMappingURL=index.js.map