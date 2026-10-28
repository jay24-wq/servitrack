import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const photosRouter = Router();
photosRouter.use(authMiddleware);
photosRouter.use(tenantResolver);
// POST /api/tickets/:id/photos
photosRouter.post('/:id/photos', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { id } = req.params;
        const { photo_type, storage_key, caption } = req.body;
        if (!photo_type || !storage_key) {
            res.status(400).json({ error: 'photo_type dan storage_key wajib diisi' });
            return;
        }
        const valid = ['checkin', 'progress', 'final', 'handover'];
        if (!valid.includes(photo_type)) {
            res.status(400).json({ error: 'photo_type tidak valid' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id, tenant_id }).first();
            if (!ticket) {
                throw new Error('Tiket tidak ditemukan');
            }
            const [photo] = await trx('ticket_photos').insert({
                tenant_id,
                ticket_id: id,
                uploaded_by: req.user?.user_id,
                photo_type,
                storage_key,
                caption: caption || null,
            }).returning('*');
            return photo;
        });
        res.status(201).json({ message: 'Bukti foto berhasil dicatat', data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mencatat foto' });
    }
});
//# sourceMappingURL=photos.js.map