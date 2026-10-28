import { Router } from 'express';
import db from '@models/index';
import { authMiddleware } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);
inventoryRouter.use(tenantResolver);
// GET /api/inventory/parts
inventoryRouter.get('/parts', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const parts = await db('parts').where({ tenant_id, is_active: true });
        res.json({ data: parts });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil data parts' });
    }
});
// POST /api/inventory/parts
inventoryRouter.post('/parts', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        if (!tenant_id) {
            res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
            return;
        }
        const { branch_id, sku, name, unit, stock_qty, min_stock, cost_price, sell_price } = req.body;
        if (!branch_id || !sku || !name || !unit || stock_qty < 0 || min_stock < 0) {
            res.status(400).json({ error: 'Data parts tidak valid' });
            return;
        }
        const [part] = await db('parts')
            .insert({
            tenant_id,
            branch_id,
            sku,
            name,
            unit,
            stock_qty,
            min_stock,
            cost_price: cost_price || 0,
            sell_price: sell_price || 0,
        })
            .returning('*');
        res.status(201).json({ data: part });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal membuat part' });
    }
});
// PUT /api/inventory/parts/:id
inventoryRouter.put('/parts/:id', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const { stock_qty, sell_price, cost_price, min_stock, is_active } = req.body;
        if (stock_qty < 0 || min_stock < 0) {
            res.status(400).json({ error: 'stock_qty atau min_stock tidak boleh negatif' });
            return;
        }
        const [updated] = await db('parts')
            .where({ id, tenant_id })
            .update({
            ...(stock_qty !== undefined && { stock_qty }),
            ...(sell_price !== undefined && { sell_price }),
            ...(cost_price !== undefined && { cost_price }),
            ...(min_stock !== undefined && { min_stock }),
            ...(is_active !== undefined && { is_active }),
        })
            .returning('*');
        if (!updated) {
            res.status(404).json({ error: 'Part tidak ditemukan' });
            return;
        }
        res.json({ data: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal update part' });
    }
});
//# sourceMappingURL=index.js.map