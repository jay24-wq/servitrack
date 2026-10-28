import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '@models/index';
import { authMiddleware } from '@middleware/AuthMiddleware';
import { tenantResolver } from '@middleware/TenantResolver';
import { planGuard } from '@middleware/PlanGuard';
import { PLAN_LIMITS } from '../../../config/plans';
export const staffRouter = Router();
staffRouter.use(authMiddleware);
staffRouter.use(tenantResolver);
// GET /api/staff - List staff
staffRouter.get('/', async (req, res) => {
    try {
        const tenant_id = req.user?.tenant_id;
        const staff = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .leftJoin('branches', 'users.branch_id', 'branches.id')
            .where({ 'users.tenant_id': tenant_id })
            .whereNull('users.deleted_at')
            .select('users.id', 'users.name', 'users.email', 'users.is_active', 'roles.code as role', 'branches.name as branch_name', 'users.created_at');
        res.json({ data: staff });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mengambil data staf' });
    }
});
// POST /api/staff - Add staff (Admin only, with planGuard quota check)
staffRouter.post('/', planGuard, async (req, res) => {
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
        const planKey = (req.user?.plan?.toUpperCase() || 'STARTER');
        const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.STARTER;
        if (limits.max_users !== Infinity) {
            const [{ count }] = await db('users')
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
        const roleRecord = await db('roles').where({ code: role }).first();
        if (!roleRecord) {
            res.status(400).json({ error: 'Role tidak valid' });
            return;
        }
        const password_hash = await bcrypt.hash(password, 10);
        const [newUser] = await db('users')
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
    }
    catch (error) {
        if (error.code === '23505') {
            res.status(409).json({ error: 'Email sudah terdaftar' });
            return;
        }
        res.status(500).json({ error: error.message || 'Gagal menambahkan staf' });
    }
});
// PUT /api/staff/:id - Update staff
staffRouter.put('/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            res.status(403).json({ error: 'Hanya admin yang dapat mengubah data staf' });
            return;
        }
        const tenant_id = req.user?.tenant_id;
        const { id } = req.params;
        const { name, email, role, branch_id, is_active } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (email !== undefined)
            updateData.email = email;
        if (branch_id !== undefined)
            updateData.branch_id = branch_id;
        if (is_active !== undefined)
            updateData.is_active = is_active;
        if (role) {
            const roleRecord = await db('roles').where({ code: role }).first();
            if (!roleRecord) {
                res.status(400).json({ error: 'Role tidak valid' });
                return;
            }
            updateData.role_id = roleRecord.id;
        }
        const [updated] = await db('users')
            .where({ id, tenant_id })
            .whereNull('deleted_at')
            .update(updateData)
            .returning(['id', 'name', 'email', 'is_active']);
        if (!updated) {
            res.status(404).json({ error: 'Staf tidak ditemukan' });
            return;
        }
        res.json({ message: 'Staf berhasil diperbarui', data: updated });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memperbarui staf' });
    }
});
// DELETE /api/staff/:id - Delete (soft delete) staff
staffRouter.delete('/:id', async (req, res) => {
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
        const updated = await db('users')
            .where({ id, tenant_id })
            .whereNull('deleted_at')
            .update({ deleted_at: new Date(), is_active: false });
        if (!updated) {
            res.status(404).json({ error: 'Staf tidak ditemukan' });
            return;
        }
        res.json({ message: 'Staf berhasil dihapus' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menghapus staf' });
    }
});
//# sourceMappingURL=index.js.map