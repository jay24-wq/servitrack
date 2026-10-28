import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';

export const notificationRouter = Router();
notificationRouter.use(authMiddleware);
notificationRouter.use(tenantResolver);

notificationRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) { res.status(401).json({ error: 'Tenant tidak teridentifikasi' }); return; }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const query = reqDb(req)('notification_logs')
      .where({ tenant_id: tenantId })
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit);
    if (typeof req.query.status === 'string' && req.query.status) query.where({ status: req.query.status });
    res.json({ data: await query });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil log notifikasi' });
  }
});
