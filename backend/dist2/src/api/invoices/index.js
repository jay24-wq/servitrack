import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const invoiceRouter = Router();
invoiceRouter.use(authMiddleware);
invoiceRouter.use(tenantResolver);
// POST /api/invoices - generate invoice from ticket
invoiceRouter.post('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { ticket_id, invoice_no, subtotal, additional_cost, discount } = req.body;
        if (!ticket_id || !invoice_no || subtotal === undefined) {
            res.status(400).json({ error: 'ticket_id, invoice_no, subtotal wajib diisi' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            const ticket = await trx('service_tickets').where({ id: ticket_id, tenant_id }).first();
            if (!ticket)
                throw new Error('Tiket tidak ditemukan');
            const existing = await trx('invoices').where({ ticket_id }).first();
            if (existing)
                throw new Error('Tiket sudah memiliki invoice');
            const addCost = additional_cost || 0;
            const disc = discount || 0;
            const total = Number(subtotal) + Number(addCost) - Number(disc);
            const [invoice] = await trx('invoices')
                .insert({
                tenant_id,
                ticket_id,
                invoice_no,
                subtotal,
                additional_cost: addCost,
                discount: disc,
                total,
                status: 'unpaid',
            })
                .returning('*');
            return invoice;
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal membuat invoice' });
    }
});
// GET /api/invoices/:id
invoiceRouter.get('/:id', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const invoice = await withTenantContext(tenant_id, async (trx) => {
            return trx('invoices').where({ id, tenant_id }).first();
        });
        if (!invoice) {
            res.status(404).json({ error: 'Invoice tidak ditemukan' });
            return;
        }
        res.json({ data: invoice });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil invoice' });
    }
});
//# sourceMappingURL=index.js.map