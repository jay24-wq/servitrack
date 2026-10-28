import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const notesRouter = Router();
notesRouter.use(authMiddleware);
notesRouter.use(tenantResolver);
// POST /api/tickets/:id/notes
notesRouter.post('/:id/notes', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { id } = req.params;
        const { note_type, content } = req.body;
        if (!note_type || !content) {
            res.status(400).json({ error: 'note_type dan content wajib diisi' });
            return;
        }
        const valid = ['complaint', 'diagnosis', 'internal'];
        if (!valid.includes(note_type)) {
            res.status(400).json({ error: 'note_type tidak valid' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id, tenant_id }).first();
            if (!ticket) {
                throw new Error('Tiket tidak ditemukan');
            }
            const [note] = await trx('ticket_notes').insert({
                tenant_id,
                ticket_id: id,
                author_id: req.user?.user_id,
                note_type,
                content,
            }).returning('*');
            return note;
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menambah catatan' });
    }
});
//# sourceMappingURL=notes.js.map