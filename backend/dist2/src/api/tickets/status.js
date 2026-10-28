import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const statusRouter = Router();
statusRouter.use(authMiddleware);
statusRouter.use(tenantResolver);
// PUT /api/tickets/:id/assign - Assign technician & update status
statusRouter.put('/:id/assign', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { id } = req.params;
        const { technician_id, to_status, note } = req.body;
        if (!technician_id) {
            res.status(400).json({ error: 'technician_id wajib diisi' });
            return;
        }
        const valid = ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil'];
        const nextStatus = to_status || 'pengecekan';
        if (!valid.includes(nextStatus)) {
            res.status(400).json({ error: 'Status tidak valid' });
            return;
        }
        await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id, tenant_id }).first();
            if (!ticket) {
                throw new Error('Tiket tidak ditemukan');
            }
            await trx('service_tickets')
                .where({ id })
                .update({ technician_id, current_status: nextStatus });
            await trx('ticket_status_logs').insert({
                tenant_id,
                ticket_id: id,
                changed_by: req.user?.user_id,
                from_status: ticket.current_status,
                to_status: nextStatus,
                note: note || 'Penugasan teknisi',
            });
        });
        res.json({ message: 'Penugasan dan status berhasil diperbarui' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memperbarui penugasan' });
    }
});
//# sourceMappingURL=status.js.map