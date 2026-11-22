import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';
import { logAudit } from '@services/auditLog';

export const notificationRouter = Router();
notificationRouter.use(authMiddleware);
notificationRouter.use(tenantResolver);

const EVENT_KEYS = [
  'booking_new',
  'booking_pickup_new',
  'booking_cancelled',
  'courier_assignment_new',
  'courier_assignment_pending',
  'pickup_today',
  'delivery_today',
  'device_ready_diagnosis',
  'device_ready_repair',
  'device_repair_complete',
  'booking_capacity_nearly_full',
  'queue_over_capacity',
  'subscription_expiring',
  'user_quota_nearly_full',
  'branch_quota_nearly_full',
] as const;
const CHANNEL_KEYS = ['whatsapp', 'email', 'in_app'] as const;

function hasBooleanKeys(value: unknown, keys: readonly string[]): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === keys.length && keys.every((key) => typeof record[key] === 'boolean');
}

notificationRouter.get('/settings', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });

    const query = reqDb(req);
    await query('tenant_notification_settings').insert({ tenant_id: tenantId }).onConflict('tenant_id').ignore();
    const settings = await query('tenant_notification_settings').where({ tenant_id: tenantId }).first();
    if (!settings) return res.status(404).json({ error: 'Pengaturan notifikasi tidak ditemukan' });
    return res.json({ data: { event_preferences: settings.event_preferences, channels: settings.channels, updated_at: settings.updated_at } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil pengaturan notifikasi' });
  }
});

notificationRouter.put('/settings', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const { event_preferences, channels } = req.body ?? {};
    if (!hasBooleanKeys(event_preferences, EVENT_KEYS) || !hasBooleanKeys(channels, CHANNEL_KEYS)) {
      return res.status(400).json({ error: 'Pengaturan event dan channel notifikasi tidak valid' });
    }

    const query = reqDb(req);
    const previous = await query('tenant_notification_settings').where({ tenant_id: tenantId }).first();
    await query('tenant_notification_settings')
      .insert({ tenant_id: tenantId, event_preferences, channels })
      .onConflict('tenant_id')
      .merge({ event_preferences, channels, updated_at: query.fn.now() });
    const settings = await query('tenant_notification_settings').where({ tenant_id: tenantId }).first();
    await logAudit(query, req, {
      action: 'settings.notifications_updated',
      entityType: 'tenant_settings',
      entityId: tenantId,
      oldValues: previous ? { event_preferences: previous.event_preferences, channels: previous.channels } : null,
      newValues: { event_preferences: settings.event_preferences, channels: settings.channels },
    });
    return res.json({ message: 'Pengaturan notifikasi berhasil disimpan', data: { event_preferences: settings.event_preferences, channels: settings.channels, updated_at: settings.updated_at } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal menyimpan pengaturan notifikasi' });
  }
});

notificationRouter.get('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) { res.status(401).json({ error: 'Tenant tidak teridentifikasi' }); return; }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const query = reqDb(req)('notification_logs')
      .where({ tenant_id: tenantId, notification_type: 'customer' })
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit);
    if (typeof req.query.status === 'string' && req.query.status) query.where({ status: req.query.status });
    const notifications = await query;
    if (process.env.NODE_ENV !== 'development') notifications.forEach((notification: any) => delete notification.approval_url);
    res.json({ data: notifications });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil log notifikasi' });
  }
});
