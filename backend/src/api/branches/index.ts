import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { branchListScopeForUser } from '@middleware/branchAccess';

export const branchRouter = Router();

branchRouter.use(authMiddleware, tenantResolver);

branchRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.user_id;
    if (!tenantId || !userId) return res.status(401).json({ error: 'Tenant atau pengguna tidak teridentifikasi' });

    const query = reqDb(req);
    const user = await query('users')
      .join('roles', 'roles.id', 'users.role_id')
      .where({ 'users.id': userId, 'users.tenant_id': tenantId, 'users.is_active': true })
      .whereNull('users.deleted_at')
      .select('users.branch_id', 'roles.code as role')
      .first();
    if (!user) return res.status(403).json({ error: 'Pengguna tidak aktif atau tidak valid' });

    const scope = branchListScopeForUser(user.role, user.branch_id);
    if (scope.kind === 'none') return res.json({ data: [] });

    const branchesQuery = query('branches').where({ tenant_id: tenantId, is_active: true });
    if (scope.kind === 'branch') branchesQuery.where({ id: scope.branchId });

    const branches = await branchesQuery
      .select('id', 'tenant_id', 'name', 'address', 'is_main')
      .orderBy([{ column: 'is_main', order: 'desc' }, { column: 'name', order: 'asc' }]);

    return res.json({ data: branches });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memuat daftar cabang' });
  }
});
