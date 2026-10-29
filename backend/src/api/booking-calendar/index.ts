import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
import { syncBookingCalendarException } from '@services/bookingSlotService';

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const router = Router();

router.use(authMiddleware, requireRole('ADMIN'), tenantResolver, branchResolver);

async function branchFor(trx: any, tenantId: string, requested?: string) {
  const branch = requested
    ? await trx('branches').where({ id: requested, tenant_id: tenantId, is_active: true }).first()
    : await trx('branches').where({ tenant_id: tenantId, is_active: true }).orderBy([{ column: 'is_main', order: 'desc' }, { column: 'created_at', order: 'asc' }]).first();
  if (!branch) throw Object.assign(new Error('Cabang aktif tidak ditemukan'), { status: 404 });
  return branch;
}

function validateInput(body: any) {
  const slotDate = String(body.slot_date || '');
  const status = body.status === 'limited' ? 'limited' : body.status === 'closed' ? 'closed' : null;
  const title = String(body.title || '').trim();
  const capacity = body.capacity_override === null || body.capacity_override === '' || body.capacity_override === undefined
    ? null
    : Number(body.capacity_override);
  if (!DATE_RE.test(slotDate) || !status || !title || title.length > 150) {
    throw Object.assign(new Error('Tanggal, status, dan keterangan wajib diisi dengan benar'), { status: 400 });
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) {
    throw Object.assign(new Error('Override kapasitas harus berupa bilangan bulat positif'), { status: 400 });
  }
  if (status === 'limited' && capacity === null) {
    throw Object.assign(new Error('Override kapasitas wajib diisi untuk status limited'), { status: 400 });
  }
  return { slotDate, status, title, capacity, notes: String(body.notes || '').trim() || null };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const month = String(req.query.month || '');
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'Parameter month harus berformat YYYY-MM' });
    const lastDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
    const data = await withTenantContext(tenantId, async (trx) => {
       const branch = await branchFor(trx, tenantId, req.user?.branch_id);
      return trx('booking_calendar_exceptions')
        .where({ tenant_id: tenantId, branch_id: branch.id })
        .whereBetween('slot_date', [`${month}-01`, lastDate])
        .orderBy('slot_date', 'asc');
    });
    return res.json({ data });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal mengambil kalender operasional' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const input = validateInput(req.body);
    const data = await withTenantContext(tenantId, async (trx) => {
       const branch = await branchFor(trx, tenantId, req.user?.branch_id);
      const [created] = await trx('booking_calendar_exceptions').insert({
        tenant_id: tenantId,
        branch_id: branch.id,
        slot_date: input.slotDate,
        status: input.status,
        capacity_override: input.capacity,
        title: input.title,
        notes: input.notes,
      }).returning('*');
      if (input.capacity !== null) {
        const slot = await trx('booking_slots').where({ tenant_id: tenantId, branch_id: branch.id, slot_date: input.slotDate }).first();
        if (slot && input.capacity < Number(slot.booked_count)) throw Object.assign(new Error('Override kapasitas tidak boleh di bawah jumlah booking yang sudah ada'), { status: 409 });
      }
      await syncBookingCalendarException(trx, tenantId, branch.id, input.slotDate);
      return created;
    });
    return res.status(201).json({ data });
  } catch (error: any) {
    return res.status(error.code === '23505' ? 409 : error.status || 500).json({ error: error.code === '23505' ? 'Tanggal tersebut sudah memiliki exception' : error.message || 'Gagal membuat exception' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const input = validateInput(req.body);
    const data = await withTenantContext(tenantId, async (trx) => {
       const existing = await trx('booking_calendar_exceptions').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).first();
      if (!existing) throw Object.assign(new Error('Exception tidak ditemukan'), { status: 404 });
      const slot = await trx('booking_slots').where({ tenant_id: tenantId, branch_id: existing.branch_id, slot_date: input.slotDate }).first();
      if (slot && input.capacity !== null && input.capacity < Number(slot.booked_count)) throw Object.assign(new Error('Override kapasitas tidak boleh di bawah jumlah booking yang sudah ada'), { status: 409 });
       const [updated] = await trx('booking_calendar_exceptions').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).update({
        slot_date: input.slotDate, status: input.status, capacity_override: input.capacity, title: input.title, notes: input.notes, updated_at: trx.fn.now(),
      }).returning('*');
      await syncBookingCalendarException(trx, tenantId, existing.branch_id, existing.slot_date);
      await syncBookingCalendarException(trx, tenantId, existing.branch_id, input.slotDate);
      return updated;
    });
    return res.json({ data });
  } catch (error: any) {
    return res.status(error.code === '23505' ? 409 : error.status || 500).json({ error: error.code === '23505' ? 'Tanggal tersebut sudah memiliki exception' : error.message || 'Gagal mengubah exception' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    await withTenantContext(tenantId, async (trx) => {
       const existing = await trx('booking_calendar_exceptions').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).first();
      if (!existing) throw Object.assign(new Error('Exception tidak ditemukan'), { status: 404 });
       await trx('booking_calendar_exceptions').where({ id: req.params.id, tenant_id: tenantId, branch_id: req.user?.branch_id }).delete();
      await syncBookingCalendarException(trx, tenantId, existing.branch_id, existing.slot_date);
    });
    return res.status(204).send();
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Gagal menghapus exception' });
  }
});

export const bookingCalendarRouter = router;
