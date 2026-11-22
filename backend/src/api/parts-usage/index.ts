import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { logAudit } from '@services/auditLog';
import { recalculateTicketFinalCost } from '@services/ticketCost';
import { validate as isUuid } from 'uuid';

export const partsUsageRouter = Router();

partsUsageRouter.use(authMiddleware);
partsUsageRouter.use(tenantResolver);
partsUsageRouter.use(branchResolver);

function usageError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function netUsedQty(trx: any, tenantId: string, ticketId: string, partId: string, quotationItemIds?: string[]) {
  const query = trx('ticket_part_usages as usage')
    .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
    .where({ 'usage.tenant_id': tenantId, 'usage.ticket_id': ticketId, 'usage.part_id': partId });
  if (quotationItemIds) query.whereIn('usage.quotation_item_id', quotationItemIds);
  const row = await query.sum(trx.raw('usage.qty - COALESCE(reversal.qty, 0)')).first();
  return Math.max(0, Number(row?.sum ?? 0));
}

// GET /api/parts-usage/ticket/:ticketId - persisted parts used on a ticket
partsUsageRouter.get('/ticket/:ticketId', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { ticketId } = req.params;
    if (!isUuid(ticketId)) {
      res.status(400).json({ error: 'ID tiket tidak valid' });
      return;
    }
    const ticket = await reqDb(req)('service_tickets')
      .where({ id: ticketId, tenant_id: tenantId, branch_id: req.user?.branch_id })
      .select('id', 'branch_id')
      .first();
    if (!ticket) {
      res.status(404).json({ error: 'Tiket tidak ditemukan' });
      return;
    }

    const usages = await reqDb(req)('ticket_part_usages as usage')
      .join('parts as part', 'part.id', 'usage.part_id')
      .leftJoin('users as technician', 'technician.id', 'usage.used_by')
      .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
      .where({ 'usage.tenant_id': tenantId, 'usage.ticket_id': ticketId, 'part.branch_id': ticket.branch_id })
      .select(
        'usage.id',
        'usage.ticket_id',
        'usage.part_id',
        'usage.movement_id',
        'usage.quotation_item_id',
        'usage.used_by',
        'usage.qty',
        'usage.unit_price',
        reqDb(req).raw('usage.qty - COALESCE(reversal.qty, 0) as net_qty'),
        'usage.used_at',
        'part.name as part_name',
        'part.sku as part_sku',
        'part.unit',
        'technician.name as technician_name'
      )
      .orderBy('usage.used_at', 'asc');

    res.json({ data: usages });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil pemakaian sparepart' });
  }
});

// POST /api/parts-usage/use - pakai part langsung (atomic: -stock, +movement out, +usage)
partsUsageRouter.post('/use', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }

    const { ticket_id, part_id, qty } = req.body;
    const quantity = typeof qty === 'number' ? qty : Number.NaN;
    if (typeof ticket_id !== 'string' || !isUuid(ticket_id) || typeof part_id !== 'string' || !isUuid(part_id) ||
      !Number.isSafeInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'Data tidak valid' });
      return;
    }

    const result = await withTenantContext(tenant_id, async (trx) => {
      const ticket = await trx('service_tickets')
        .where({ id: ticket_id, tenant_id, branch_id: req.user?.branch_id })
        .forUpdate()
        .first();
      if (!ticket) throw usageError('Tiket tidak ditemukan', 404);
      if (ticket.current_status !== 'pengerjaan') {
        throw usageError('Pemakaian sparepart hanya dapat dicatat saat pengerjaan berlangsung', 409);
      }

      const part = await trx('parts')
        .where({ id: part_id, tenant_id, branch_id: ticket.branch_id, is_active: true })
        .forUpdate()
        .first();
      if (!part) throw usageError('Sparepart tidak ditemukan di cabang tiket atau sudah tidak aktif', 404);

      const quotationAllocations: Array<{ item: any; qty: number }> = [];
      const approvedQuotation = ticket.workflow_resolution !== 'continue_original'
        ? await trx('quotations').where({ tenant_id, ticket_id, status: 'approved' }).orderBy('created_at', 'desc').first()
        : null;
      if (approvedQuotation) {
        const approvedItems = await trx('quotation_items as item')
          .join('quotations as quote', 'quote.id', 'item.quotation_id')
          .where({
            'quote.tenant_id': tenant_id,
            'quote.id': approvedQuotation.id,
            'quote.status': 'approved',
            'item.part_id': part_id,
            'item.item_type': 'part',
          })
          .forUpdate()
          .orderBy('item.created_at', 'asc')
          .select('item.id', 'item.qty', 'item.unit_price', 'item.part_unit_price_snapshot');
        const usedByItem = await trx('ticket_part_usages as usage')
          .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'usage.movement_id')
          .where({ 'usage.tenant_id': tenant_id, 'usage.ticket_id': ticket_id, 'usage.part_id': part_id })
          .whereIn('usage.quotation_item_id', approvedItems.map((item: any) => item.id))
          .select('usage.quotation_item_id')
          .sum({ net_qty: trx.raw('usage.qty - COALESCE(reversal.qty, 0)') })
          .groupBy('usage.quotation_item_id');
        const usedTotals = new Map(usedByItem.map((item: any) => [item.quotation_item_id, Number(item.net_qty ?? 0)]));
        let remaining = quantity;
        for (const item of approvedItems) {
          const capacity = Math.max(0, Number(item.qty) - (usedTotals.get(item.id) ?? 0));
          const allocated = Math.min(remaining, capacity);
          if (allocated > 0) quotationAllocations.push({
            item: { ...item, unit_price: item.part_unit_price_snapshot ?? item.unit_price },
            qty: allocated,
          });
          remaining -= allocated;
          if (!remaining) break;
        }
        if (remaining > 0) throw usageError('Sparepart belum disetujui pelanggan atau pemakaian melebihi quantity quotation approved', 409);
      } else {
        if (ticket.work_type !== 'with_parts' || ticket.diagnosis_status !== 'matches_complaint' || ticket.requested_part_id !== part_id) {
          throw usageError('Tiket tanpa quotation hanya boleh memakai sparepart dan quantity yang dipilih saat Pengecekan', 409);
        }
        const used = await netUsedQty(trx, tenant_id, ticket_id, part_id);
        if (used + quantity > Number(ticket.requested_part_qty ?? 0)) {
          throw usageError(`Pemakaian melebihi quantity pengecekan (${ticket.requested_part_qty ?? 0})`, 409);
        }
        quotationAllocations.push({ item: { id: null, unit_price: part.sell_price }, qty: quantity });
      }

      const available = Number(part.stock_qty);
      if (available <= 0) throw usageError('Stok Habis', 409);
      if (available < quantity) throw usageError(`Stok tidak cukup. Tersedia ${available} ${part.unit}`, 409);

      // 1) Kurangi stok dengan syarat stok tetap cukup di database.
      const [updatedPart] = await trx('parts')
        .where({ id: part_id, tenant_id, branch_id: ticket.branch_id })
        .where('stock_qty', '>=', quantity)
        .decrement('stock_qty', quantity)
        .returning('stock_qty');
      if (!updatedPart) throw usageError('Stok berubah. Muat ulang persediaan lalu coba lagi', 409);

      // 2) Tambah part_stock_movements (out)
      const movements = [];
      const usages = [];
      for (const allocation of quotationAllocations) {
        const [movement] = await trx('part_stock_movements').insert({
          tenant_id,
          part_id,
          ticket_id,
          created_by: req.user?.user_id,
          movement_type: 'out',
          qty: allocation.qty,
          note: `Pemakaian untuk tiket ${ticket.ticket_code}`,
        })
        .returning('*');
        const [usage] = await trx('ticket_part_usages').insert({
          tenant_id,
          ticket_id,
          part_id,
          movement_id: movement.id,
          quotation_item_id: allocation.item.id,
          used_by: req.user?.user_id,
          qty: allocation.qty,
          unit_price: allocation.item.id ? allocation.item.unit_price : part.sell_price,
        })
        .returning('*');
        movements.push(movement);
        usages.push(usage);
      }

      await logAudit(trx, req, {
        action: 'part.used',
        entityType: 'part',
        entityId: part_id,
        ticketId: ticket_id,
        oldValues: { name: part.name, sku: part.sku, stock_qty: Number(part.stock_qty) },
        newValues: {
          name: part.name,
          sku: part.sku,
          ticket_code: ticket.ticket_code,
          stock_qty: Number(updatedPart.stock_qty),
          qty: quantity,
          unit_prices: usages.map((usage) => ({ qty: usage.qty, unit_price: usage.unit_price })),
          movements: movements.map((movement) => movement.id),
        },
      });

      await recalculateTicketFinalCost(trx, tenant_id, ticket_id);

      return {
        movement: movements[0],
        stock_qty: Number(updatedPart.stock_qty),
        usage: {
          ...usages[0],
          part_name: part.name,
          part_sku: part.sku,
          unit: part.unit,
          technician_name: req.user?.name ?? null,
        },
        usages,
      };
    });

    res.status(201).json({ message: 'Pemakaian part berhasil dicatat', data: result });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message || 'Gagal memakai part' });
  }
});

partsUsageRouter.post('/:movementId/reverse', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const reason = String(req.body?.reason ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!isUuid(req.params.movementId) || !reason || reason.length > 1000) {
      return res.status(400).json({ error: 'Movement dan alasan koreksi wajib diisi' });
    }
    const reversal = await withTenantContext(tenantId, async (trx) => {
      const original = await trx('part_stock_movements')
        .where({ id: req.params.movementId, tenant_id: tenantId, movement_type: 'out' })
        .forUpdate()
        .first();
      if (!original) throw usageError('Movement pemakaian tidak ditemukan', 404);
      if (await trx('part_stock_movements').where({ reversal_of_movement_id: original.id }).first()) {
        throw usageError('Movement ini sudah pernah dikoreksi', 409);
      }
      const part = await trx('parts').where({ id: original.part_id, tenant_id: tenantId }).forUpdate().first();
      if (!part) throw usageError('Sparepart tidak ditemukan', 404);
      const [updatedPart] = await trx('parts')
        .where({ id: part.id, tenant_id: tenantId })
        .increment('stock_qty', Number(original.qty))
        .returning('stock_qty');
      const [movement] = await trx('part_stock_movements').insert({
        tenant_id: tenantId,
        part_id: part.id,
        ticket_id: original.ticket_id,
        created_by: req.user?.user_id,
        movement_type: 'reversal',
        qty: original.qty,
        note: reason,
        reversal_of_movement_id: original.id,
        reversal_reason: reason,
      }).returning('*');
      if (original.ticket_id) await recalculateTicketFinalCost(trx, tenantId, original.ticket_id);
      await logAudit(trx, req, {
        action: 'part.usage_reversed',
        entityType: 'part',
        entityId: part.id,
        ticketId: original.ticket_id,
        newValues: { original_movement_id: original.id, reversal_movement_id: movement.id, ticket_id: original.ticket_id, qty: original.qty, stock_qty: updatedPart.stock_qty, reason },
        note: reason,
      });
      return movement;
    });
    return res.status(201).json({ data: reversal });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengoreksi movement sparepart' });
  }
});
