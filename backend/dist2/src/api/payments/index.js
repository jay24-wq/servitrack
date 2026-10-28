import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const paymentRouter = Router();
paymentRouter.use(authMiddleware);
paymentRouter.use(tenantResolver);
// POST /api/payments - record payment, auto-update invoice status
paymentRouter.post('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { invoice_id, method, amount, gateway_ref } = req.body;
        if (!invoice_id || !method || !amount || amount <= 0) {
            res.status(400).json({ error: 'Data pembayaran tidak valid' });
            return;
        }
        const result = await withTenantContext(tenant_id, async (trx) => {
            const invoice = await trx('invoices').where({ id: invoice_id, tenant_id }).first();
            if (!invoice)
                throw new Error('Invoice tidak ditemukan');
            const [payment] = await trx('payments')
                .insert({
                tenant_id,
                invoice_id,
                received_by: req.user?.user_id,
                method,
                amount,
                status: 'paid',
                gateway_ref: gateway_ref || null,
                paid_at: new Date(),
            })
                .returning('*');
            // Hitung total pembayaran yang sudah paid
            const [agg] = await trx('payments')
                .where({ invoice_id, tenant_id, status: 'paid' })
                .sum('amount as total_paid');
            const totalPaid = Number(agg.total_paid) || 0;
            let newStatus = invoice.status;
            if (totalPaid >= Number(invoice.total)) {
                newStatus = 'paid';
            }
            else {
                newStatus = 'partial';
            }
            await trx('invoices')
                .where({ id: invoice_id })
                .update({ status: newStatus });
            return { payment, invoice_status: newStatus };
        });
        res.status(201).json({ data: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mencatat pembayaran' });
    }
});
//# sourceMappingURL=index.js.map