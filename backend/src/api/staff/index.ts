import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { authMiddleware, AuthRequest } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { planGuard } from '@middleware/PlanGuard';
import { PLAN_LIMITS } from '../../../config/plans';

export const staffRouter = Router();

staffRouter.use(authMiddleware);
staffRouter.use(tenantResolver);

// GET /api/staff - List staff
staffRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const role = String(req.query.role || 'all').toLowerCase();
    const status = String(req.query.status || 'all').toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const sortMap: Record<string, { column: string; order: 'asc' | 'desc' }> = {
      'nama-asc': { column: 'users.name', order: 'asc' },
      'nama-desc': { column: 'users.name', order: 'desc' },
      peran: { column: 'roles.code', order: 'asc' },
      status: { column: 'users.is_active', order: 'desc' },
    };
    const selectedSort = sortMap[String(req.query.sort || 'nama-asc')] || sortMap['nama-asc'];
    const base = reqDb(req)('users')
      .join('roles', 'users.role_id', 'roles.id')
      .leftJoin('branches', 'users.branch_id', 'branches.id')
      .where({ 'users.tenant_id': tenant_id })
      .whereNull('users.deleted_at')
      .modify((query) => {
        if (role !== 'all') query.where('roles.code', role === 'technician' ? 'teknisi' : role === 'front desk' ? 'frontdesk' : role);
        if (status === 'active') query.where('users.is_active', true);
        if (status === 'inactive') query.where('users.is_active', false);
        if (search) query.where((builder) => builder.whereILike('users.name', `%${search}%`).orWhereILike('users.email', `%${search}%`).orWhereILike('users.phone', `%${search}%`));
      });
    const countRow = await base.clone().clearSelect().clearOrder().count<{ count: string }>('users.id as count').first();
    const staff = await base.clone().select('users.id', 'users.name', 'users.email', 'users.phone', 'users.is_active', 'roles.code as role', 'branches.name as branch_name', 'users.created_at').orderBy(selectedSort.column, selectedSort.order).limit(limit).offset((page - 1) * limit);
    const statsRows = await reqDb(req)('users').join('roles', 'users.role_id', 'roles.id').where({ 'users.tenant_id': tenant_id, 'users.is_active': true }).whereNull('users.deleted_at').select('roles.code as role').count('users.id as count').groupBy('roles.code') as Array<{ role: string; count: string }>;
    const [{ count: activeCount }] = await reqDb(req)('users').where({ tenant_id, is_active: true }).whereNull('deleted_at').count('id as count') as Array<{ count: string }>;
    const [{ count: totalCount }] = await reqDb(req)('users').where({ tenant_id }).whereNull('deleted_at').count('id as count') as Array<{ count: string }>;
    const byRole = Object.fromEntries(statsRows.map((row) => [row.role, Number(row.count)]));
    res.json({ data: staff, stats: { admin: byRole.admin || 0, teknisi: byRole.teknisi || 0, frontdesk: byRole.frontdesk || 0, kurir: byRole.kurir || 0, active: Number(activeCount || 0), inactive: Number(totalCount || 0) - Number(activeCount || 0) }, pagination: { page, limit, total: Number(countRow?.count || 0), totalPages: Math.max(1, Math.ceil(Number(countRow?.count || 0) / limit)) } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data staf' });
  }
});

// POST /api/staff - Add staff (Admin only, with planGuard quota check)
staffRouter.post('/', planGuard, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menambahkan staf' });
      return;
    }

    const tenant_id = req.user?.tenant_id;
    const { name, email, password, role, branch_id } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Field name, email, password, dan role wajib diisi' });
      return;
    }

    if (role === 'admin') {
      res.status(400).json({ error: 'Tidak dapat membuat staf dengan role admin melalui endpoint ini' });
      return;
    }

    // Check plan max_users limit
    const planKey = (req.user?.plan?.toUpperCase() || 'STARTER') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.STARTER;
    
    if (limits.max_users !== Infinity) {
      const [{ count }] = await reqDb(req)('users')
        .where({ tenant_id })
        .whereNull('deleted_at')
        .count('* as count');
      
      if (Number(count) >= limits.max_users) {
        res.status(403).json({ 
          error: `Batas kuota staf (${limits.max_users} pengguna) untuk paket ${planKey} telah tercapai. Upgrade paket Anda untuk menambah staf.` 
        });
        return;
      }
    }

    const roleRecord = await reqDb(req)('roles').where({ code: role }).first();
    if (!roleRecord) {
      res.status(400).json({ error: 'Role tidak valid' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [newUser] = await reqDb(req)('users')
      .insert({
        tenant_id,
        branch_id: branch_id || null,
        role_id: roleRecord.id,
        name,
        email,
        password_hash,
        is_active: true,
      })
      .returning(['id', 'name', 'email', 'created_at']);

    res.status(201).json({
      message: 'Staf berhasil ditambahkan',
      data: newUser,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email sudah terdaftar' });
      return;
    }
    res.status(500).json({ error: error.message || 'Gagal menambahkan staf' });
  }
});

// PUT /api/staff/:id - Update staff
staffRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat mengubah data staf' });
      return;
    }

    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;
    const { name, email, role, branch_id, is_active } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (email !== undefined) updateData.email = email;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone || null;
    if (branch_id !== undefined) updateData.branch_id = branch_id;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (id === req.user?.user_id && is_active === false) {
      res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri' });
      return;
    }
    
    if (role) {
      const roleRecord = await reqDb(req)('roles').where({ code: role }).first();
      if (!roleRecord) {
        res.status(400).json({ error: 'Role tidak valid' });
        return;
      }
      updateData.role_id = roleRecord.id;
    }

    const [updated] = await reqDb(req)('users')
      .where({ id, tenant_id })
      .whereNull('deleted_at')
      .update(updateData)
      .returning(['id', 'name', 'email', 'is_active']);

    if (!updated) {
      res.status(404).json({ error: 'Staf tidak ditemukan' });
      return;
    }

    res.json({ message: 'Staf berhasil diperbarui', data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui staf' });
  }
});

// DELETE /api/staff/:id - Delete (soft delete) staff
staffRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Hanya admin yang dapat menghapus staf' });
      return;
    }

    const tenant_id = req.user?.tenant_id;
    const { id } = req.params;

    if (id === req.user?.user_id) {
      res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
      return;
    }

    const updated = await reqDb(req)('users')
      .where({ id, tenant_id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), is_active: false });

    if (!updated) {
      res.status(404).json({ error: 'Staf tidak ditemukan' });
      return;
    }

    res.json({ message: 'Staf berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus staf' });
  }
});
