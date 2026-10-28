import { Router } from 'express';
import db from '@models/index';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
import { generateBookingCode } from '@utils/code';
export const bookingRouter = Router();
bookingRouter.use(authMiddleware);
bookingRouter.use(tenantResolver);
// GET /api/bookings - List booking
bookingRouter.get('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const bookings = await db('bookings')
            .where({ tenant_id })
            .orderBy('scheduled_at', 'desc');
        res.json({ data: bookings });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil data booking' });
    }
});
// POST /api/bookings - Create booking
bookingRouter.post('/', async (req, res) => {
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
            // Buat booking
            const [booking] = await trx('bookings')
                .insert({
                tenant_id,
                branch_id,
                slot_id,
                customer_id,
                device_id,
                booking_code: generateBookingCode(),
                service_method,
                complaint: complaint || '',
                status: 'booked',
            })
                .returning('*');
            // Update booked_count
            await trx('booking_slots')
                .where({ id: slot_id })
                .increment('booked_count', 1);
            return booking;
        });
        res.status(201).json({ message: 'Booking berhasil dibuat', data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal membuat booking' });
    }
});
// PUT /api/bookings/:id - Update booking
bookingRouter.put('/:id', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const { status, scheduled_at, notes } = req.body;
        const [updated] = await db('bookings')
            .where({ id, tenant_id })
            .update({
            ...(status && { status }),
            ...(scheduled_at !== undefined && { scheduled_at: scheduled_at ? new Date(scheduled_at) : null }),
            ...(notes !== undefined && { notes }),
        })
            .returning('*');
        if (!updated) {
            res.status(404).json({ error: 'Booking tidak ditemukan' });
            return;
        }
        res.json({ message: 'Booking berhasil diperbarui', data: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memperbarui booking' });
    }
});
// DELETE /api/bookings/:id - Cancel/delete booking
bookingRouter.delete('/:id', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const deleted = await db('bookings').where({ id, tenant_id }).delete();
        if (!deleted) {
            res.status(404).json({ error: 'Booking tidak ditemukan' });
            return;
        }
        res.json({ message: 'Booking berhasil dihapus' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menghapus booking' });
    }
});
//# sourceMappingURL=index.js.map