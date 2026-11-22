import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { CreatePartDto, StockInDto } from './dto';
import { logAudit } from '@services/auditLog';
import { reevaluateWaitingPartTickets } from '@services/partAvailability';
import { notifyTicketStatusChanged } from '@services/notifications/events';
import { validate as isUuid } from 'uuid';

export const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);
inventoryRouter.use(tenantResolver);
inventoryRouter.use(branchResolver);

// GET /api/inventory/parts
inventoryRouter.get('/parts', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    const status = String(req.query.status || 'active');
    let q = reqDb(req)('parts').where({ tenant_id, branch_id: req.user?.branch_id });
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
    const part = await reqDb(req)('parts').where({ id, tenant_id, branch_id: req.user?.branch_id }).forUpdate().first();
    if (!part) {
      res.status(404).json({ error: 'Part tidak ditemukan' });
      return;
    }
    const [updated] = await reqDb(req)('parts').where({ id, tenant_id, branch_id: req.user?.branch_id }).update({ is_active: false }).returning('*');
    await logAudit(reqDb(req), req, {
      action: 'part.deleted',
      entityType: 'part',
      entityId: id,
      oldValues: { sku: part.sku, name: part.name, is_active: part.is_active },
      newValues: { sku: part.sku, name: part.name, is_active: false },
    });
    res.json({ data: updated, softDeleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus part' });
  }
});

function canManagePartRequests(req: AuthRequest) {
  return req.user?.role?.toLowerCase() === 'admin';
}

inventoryRouter.get('/part-requests', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const query = reqDb(req)('part_requests as request')
      .join('service_tickets as ticket', 'ticket.id', 'request.ticket_id')
      .join('users as requester', 'requester.id', 'request.requested_by')
      .leftJoin('quotation_items as item', 'item.id', 'request.quotation_item_id')
      .leftJoin('parts as linked', 'linked.id', 'request.linked_part_id')
      .where({ 'request.tenant_id': tenantId, 'request.branch_id': req.user?.branch_id })
      .modify((builder) => {
        const status = String(req.query.status ?? 'active').toUpperCase();
        if (status === 'ACTIVE') builder.whereIn('request.status', ['OPEN', 'ORDERED']);
        else if (status === 'ALL') builder.whereNot('request.status', 'PENDING_APPROVAL');
        else if (['PENDING_APPROVAL', 'OPEN', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(status)) builder.where('request.status', status);
      });
    const [rows, summaryRows] = await Promise.all([
      query.clone().select(
        'request.*', 'ticket.ticket_code', 'ticket.current_status as ticket_status', 'requester.name as technician_name',
        'ticket.tracking_code',
        'item.availability_status', 'item.part_cost as quoted_part_cost', 'linked.name as linked_part_name', 'linked.sku as linked_part_sku',
        reqDb(req).raw('(request.actual_price - request.estimated_price) as price_difference')
      ).orderBy('request.requested_at', 'desc').limit(250),
      reqDb(req)('part_requests').where({ tenant_id: tenantId, branch_id: req.user?.branch_id }).select('status').count('* as count').groupBy('status'),
    ]);
    const counts = Object.fromEntries(summaryRows.map((row: any) => [row.status, Number(row.count)]));
    return res.json({ data: rows, summary: {
      OPEN: counts.OPEN ?? 0,
      ORDERED: counts.ORDERED ?? 0,
      RECEIVED: counts.RECEIVED ?? 0,
      PENDING_APPROVAL: counts.PENDING_APPROVAL ?? 0,
    } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil permintaan part' });
  }
});

inventoryRouter.post('/part-requests/:id/order', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const arrivalDays = req.body?.estimated_arrival_days == null ? null : Number(req.body.estimated_arrival_days);
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!canManagePartRequests(req)) return res.status(403).json({ error: 'Hanya admin yang dapat memesan part' });
    if (!isUuid(req.params.id) || (arrivalDays !== null && (!Number.isSafeInteger(arrivalDays) || arrivalDays <= 0))) {
      return res.status(400).json({ error: 'Estimasi kedatangan part tidak valid' });
    }
    const result = await reqDb(req).transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenantId]);
      const request = await trx('part_requests').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!request) throw Object.assign(new Error('Permintaan part tidak ditemukan'), { status: 404 });
      if (!['OPEN', 'ORDERED'].includes(request.status)) throw Object.assign(new Error('Hanya permintaan OPEN atau ORDERED yang bisa dipesan atau diperbarui ETA'), { status: 409 });
      const [updated] = await trx('part_requests').where({ id: request.id }).update({
        status: 'ORDERED', ...(request.status === 'OPEN' ? { ordered_at: new Date() } : {}), ...(arrivalDays !== null && { estimated_arrival_days: arrivalDays }),
      }).returning('*');
      await reevaluateWaitingPartTickets(trx, { tenantId, branchId: request.branch_id, actorId: req.user!.user_id });
      await logAudit(trx, req, {
        action: request.status === 'OPEN' ? 'part_request.ordered' : 'part_request.eta_updated', entityType: 'part_request', entityId: request.id,
        ticketId: request.ticket_id, quotationId: request.quotation_id,
        oldValues: { status: request.status, estimated_arrival_days: request.estimated_arrival_days },
        newValues: { status: 'ORDERED', estimated_arrival_days: updated.estimated_arrival_days },
      });
      return updated;
    });
    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menandai permintaan part dipesan' });
  }
});

inventoryRouter.post('/part-requests/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const reason = String(req.body?.reason ?? '').trim();
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!canManagePartRequests(req)) return res.status(403).json({ error: 'Hanya admin yang dapat membatalkan permintaan' });
    if (!isUuid(req.params.id) || !reason || reason.length > 1000) return res.status(400).json({ error: 'Alasan pembatalan wajib diisi (maksimal 1000 karakter)' });
    const result = await reqDb(req).transaction(async (trx) => {
      const request = await trx('part_requests').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!request) throw Object.assign(new Error('Permintaan part tidak ditemukan'), { status: 404 });
      if (['RECEIVED', 'CANCELLED'].includes(request.status)) throw Object.assign(new Error('Permintaan sudah diterima atau dibatalkan'), { status: 409 });
      const [updated] = await trx('part_requests').where({ id: request.id }).update({ status: 'CANCELLED', cancelled_reason: reason }).returning('*');
      await logAudit(trx, req, {
        action: 'part_request.cancelled', entityType: 'part_request', entityId: request.id,
        ticketId: request.ticket_id, quotationId: request.quotation_id,
        oldValues: { status: request.status }, newValues: { status: 'CANCELLED', reason }, note: reason,
      });
      await reevaluateWaitingPartTickets(trx, { tenantId, branchId: request.branch_id, actorId: req.user!.user_id });
      return updated;
    });
    return res.json({ data: result });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal membatalkan permintaan part' });
  }
});

inventoryRouter.post('/part-requests/:id/receive', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { linked_part_id, new_part, qty_received, actual_price } = req.body ?? {};
    const receivedQty = Number(qty_received);
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    if (!canManagePartRequests(req)) return res.status(403).json({ error: 'Hanya admin yang dapat menerima part' });
    if (!isUuid(req.params.id) || !Number.isSafeInteger(receivedQty) || receivedQty <= 0 ||
      (actual_price !== undefined && (!Number.isFinite(Number(actual_price)) || Number(actual_price) < 0)) ||
      Boolean(linked_part_id) === Boolean(new_part) || (linked_part_id ? !isUuid(linked_part_id) : !new_part || typeof new_part !== 'object')) {
      return res.status(400).json({ error: 'Data penerimaan part tidak valid' });
    }

    const result = await reqDb(req).transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenantId]);
      const request = await trx('part_requests').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!request) throw Object.assign(new Error('Permintaan part tidak ditemukan'), { status: 404 });
      if (!['ORDERED', 'OPEN'].includes(request.status)) throw Object.assign(new Error('Permintaan harus berstatus OPEN atau ORDERED untuk diterima'), { status: 409 });
      if (receivedQty < Number(request.qty)) throw Object.assign(new Error(`Qty diterima minimal ${request.qty} ${request.requested_name}`), { status: 400 });

      let part: any;
      let isNewPart = false;
      if (linked_part_id) {
        part = await trx('parts').where({ id: linked_part_id, tenant_id: tenantId, branch_id: request.branch_id, is_active: true }).forUpdate().first();
        if (!part) throw Object.assign(new Error('Part inventory tidak ditemukan di cabang permintaan'), { status: 404 });
      } else {
        const sku = String(new_part.sku ?? '').trim();
        const name = String(new_part.name ?? request.requested_name).trim();
        const specification = String(new_part.spec ?? request.specification ?? '').trim();
        const costPrice = Number(new_part.cost_price ?? actual_price ?? request.estimated_price);
        const sellPrice = Number(new_part.sell_price ?? 0);
        const minStock = Number(new_part.min_stock ?? 0);
        if (!sku || sku.length > 40 || !name || name.length > 120 || specification.length > 2000 ||
          !Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellPrice) || sellPrice < 0 || !Number.isSafeInteger(minStock) || minStock < 0) {
          throw Object.assign(new Error('SKU, nama, spesifikasi, dan harga part baru tidak valid'), { status: 400 });
        }
        const [created] = await trx('parts').insert({
          tenant_id: tenantId, branch_id: request.branch_id, sku, name,
          category: String(new_part.category ?? 'Umum'), spec: specification || null,
          unit: String(new_part.unit ?? 'pcs'), stock_qty: 0,
          min_stock: minStock, cost_price: costPrice, sell_price: sellPrice,
          bin_location: new_part.bin_location ?? null,
        }).returning('*');
        part = created;
        isNewPart = true;
      }

      const actualPrice = Number(actual_price ?? new_part?.cost_price ?? part.cost_price);
      const [updatedPart] = await trx('parts').where({ id: part.id, tenant_id: tenantId, branch_id: request.branch_id })
        .update({ stock_qty: Number(part.stock_qty) + receivedQty, ...(actual_price !== undefined && { cost_price: actualPrice }) })
        .returning('*');
      const [movement] = await trx('part_stock_movements').insert({
        tenant_id: tenantId, part_id: part.id, ticket_id: request.ticket_id, created_by: req.user?.user_id,
        movement_type: 'in', qty: receivedQty, note: `Penerimaan permintaan part ${request.id}`,
      }).returning('*');
      const linkedItems = await trx('quotation_items').where({ id: request.quotation_item_id, tenant_id: tenantId, part_id: null }).update({ part_id: part.id });
      if (!linkedItems) throw Object.assign(new Error('Item quotation sudah tertaut ke inventory'), { status: 409 });
      const [updatedRequest] = await trx('part_requests').where({ id: request.id, tenant_id: tenantId }).update({
        status: 'RECEIVED', linked_part_id: part.id, received_at: new Date(), actual_price: actualPrice,
      }).returning('*');
      if (isNewPart) {
        await logAudit(trx, req, {
          action: 'part.created', entityType: 'part', entityId: part.id,
          newValues: { sku: part.sku, name: part.name, category: part.category, spec: part.spec, stock_qty: 0, source_part_request_id: request.id },
        });
      }
      await logAudit(trx, req, {
        action: 'part.stock_received', entityType: 'part', entityId: part.id, ticketId: request.ticket_id,
        oldValues: { stock_qty: Number(part.stock_qty) },
        newValues: { stock_qty: Number(updatedPart.stock_qty), received_qty: receivedQty, movement_id: movement.id, part_request_id: request.id },
      });
      await logAudit(trx, req, {
        action: 'part_request.linked_to_inventory', entityType: 'part_request', entityId: request.id,
        ticketId: request.ticket_id, quotationId: request.quotation_id,
        oldValues: { linked_part_id: request.linked_part_id },
        newValues: { linked_part_id: part.id, part_name: part.name, part_sku: part.sku },
      });
      await logAudit(trx, req, {
        action: 'part_request.received', entityType: 'part_request', entityId: request.id,
        ticketId: request.ticket_id, quotationId: request.quotation_id,
        oldValues: { status: request.status, linked_part_id: request.linked_part_id },
        newValues: {
          status: 'RECEIVED', linked_part_id: part.id, stock_movement_id: movement.id,
          is_new_part: isNewPart, actual_price: actualPrice,
          estimated_price: Number(request.estimated_price), price_difference: actualPrice - Number(request.estimated_price),
          received_qty: receivedQty,
        },
      });
      const resumed = await reevaluateWaitingPartTickets(trx, { tenantId, branchId: request.branch_id, actorId: req.user!.user_id });
      return { request: updatedRequest, part: updatedPart, movement, resumed, price_difference: actualPrice - Number(request.estimated_price) };
    });

    for (const entry of result.resumed) {
      void notifyTicketStatusChanged({
        tenantId, customerId: entry.ticket.customer_id, phone: entry.phone ?? '', ticketId: entry.ticket.id,
        trackingCode: entry.ticket.tracking_code, previousStatus: entry.previousStatus, status: entry.ticket.current_status,
        details: 'Permintaan part diterima dan stok sudah dievaluasi ulang.',
      });
    }
    return res.status(201).json({ data: { ...result, resumed: undefined, resumed_ticket_ids: result.resumed.map((entry) => entry.ticket.id) } });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menerima permintaan part' });
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
    const { sku, name, category, spec, unit = 'pcs', stock_qty = 0, min_stock = 0, cost_price = 0, sell_price = 0, bin_location, part_request_id } = req.body as CreatePartDto;
    const branch_id = req.user.branch_id;
    const fromPartRequest = part_request_id !== undefined && part_request_id !== null && part_request_id !== '';
    const initialStock = fromPartRequest ? 0 : Number(stock_qty);
    if (!branch_id || !sku?.trim() || !name?.trim() || !Number.isSafeInteger(initialStock) || initialStock < 0 || Number(min_stock) < 0 || Number(cost_price) < 0 || Number(sell_price) < 0 ||
      (fromPartRequest && (typeof part_request_id !== 'string' || !isUuid(part_request_id)))) {
      res.status(400).json({ error: 'Data parts tidak valid' });
      return;
    }

    const result = await reqDb(req).transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
      if (fromPartRequest) {
        const partRequest = await trx('part_requests').where({ id: part_request_id, tenant_id, branch_id }).forUpdate().first();
        if (!partRequest) throw Object.assign(new Error('Permintaan part tidak ditemukan'), { status: 404 });
        if (!['OPEN', 'ORDERED'].includes(partRequest.status)) throw Object.assign(new Error('Permintaan part tidak dapat digunakan untuk membuat part'), { status: 409 });
      }
      const [part] = await trx('parts').insert({
        tenant_id, branch_id, sku: sku.trim(), name: name.trim(), category: category || 'Umum', spec: spec || null,
        unit, stock_qty: initialStock, min_stock: Number(min_stock), cost_price: Number(cost_price), sell_price: Number(sell_price),
        bin_location: bin_location || null,
      }).returning('*');
      let movement = null;
      if (initialStock > 0) {
        [movement] = await trx('part_stock_movements').insert({
          tenant_id, part_id: part.id, created_by: req.user?.user_id, movement_type: 'in', qty: initialStock, note: 'Stok awal saat part dibuat',
        }).returning('*');
      }
      await logAudit(trx, req, {
        action: 'part.created',
        entityType: 'part',
        entityId: part.id,
        newValues: { sku: part.sku, name: part.name, category: part.category, unit: part.unit, stock_qty: part.stock_qty, min_stock: part.min_stock, cost_price: part.cost_price, sell_price: part.sell_price, ...(fromPartRequest && { source_part_request_id: part_request_id }) },
      });
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
      .where({ 'm.tenant_id': tenant_id, 'p.branch_id': req.user?.branch_id })
      .leftJoin('parts as p', 'p.id', 'm.part_id')
      .leftJoin('service_tickets as t', 't.id', 'm.ticket_id')
      .leftJoin('users as u', 'u.id', 'm.created_by')
      .leftJoin('part_stock_movements as reversal', 'reversal.reversal_of_movement_id', 'm.id')
      .select(
        'm.id',
        'm.movement_type',
        'm.qty',
        'm.note',
        'm.created_at',
        'm.reversal_of_movement_id',
        'reversal.id as reversal_id',
        'reversal.reversal_reason',
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
    const result = await reqDb(req).transaction(async (trx) => {
      await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
       const part = await trx('parts').where({ id: part_id, tenant_id, branch_id: req.user?.branch_id }).forUpdate().first();
      if (!part) throw new Error('Part tidak ditemukan');
      const [updatedPart] = await trx('parts').where({ id: part_id, tenant_id, branch_id: req.user?.branch_id }).update({ stock_qty: Number(part.stock_qty) + Number(qty), ...(cost_price !== undefined && { cost_price: Number(cost_price) }) }).returning(['stock_qty', 'cost_price']);
      const [movement] = await trx('part_stock_movements').insert({
        tenant_id,
        part_id,
        created_by: req.user?.user_id,
        movement_type: 'in',
        qty,
        note: note || null,
      }).returning('*');
      await logAudit(trx, req, {
        action: 'part.stock_received',
        entityType: 'part',
        entityId: part_id,
        oldValues: { name: part.name, sku: part.sku, stock_qty: Number(part.stock_qty), cost_price: part.cost_price },
        newValues: { name: part.name, sku: part.sku, stock_qty: Number(updatedPart.stock_qty), cost_price: updatedPart.cost_price, received_qty: Number(qty), note: note || null },
      });
      const resumed = await reevaluateWaitingPartTickets(trx, { tenantId: tenant_id, branchId: req.user!.branch_id!, actorId: req.user!.user_id });
      return { movement, resumed };
    });
    for (const entry of result.resumed) {
      void notifyTicketStatusChanged({
        tenantId: tenant_id,
        customerId: entry.ticket.customer_id,
        phone: entry.phone ?? '',
        ticketId: entry.ticket.id,
        trackingCode: entry.ticket.tracking_code,
        previousStatus: entry.previousStatus,
        status: entry.ticket.current_status,
        details: 'Stok sparepart sudah mencukupi setelah restock; pengerjaan dilanjutkan.',
      });
    }
    res.status(201).json({ data: result.movement, resumed_ticket_ids: result.resumed.map((entry) => entry.ticket.id) });
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

    const existing = await reqDb(req)('parts').where({ id, tenant_id, branch_id: req.user?.branch_id }).forUpdate().first();
    if (!existing) {
      res.status(404).json({ error: 'Part tidak ditemukan' });
      return;
    }

    const [updated] = await reqDb(req)('parts')
      .where({ id, tenant_id, branch_id: req.user?.branch_id })
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
    const auditFields = (part: any) => ({ name: part.name, category: part.category, unit: part.unit, sell_price: part.sell_price, cost_price: part.cost_price, min_stock: part.min_stock, is_active: part.is_active, bin_location: part.bin_location });
    await logAudit(reqDb(req), req, {
      action: 'part.updated',
      entityType: 'part',
      entityId: id,
      oldValues: auditFields(existing),
      newValues: auditFields(updated),
    });
    res.json({ data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal update part' });
  }
});
