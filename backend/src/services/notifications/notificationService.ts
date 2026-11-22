import { withTenantContext } from '@middleware/AuthMiddleware';
import { OpenWaProvider } from './OpenWaProvider';
import type { NotificationProvider, WhatsAppNotificationInput } from './types';
import type { Knex } from 'knex';
import { renderWhatsAppTemplate } from './templates';

const RETRY_DELAY_MS = 300;
const MAX_LOG_UPDATE_ATTEMPTS = 3;
const MAX_ACTIVE_DELIVERIES = 2;

let provider: NotificationProvider | null = null;
const deliveryQueue: Array<{ input: WhatsAppNotificationInput; logId: string }> = [];
let activeDeliveries = 0;

export function isNotificationProviderConfigured() {
  return provider !== null || ['OPENWA_BASE_URL', 'OPENWA_API_KEY'].every((name) => {
    const value = process.env[name]?.trim();
    return Boolean(value && !/example\.invalid|^(your-|replace-with-)/i.test(value));
  });
}

export function getNotificationProvider() {
  return provider ??= new OpenWaProvider();
}

export function setNotificationProviderForTests(value: NotificationProvider | null) {
  provider = value;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

async function updateLog(tenantId: string, id: string, patch: Record<string, unknown>) {
  await withTenantContext(tenantId, (trx) => trx('notification_logs').where({ id, tenant_id: tenantId }).update({ ...patch, updated_at: trx.fn.now() }));
}

export async function createQueuedWhatsAppNotification(trx: Knex.Transaction, input: WhatsAppNotificationInput) {
  renderWhatsAppTemplate(input.templateName, input.variables);
  await trx('tenant_notification_settings').insert({ tenant_id: input.tenantId }).onConflict('tenant_id').ignore();
  const insert = trx('notification_logs').insert({
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    ticket_id: input.ticketId ?? null,
    quotation_id: input.quotationId ?? null,
    channel: 'whatsapp',
    template_name: input.templateName,
    dedupe_key: input.dedupeKey ?? null,
    to_phone: normalizePhone(input.toPhone),
    status: 'queued',
  });
  if (input.dedupeKey) insert.onConflict(['tenant_id', 'dedupe_key']).ignore();
  const [log] = await insert.returning('id');
  return (log?.id as string | undefined) ?? null;
}

export function enqueueWhatsAppNotification(input: WhatsAppNotificationInput, logId: string) {
  deliveryQueue.push({ input, logId });
  drainDeliveryQueue();
}

function drainDeliveryQueue() {
  while (activeDeliveries < MAX_ACTIVE_DELIVERIES && deliveryQueue.length > 0) {
    const job = deliveryQueue.shift()!;
    activeDeliveries += 1;
    void sendWhatsAppNotification(job.input, job.logId)
      .catch(async (error: any) => {
        const message = error?.message ?? String(error);
        try {
          await updateLog(job.input.tenantId, job.logId, {
            status: 'failed', error_code: 'DELIVERY_ERROR', error_message: message,
          });
          await auditDelivery(job.input, job.logId, 'failed', null, message);
        } catch (loggingError) {
          console.error('[WhatsApp] gagal mencatat error pengiriman', loggingError);
        }
        console.error('[WhatsApp] pengiriman gagal', error);
      })
      .finally(() => {
        activeDeliveries -= 1;
        drainDeliveryQueue();
      });
  }
}

async function auditDelivery(input: WhatsAppNotificationInput, logId: string, status: string, providerMessageId?: string | null, note?: string) {
  try {
    await withTenantContext(input.tenantId, (trx) => trx('audit_logs').insert({
      tenant_id: input.tenantId,
      action: `whatsapp.delivery_${status}`,
      entity_type: 'notification',
      entity_id: logId,
      ticket_id: input.ticketId ?? null,
      quotation_id: input.quotationId ?? null,
      notification_id: logId,
      actor_type: 'system',
      new_values: { template: input.templateName, status, provider_message_id: providerMessageId ?? null },
      note: note ?? null,
    }));
  } catch (error) {
    console.error('[WhatsApp] audit log gagal', error);
  }
}

export async function sendWhatsAppNotification(input: WhatsAppNotificationInput, queuedLogId?: string) {
  const toPhone = normalizePhone(input.toPhone);
  try {
    renderWhatsAppTemplate(input.templateName, input.variables);
  } catch (error: any) {
    const message = error?.message ?? 'Template WhatsApp tidak valid';
    console.error('[WhatsApp] notifikasi tidak dapat dirender', error);
    if (queuedLogId) {
      await updateLog(input.tenantId, queuedLogId, { status: 'failed', error_code: 'INVALID_TEMPLATE', error_message: message }).catch(() => undefined);
    }
    return { status: 'failed' as const, error: message, errorCode: 'INVALID_TEMPLATE' as const };
  }

  let log: any;
  let channelEnabled = false;
  try {
    const context = await withTenantContext(input.tenantId, async (trx) => {
      if (!queuedLogId) {
        await trx('tenant_notification_settings').insert({ tenant_id: input.tenantId }).onConflict('tenant_id').ignore();
      }
      const settings = await trx('tenant_notification_settings').where({ tenant_id: input.tenantId }).select('channels').first();
      if (queuedLogId) return { log: { id: queuedLogId }, channelEnabled: settings?.channels?.whatsapp === true };

      const insert = trx('notification_logs').insert({
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        ticket_id: input.ticketId ?? null,
        quotation_id: input.quotationId ?? null,
        channel: 'whatsapp',
        template_name: input.templateName,
        dedupe_key: input.dedupeKey ?? null,
        to_phone: toPhone,
        status: 'queued',
      });
      if (input.dedupeKey) insert.onConflict(['tenant_id', 'dedupe_key']).ignore();
      const [queuedLog] = await insert.returning('*');
      if (!queuedLog) return { log: null, channelEnabled: settings?.channels?.whatsapp === true };
      return { log: queuedLog, channelEnabled: settings?.channels?.whatsapp === true };
    });
    log = context.log;
    channelEnabled = context.channelEnabled;
    if (!log) return { status: 'skipped' as const };
    await auditDelivery(input, log.id, 'queued');
  } catch (error: any) {
    return { status: 'failed' as const, error: error?.message ?? 'Gagal mencatat notifikasi' };
  }

  if (!channelEnabled) {
    const error = 'notifikasi WhatsApp dinonaktifkan';
    await updateLog(input.tenantId, log.id, { status: 'failed', error_code: 'CHANNEL_DISABLED', error_message: error });
    await auditDelivery(input, log.id, 'failed', null, error);
    return { status: 'failed' as const, id: log.id, error, errorCode: 'CHANNEL_DISABLED' as const };
  }

  if (!toPhone) {
    await updateLog(input.tenantId, log.id, { status: 'failed', error_code: 'PHONE_MISSING', error_message: 'Nomor WhatsApp kosong' });
    await auditDelivery(input, log.id, 'failed', null, 'Nomor WhatsApp kosong');
    return { status: 'failed' as const, id: log.id, error: 'Nomor WhatsApp kosong' };
  }

  if (!isNotificationProviderConfigured()) {
    const error = 'provider tidak dikonfigurasi';
    await updateLog(input.tenantId, log.id, {
      status: 'failed',
      error_code: 'PROVIDER_NOT_CONFIGURED',
      error_message: error,
      approval_url: process.env.NODE_ENV === 'development' ? input.approvalUrl ?? null : null,
    });
    await auditDelivery(input, log.id, 'failed', null, error);
    return { status: 'failed' as const, id: log.id, error, errorCode: 'PROVIDER_NOT_CONFIGURED' as const };
  }

  let lastError = 'OpenWA tidak tersedia';
  let providerMessageId: string | null | undefined;
  let sent = false;
  try {
    // A timeout can happen after OpenWA accepted the message, so retrying can send duplicates.
    await updateLog(input.tenantId, log.id, { status: 'queued', attempt_count: 1, last_attempt_at: new Date(), error_code: null, error_message: null });
    const result = await getNotificationProvider().sendTemplateMessage(input.tenantId, toPhone, input.templateName, input.variables);
    providerMessageId = result.providerMessageId;
    sent = true;
  } catch (error: any) {
    lastError = error?.message ?? String(error);
  }

  if (sent) {
    for (let attempt = 1; attempt <= MAX_LOG_UPDATE_ATTEMPTS; attempt += 1) {
      try {
        await updateLog(input.tenantId, log.id, {
          status: 'sent',
          provider_msg_id: providerMessageId ?? null,
          sent_at: new Date(),
          error_message: null,
        });
        break;
      } catch (error) {
        if (attempt === MAX_LOG_UPDATE_ATTEMPTS) console.error('[WhatsApp] pesan terkirim, tetapi status log belum tersimpan', error);
        else await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
    await auditDelivery(input, log.id, 'sent', providerMessageId ?? null);
    return { status: 'sent' as const, id: log.id, providerMessageId };
  }

  try {
    await updateLog(input.tenantId, log.id, { status: 'failed', error_code: 'PROVIDER_SEND_FAILED', error_message: lastError });
    await auditDelivery(input, log.id, 'failed', null, lastError);
  } catch {
    // The original send failure is already contained; logging must not break the business request.
  }
  return { status: 'failed' as const, id: log.id, error: lastError, errorCode: 'PROVIDER_SEND_FAILED' as const };
}
