import { Router } from 'express';
import db from '@models/index';
import crypto from 'crypto';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const quotationRouter = Router();
quotationRouter.use(authMiddleware);
quotationRouter.use(tenantResolver);
// POST /api/quotations - create quotation
quotationRouter.post('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { ticket_id, items } = req.body;
        if (!ticket_id || !items || items.length === 0) {
            res.status(400).json({ error: 'ticket_id dan items wajib diisi' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id: ticket_id, tenant_id }).first();
            if (!ticket)
                throw new Error('Tiket tidak ditemukan');
            let total = 0;
            // salin harga parts
            const processed = [];
            for (const item of items) {
                if (item.item_type === 'part' && item.part_id) {
                    const part = await trx('parts').where({ id: item.part_id, tenant_id }).first();
                    if (!part)
                        throw new Error('Part tidak ditemukan');
                    item.unit_price = part.sell_price;
                }
                else if (!item.unit_price) {
                    item.unit_price = 0;
                }
                item.subtotal = Number(item.qty) * Number(item.unit_price);
                total += item.subtotal;
                processed.push(item);
            }
            const approval_token = crypto.randomBytes(24).toString('hex').toUpperCase();
            const [quotation] = await trx('quotations')
                .insert({
                tenant_id,
                ticket_id,
                created_by: req.user?.user_id,
                approval_token,
                total_amount: total,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            })
                .returning('*');
            for (const item of processed) {
                await trx('quotation_items').insert({
                    tenant_id,
                    quotation_id: quotation.id,
                    part_id: item.part_id || null,
                    item_type: item.item_type,
                    description: item.description,
                    qty: item.qty,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal,
                });
            }
            return { quotation, items: processed };
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal membuat penawaran' });
    }
});
// POST /api/quotations/:id/approve
quotationRouter.post('/:id/approve', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const [updated] = await db('quotations')
            .where({ id, tenant_id })
            .update({ status: 'approved', decided_at: new Date() })
            .returning('*');
        if (!updated) {
            res.status(404).json({ error: 'Quotation tidak ditemukan' });
            return;
        }
        res.json({ data: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal approve quotation' });
    }
});
//# sourceMappingURL=index.js.map