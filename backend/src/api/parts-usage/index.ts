import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';

export const partsUsageRouter = Router();

partsUsageRouter.use(authMiddleware);
partsUsageRouter.use(tenantResolver);
partsUsageRouter.use(branchResolver);

// POST /api/parts-usage/use - pakai part langsung (atomic: -stock, +movement out, +usage)
partsUsageRouter.post('/use', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { ticket_id, part_id, qty, unit_price } = req.body;
    if (!ticket_id || !part_id || !qty || qty <= 0) {
      res.status(400).json({ error: 'Data tidak valid' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
       const ticket = await trx('service_tickets').where({ id: ticket_id, tenant_id, branch_id: req.user?.branch_id }).first();
      if (!ticket) throw new Error('Tiket tidak ditemukan');

       const part = await trx('parts').where({ id: part_id, tenant_id, branch_id: req.user?.branch_id }).first();
      if (!part) throw new Error('Part tidak ditemukan');

      if (part.stock_qty < qty) throw new Error('Stok tidak cukup');

      // 1) Kurangi stok
      await trx('parts')
         .where({ id: part_id, tenant_id, branch_id: req.user?.branch_id })
        .update({ stock_qty: part.stock_qty - qty });

      // 2) Tambah part_stock_movements (out)
      const [movement] = await trx('part_stock_movements')
        .insert({
          tenant_id,
          part_id,
          ticket_id,
          created_by: req.user?.user_id,
          movement_type: 'out',
          qty,
        })
        .returning('*');

      // 3) Catat ticket_part_usages
      const [usage] = await trx('ticket_part_usages')
        .insert({
          tenant_id,
          ticket_id,
          part_id,
          movement_id: movement.id,
          used_by: req.user?.user_id,
          qty,
          unit_price: unit_price !== undefined ? unit_price : part.sell_price,
        })
        .returning('*');

      return { movement, usage };
    });

    res.status(201).json({ message: 'Pemakaian part berhasil dicatat', data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memakai part' });
  }
});
