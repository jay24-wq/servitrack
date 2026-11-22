import db from '@models/index';
import { withTenantContext } from '@middleware/AuthMiddleware';
import { notifyQuotationReminder } from '@services/notifications/events';
import { createQuotationToken, hashQuotationToken } from '@utils/quotationToken';
import { transitionQuotationPartRequests } from '@services/partRequests';

const DEFAULT_AUTO_OFFLINE_TIME = '00:00';

function currentTime(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export async function runAutoOfflineStaff() {
  const result = await db.raw('SELECT public.auto_offline_staff() AS affected');
  return Number(result.rows?.[0]?.affected || 0);
}

export function startAvailabilityScheduler() {
  const target = process.env.AUTO_OFFLINE_TIME || DEFAULT_AUTO_OFFLINE_TIME;
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  let lastRunDate = '';
  const tick = () => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    if (currentTime(timeZone) !== target || lastRunDate === date) return;
    lastRunDate = date;
    void runAutoOfflineStaff().catch((error) => console.error('[Availability] auto-offline gagal', error));
  };
  const timer = setInterval(tick, 60_000);
  timer.unref?.();
  tick();
  return () => clearInterval(timer);
}

export async function runQuotationMaintenance() {
  const tenantResult = await db.raw('SELECT id FROM public.list_tenant_ids_for_maintenance()');
  let expiredCount = 0;
  let reminderCount = 0;
  for (const { id: tenantId } of tenantResult.rows as Array<{ id: string }>) {
    const reminders = await withTenantContext(tenantId, async (trx) => {
      const expired = await trx('quotations')
        .where({ tenant_id: tenantId, status: 'sent' })
        .where('expires_at', '<=', trx.fn.now())
        .update({ status: 'expired', decided_at: trx.fn.now(), decision_note: 'Masa berlaku quotation habis' })
        .returning(['id', 'ticket_id']);
      expiredCount += expired.length;
      for (const quote of expired) {
        await transitionQuotationPartRequests(trx, {
          tenantId, quotationId: quote.id, to: 'CANCELLED', reason: 'Quotation kedaluwarsa otomatis',
        });
        await trx('audit_logs').insert({
          tenant_id: tenantId, action: 'quotation.expired', entity_type: 'quotation', entity_id: quote.id,
          ticket_id: quote.ticket_id, quotation_id: quote.id, actor_type: 'system',
          old_values: { status: 'sent' }, new_values: { status: 'expired' }, note: 'Masa berlaku quotation habis',
        });
      }

      const settings = await trx('tenant_notification_settings').where({ tenant_id: tenantId }).select('channels').first();
      if (settings?.channels?.whatsapp !== true) return [];

      const due = await trx('quotations as q')
        .join('service_tickets as t', 't.id', 'q.ticket_id')
        .join('customers as c', 'c.id', 't.customer_id')
        .where({ 'q.tenant_id': tenantId, 'q.status': 'sent' })
        .where('q.expires_at', '>', trx.fn.now())
        .whereNotNull('c.phone_wa')
        .whereNot('c.phone_wa', '')
        .whereRaw("q.created_at <= now() - interval '24 hours'")
        .where((query) => query.whereNull('q.last_reminder_at').orWhereRaw("q.last_reminder_at <= now() - interval '24 hours'"))
        .select('q.id', 'q.ticket_id', 'q.total_amount', 'q.expires_at', 't.ticket_code', 't.tracking_code', 't.complaint', 't.technician_diagnosis', 't.additional_damage', 'c.id as customer_id', 'c.phone_wa')
        .orderBy('q.created_at', 'asc')
        .limit(100);
      const pending = [];
      for (const quote of due) {
        const token = createQuotationToken();
        const updated = await trx('quotations')
          .where({ id: quote.id, tenant_id: tenantId, status: 'sent' })
          .where('expires_at', '>', trx.fn.now())
          .update({ approval_token_hash: hashQuotationToken(token), last_reminder_at: trx.fn.now() })
          .returning('id');
        if (!updated.length) continue;
        await trx('audit_logs').insert({
          tenant_id: tenantId, action: 'quotation.reminder_queued', entity_type: 'quotation', entity_id: quote.id,
          ticket_id: quote.ticket_id, quotation_id: quote.id, actor_type: 'system',
          new_values: { status: 'sent', token_rotated: true }, note: 'Token approval dirotasi untuk pengingat otomatis',
        });
        pending.push({ ...quote, token });
      }
      return pending;
    });

    for (const item of reminders) {
      const notification = await notifyQuotationReminder({
        tenantId, customerId: item.customer_id, phone: item.phone_wa ?? '', ticketId: item.ticket_id,
        quotationId: item.id, quotationNumber: `QUO-${item.id.slice(0, 8).toUpperCase()}`,
        totalAmount: Number(item.total_amount), approvalToken: item.token, ticketCode: item.ticket_code,
        trackingCode: item.tracking_code, expiresAt: item.expires_at,
      });
      await withTenantContext(tenantId, async (trx) => {
        await trx('audit_logs').insert({
          tenant_id: tenantId, action: notification.status === 'sent' ? 'quotation.reminder_sent' : 'quotation.reminder_failed',
          entity_type: 'quotation', entity_id: item.id, ticket_id: item.ticket_id, quotation_id: item.id,
          notification_id: 'id' in notification ? notification.id : null, actor_type: 'system',
          new_values: { notification_status: notification.status, provider_message_id: 'providerMessageId' in notification ? notification.providerMessageId ?? null : null },
        });
      });
      reminderCount += 1;
    }
  }
  return { expiredCount, reminderCount };
}

export function startQuotationScheduler() {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void runQuotationMaintenance()
      .catch((error) => console.error('[Quotation] maintenance gagal', error))
      .finally(() => { running = false; });
  };
  const timer = setInterval(tick, 15 * 60_000);
  timer.unref?.();
  tick();
  return () => clearInterval(timer);
}
