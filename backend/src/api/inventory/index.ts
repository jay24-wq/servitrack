import { Router, Response } from 'express';
import db from '@models/index';
import { authMiddleware, AuthRequest } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { CreatePartDto, StockInDto } from './dto';

export const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);
inventoryRouter.use(tenantResolver);

// GET /api/inventory/parts
inventoryRouter.get('/parts', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const status = String(req.query.status || 'active');
    let q = reqDb(req)('parts').where({ tenant_id });
    if (status === 'active') q = q.where({ is_active: true });
    if (status === 'inactive') q = q.where({ is_active: false });
    const parts = await q;
    res.json({ data: parts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data parts' });
  }
});

inventoryRouter.delete('/parts/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toLowerCase() !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menonaktifkan part' });
      return;
    }
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const part = await reqDb(req)('parts').where({ id, tenant_id }).first();
    if (!part) {
      res.status(404).json({ error: 'Part tidak ditemukan' });
      return;
    }
    const [updated] = await reqDb(req)('parts').where({ id, tenant_id }).update({ is_active: false }).returning('*');
    res.json({ data: updated, softDeleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus part' });
  }
});

// POST /api/inventory/parts
inventoryRouter.post('/parts', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    if (req.user?.role?.toLowerCase() !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menambah part' });
      return;
    }
    const { branch_id: requestedBranch, sku, name, category, spec, unit = 'pcs', stock_qty = 0, min_stock = 0, cost_price = 0, sell_price = 0, bin_location } = req.body as CreatePartDto;
    const branch_id = requestedBranch || req.user.branch_id;
    if (!branch_id || !sku?.trim() || !name?.trim() || Number(stock_qty) < 0 || Number(min_stock) < 0 || Number(cost_price) < 0 || Number(sell_price) < 0) {
      res.status(400).json({ error: 'Data parts tidak valid' });
      return;
    }

    const result = await db.transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
      const [part] = await trx('parts').insert({
        tenant_id, branch_id, sku: sku.trim(), name: name.trim(), category: category || 'Umum', spec: spec || null,
        unit, stock_qty: Number(stock_qty), min_stock: Number(min_stock), cost_price: Number(cost_price), sell_price: Number(sell_price),
        bin_location: bin_location || null,
      }).returning('*');
      let movement = null;
      if (Number(stock_qty) > 0) {
        [movement] = await trx('part_stock_movements').insert({
          tenant_id, part_id: part.id, created_by: req.user?.user_id, movement_type: 'in', qty: Number(stock_qty), note: 'Stok awal saat part dibuat',
        }).returning('*');
      }
      return { part, movement };
    });

    res.status(201).json({ data: result.part, movement: result.movement });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat part' });
  }
});

// GET /api/inventory/movements
inventoryRouter.get('/movements', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    let q = reqDb(req)('part_stock_movements as m')
      .where('m.tenant_id', tenant_id)
      .leftJoin('parts as p', 'p.id', 'm.part_id')
      .leftJoin('service_tickets as t', 't.id', 'm.ticket_id')
      .leftJoin('users as u', 'u.id', 'm.created_by')
      .select(
        'm.id',
        'm.movement_type',
        'm.qty',
        'm.note',
        'm.created_at',
        'p.sku as part_sku',
        'p.name as part_name',
        't.ticket_code',
        'u.name as user_name'
      )
      .orderBy('m.created_at', 'desc');
    if (search) {
      const s = `%${search}%`;
      q = q.where((b) => {
        b.where('p.sku', 'ilike', s).orWhere('p.name', 'ilike', s).orWhere('t.ticket_code', 'ilike', s);
      });
    }
    const countQuery = q.clone().clearSelect().clearOrder().count<{ count: string }>('* as count').first();
    const [countRow, rows] = await Promise.all([countQuery, q.clone().limit(limit).offset((page - 1) * limit)]);
    res.json({ data: rows, pagination: { page, limit, total: Number(countRow?.count || 0), totalPages: Math.max(1, Math.ceil(Number(countRow?.count || 0) / limit)) } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil riwayat mutasi' });
  }
});

// POST /api/inventory/stock-in
inventoryRouter.post('/stock-in', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    if (req.user?.role?.toLowerCase() !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menambah stok' });
      return;
    }
    const { part_id, qty, cost_price, note } = req.body as StockInDto;
    if (!part_id || !Number.isInteger(Number(qty)) || Number(qty) <= 0 || (cost_price !== undefined && Number(cost_price) < 0)) {
      res.status(400).json({ error: 'Data tidak valid' });
      return;
    }
    const result = await db.transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
      const part = await trx('parts').where({ id: part_id, tenant_id }).first();
      if (!part) throw new Error('Part tidak ditemukan');
      await trx('parts').where({ id: part_id }).update({ stock_qty: Number(part.stock_qty) + Number(qty), ...(cost_price !== undefined && { cost_price: Number(cost_price) }) });
      const [movement] = await trx('part_stock_movements').insert({
        tenant_id,
        part_id,
        created_by: req.user?.user_id,
        movement_type: 'in',
        qty,
        note: note || null,
      }).returning('*');
      return movement;
    });
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambah stok' });
  }
});

// PUT /api/inventory/parts/:id
inventoryRouter.put('/parts/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toLowerCase() !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat mengubah part' });
      return;
    }
    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { stock_qty, name, category, unit, sell_price, cost_price, min_stock, is_active, bin_location } = req.body;

    if (stock_qty !== undefined) {
      res.status(400).json({ error: 'Stock Qty tidak dapat diubah melalui Edit Part. Gunakan Tambah Stok.' });
      return;
    }
    if (!name?.trim() || (min_stock !== undefined && (!Number.isInteger(Number(min_stock)) || Number(min_stock) < 0)) ||
      (cost_price !== undefined && Number(cost_price) < 0) || (sell_price !== undefined && Number(sell_price) < 0)) {
      res.status(400).json({ error: 'Data master part tidak valid' });
      return;
    }

    const [updated] = await reqDb(req)('parts')
      .where({ id, tenant_id })
      .update({
        name: name.trim(),
        ...(category !== undefined && { category: String(category).trim() || 'Umum' }),
        ...(unit !== undefined && { unit: String(unit).trim() || 'pcs' }),
        ...(sell_price !== undefined && { sell_price: Number(sell_price) }),
        ...(cost_price !== undefined && { cost_price: Number(cost_price) }),
        ...(min_stock !== undefined && { min_stock: Number(min_stock) }),
         ...(is_active !== undefined && { is_active }),
         ...(bin_location !== undefined && { bin_location }),
       })
      .returning('*');

    if (!updated) {
      res.status(404).json({ error: 'Part tidak ditemukan' });
      return;
    }
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal update part' });
  }
});
