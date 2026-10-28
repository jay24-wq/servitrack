import { withTenantContext } from '@middleware/AuthMiddleware';
import { OpenWaProvider } from './OpenWaProvider';
import type { NotificationProvider, WhatsAppNotificationInput } from './types';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

let provider: NotificationProvider | null = null;

export function getNotificationProvider() {
  return provider ??= new OpenWaProvider();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

async function updateLog(tenantId: string, id: string, patch: Record<string, unknown>) {
  await withTenantContext(tenantId, (trx) => trx('notification_logs').where({ id, tenant_id: tenantId }).update({ ...patch, updated_at: trx.fn.now() }));
}

export async function sendWhatsAppNotification(input: WhatsAppNotificationInput) {
  const toPhone = normalizePhone(input.toPhone);
  if (!toPhone) return { status: 'failed' as const, error: 'Nomor WhatsApp kosong' };

  let log: any;
  try {
    [log] = await withTenantContext(input.tenantId, (trx) => trx('notification_logs').insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      ticket_id: input.ticketId ?? null,
      quotation_id: input.quotationId ?? null,
      channel: 'whatsapp',
      template_name: input.templateName,
      to_phone: toPhone,
      status: 'queued',
    }).returning('*'));
  } catch (error: any) {
    return { status: 'failed' as const, error: error?.message ?? 'Gagal mencatat notifikasi' };
  }

  let lastError = 'OpenWA tidak tersedia';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await getNotificationProvider().sendTemplateMessage(toPhone, input.templateName, input.variables);
      await updateLog(input.tenantId, log.id, {
        status: 'sent',
        provider_msg_id: result.providerMessageId ?? null,
        sent_at: new Date(),
        error_message: null,
      });
      return { status: 'sent' as const, id: log.id, providerMessageId: result.providerMessageId };
    } catch (error: any) {
      lastError = error?.message ?? String(error);
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }

  try {
    await updateLog(input.tenantId, log.id, { status: 'failed', error_message: lastError });
  } catch {
    // The original send failure is already contained; logging must not break the business request.
  }
  return { status: 'failed' as const, id: log.id, error: lastError };
}
