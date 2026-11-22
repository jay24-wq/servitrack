import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole, withTenantContext } from '@middleware/AuthMiddleware';
import { reqDb, tenantResolver } from '@middleware/TenantResolver';
import { logAudit } from '@services/auditLog';
import { OpenWaProvider, normalizeWhatsAppPhone, openWaErrorMessage } from '@services/notifications/OpenWaProvider';
import { buildConnectionTestNotification } from '@common/utils/whatsappTemplates';

export const whatsappRouter = Router();
whatsappRouter.use(authMiddleware);
whatsappRouter.use(tenantResolver);
whatsappRouter.use(requireRole('admin'));

function provider() {
  return new OpenWaProvider();
}

function tenantIdFromRequest(req: AuthRequest) {
  return req.user?.tenant_id;
}

async function auditVerification(req: AuthRequest, status: Awaited<ReturnType<OpenWaProvider['getTenantStatus']>>) {
  if (!status.verification_changed) return;
  await logAudit(reqDb(req), req, {
    action: 'whatsapp.number_verification',
    entityType: 'tenant_settings',
    entityId: tenantIdFromRequest(req),
    newValues: {
      result: status.phone_matches === true ? 'matched' : status.phone_matches === false ? 'mismatch' : 'unavailable',
      session_status: status.session_status,
    },
  });
}

whatsappRouter.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
    const query = reqDb(req);
    const [status, actor] = await Promise.all([
      provider().getTenantStatus(tenantId),
      query('users').where({ id: req.user?.user_id, tenant_id: tenantId }).select('phone').first(),
    ]);
    await auditVerification(req, status);
    const { verification_changed: _verificationChanged, ...publicStatus } = status;
    return res.json({ data: { ...publicStatus, test_recipient_default: actor?.phone ?? null } });
  } catch (error: any) {
    return res.status(503).json({ error: openWaErrorMessage(error) });
  }
});

whatsappRouter.post('/connect', async (req: AuthRequest, res: Response) => {
  const tenantId = tenantIdFromRequest(req);
  if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
  try {
    const status = await provider().connectTenant(tenantId);
    await auditVerification(req, status);
    await logAudit(reqDb(req), req, {
      action: 'whatsapp.connect',
      entityType: 'tenant_settings',
      entityId: tenantId,
      newValues: { result: 'started', session_status: status.session_status },
    });
    const { verification_changed: _verificationChanged, ...publicStatus } = status;
    return res.json({ data: publicStatus });
  } catch (error: any) {
    const message = openWaErrorMessage(error);
    try {
      await logAudit(reqDb(req), req, {
        action: 'whatsapp.connect',
        entityType: 'tenant_settings',
        entityId: tenantId,
        newValues: { result: 'failed', reason: message },
        note: message,
      });
    } catch { /* keep the OpenWA error as the response */ }
    return res.status(502).json({ error: message });
  }
});

whatsappRouter.post('/disconnect', async (req: AuthRequest, res: Response) => {
  const tenantId = tenantIdFromRequest(req);
  if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
  try {
    const status = await provider().disconnectTenant(tenantId);
    await logAudit(reqDb(req), req, {
      action: 'whatsapp.disconnect',
      entityType: 'tenant_settings',
      entityId: tenantId,
      newValues: { result: 'disconnected', session_status: status.session_status, connected_phone_cleared: true },
    });
    const { verification_changed: _verificationChanged, ...publicStatus } = status;
    return res.json({ data: publicStatus });
  } catch (error: any) {
    const message = openWaErrorMessage(error);
    try {
      await logAudit(reqDb(req), req, {
        action: 'whatsapp.disconnect',
        entityType: 'tenant_settings',
        entityId: tenantId,
        newValues: { result: 'failed', reason: message },
        note: message,
      });
    } catch { /* keep the OpenWA error as the response */ }
    return res.status(502).json({ error: message });
  }
});

whatsappRouter.post('/test', async (req: AuthRequest, res: Response) => {
  const tenantId = tenantIdFromRequest(req);
  if (!tenantId) return res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
  const suppliedPhone = String(req.body?.to_phone ?? '').replace(/\D/g, '');
  const phone = /^(62|0|8)/.test(suppliedPhone) ? normalizeWhatsAppPhone(suppliedPhone) : '';
  if (!/^62\d{7,13}$/.test(phone)) return res.status(400).json({ error: 'Nomor tujuan harus berisi nomor WhatsApp Indonesia yang valid' });

  let notificationId: string | null = null;
  try {
    notificationId = await withTenantContext(tenantId, async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`openwa-test:${tenantId}`]);
      const recent = await trx('notification_logs')
        .where({ tenant_id: tenantId, notification_type: 'connection_test' })
        .whereRaw("created_at >= now() - interval '10 minutes'")
        .count('* as count')
        .first();
      if (Number(recent?.count ?? 0) >= 5) return null;
      const [row] = await trx('notification_logs').insert({
        tenant_id: tenantId,
        customer_id: null,
        channel: 'whatsapp',
        notification_type: 'connection_test',
        template_name: 'connection_test',
        to_phone: phone,
        status: 'queued',
      }).returning('id');
      return row.id as string;
    });

    if (!notificationId) {
      await logAudit(reqDb(req), req, {
        action: 'whatsapp.connection_test',
        entityType: 'notification',
        newValues: { result: 'rate_limited' },
        note: 'Batas 5 pesan percobaan per 10 menit tercapai',
      });
      return res.status(429).json({ error: 'Batas 5 pesan percobaan per 10 menit tercapai. Coba lagi nanti.' });
    }

    const query = reqDb(req);
    const [status, tenant] = await Promise.all([
      provider().getTenantStatus(tenantId, false),
      query('tenants').where({ id: tenantId }).select('name').first(),
    ]);
    await auditVerification(req, status);
    if (!status.connected) {
      const reason = !status.openwa_reachable || status.session_status === 'openwa_unreachable'
        ? 'OpenWA tidak terjangkau'
        : status.session_status === 'number_mismatch'
        ? 'Nomor WhatsApp tenant tidak cocok dengan tenants.phone'
        : status.session_status === 'number_unavailable'
          ? 'Nomor tidak tersedia dari OpenWA'
          : 'WhatsApp tenant belum terhubung';
      await query('notification_logs').where({ id: notificationId, tenant_id: tenantId }).update({
        status: 'failed', error_code: 'WHATSAPP_NOT_CONNECTED', error_message: reason, updated_at: query.fn.now(),
      });
      await logAudit(query, req, {
        action: 'whatsapp.connection_test', entityType: 'notification', entityId: notificationId, notificationId,
        newValues: { result: 'failed', reason }, note: reason,
      });
      return res.status(409).json({ error: reason });
    }

    const text = buildConnectionTestNotification({ workshopName: tenant?.name ?? '' });
    const result = await provider().sendTextMessage(tenantId, phone, text);
    try {
      await query('notification_logs').where({ id: notificationId, tenant_id: tenantId }).update({
        status: 'sent', provider_msg_id: result.providerMessageId ?? null, sent_at: new Date(), updated_at: query.fn.now(),
      });
      await logAudit(query, req, {
        action: 'whatsapp.connection_test', entityType: 'notification', entityId: notificationId, notificationId,
        newValues: { result: 'sent', provider_message_id: result.providerMessageId ?? null },
      });
    } catch (loggingError) {
      console.error('[WhatsApp] pesan percobaan terkirim, tetapi log belum tersimpan', loggingError);
    }
    return res.json({ data: { status: 'sent', provider_message_id: result.providerMessageId ?? null } });
  } catch (error: any) {
    const rawMessage = error?.message || 'Gagal mengirim pesan percobaan';
    const reason = rawMessage.startsWith('WhatsApp tenant belum terhubung') || rawMessage.startsWith('Nomor WhatsApp tenant tidak cocok') || rawMessage === 'Nomor tidak tersedia dari OpenWA'
      ? rawMessage
      : openWaErrorMessage(error);
    if (notificationId) {
      try {
        const query = reqDb(req);
        await query('notification_logs').where({ id: notificationId, tenant_id: tenantId }).update({
          status: 'failed', error_code: 'PROVIDER_SEND_FAILED', error_message: reason, updated_at: query.fn.now(),
        });
        await logAudit(query, req, {
          action: 'whatsapp.connection_test', entityType: 'notification', entityId: notificationId, notificationId,
          newValues: { result: 'failed', reason }, note: reason,
        });
      } catch { /* preserve the provider failure response */ }
    }
    return res.status(502).json({ error: reason });
  }
});
