import { Router } from 'express';
import { authMiddleware, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const reportsRouter = Router();
reportsRouter.use(authMiddleware);
reportsRouter.use(tenantResolver);
// GET /api/reports/dashboard?from=&to=&branch_id=&granularity=daily|weekly|monthly
reportsRouter.get('/dashboard', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { from, to, branch_id, granularity } = req.query;
        const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();
        const revenue = await withTenantContext(tenant_id, async (trx) => {
            const [r] = await trx('invoices').where({ tenant_id, status: 'paid' }).whereBetween('created_at', [fromDate, toDate]).sum('total as sum');
            const [u] = await trx('invoices').where({ tenant_id }).whereNot({ status: 'paid' }).whereBetween('created_at', [fromDate, toDate]).count('* as c').sum('total as sum');
            const active = await trx('service_tickets').where({ tenant_id }).whereNotIn('current_status', ['selesai', 'siap_diambil']).count('* as c').first();
            const done = await trx('service_tickets').where({ tenant_id }).whereIn('current_status', ['selesai', 'siap_diambil']).count('* as c').first();
            const topParts = await trx('ticket_part_usages')
                .join('parts', 'ticket_part_usages.part_id', 'parts.id')
                .where({ 'ticket_part_usages.tenant_id': tenant_id })
                .groupBy('parts.id', 'parts.name')
                .select('parts.name')
                .sum('ticket_part_usages.qty as total_qty')
                .orderBy('total_qty', 'desc')
                .limit(5);
            return {
                revenue: Number(r?.sum || 0),
                unpaid: { count: Number(u?.c || 0), total: Number(u?.sum || 0) },
                active: Number(active?.c || 0),
                done: Number(done?.c || 0),
                topParts,
                branch_id: branch_id || null,
            };
        });
        res.json({ data: revenue, range: { from: fromDate, to: toDate, granularity: granularity || 'daily' } });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Gagal dashboard' });
    }
});
// GET /api/reports/export?from=&to=&format=json|csv
reportsRouter.get('/export', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { from, to, format } = req.query;
        const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();
        const data = await withTenantContext(tenant_id, async (trx) => {
            const invoices = await trx('invoices').where({ tenant_id }).whereBetween('created_at', [fromDate, toDate]).select('*');
            const tickets = await trx('service_tickets')
                .where({ tenant_id })
                .whereBetween('created_at', [fromDate, toDate])
                .select('id', 'ticket_code', 'current_status', 'created_at');
            return { invoices, tickets };
        });
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
            const rows = ['type,id,total,status']
                .concat(data.invoices.map((r) => `invoice,${r.id},${r.total},${r.status}`))
                .concat(data.tickets.map((t) => `ticket,${t.id},,${t.current_status}`));
            res.send(rows.join('\n'));
            return;
        }
        res.json({ data });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Gagal export' });
    }
});
//# sourceMappingURL=index.js.map