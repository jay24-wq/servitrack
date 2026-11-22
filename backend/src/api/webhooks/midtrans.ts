import { Router, Request, Response } from 'express';
import db from '@models/index';
import { withTenantContext } from '@middleware/AuthMiddleware';
import { notifyPaymentReceived } from '@services/notifications/events';
import { isMidtransSuccessNotification, midtransSettings, tenantIdFromMidtransOrderId, verifyMidtransSignature } from '@services/payments/MidtransGateway';

export const midtransWebhookRouter = Router();

type MidtransNotice = Record<string, any>;

function safePayload(payload: MidtransNotice) {
  const redact = (value: any): any => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) =>
        /server.?key|signature.?secret/i.test(key) ? [key, '[REDACTED]'] : [key, redact(child)]
      ));
    }
    return value;
  };
  return redact(payload);
}

async function logUnscoped(payload: MidtransNotice, signatureValid: boolean | null, result: string) {
  await db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', '', true)");
    await trx('payment_gateway_webhook_logs').insert({
      tenant_id: null, gateway: 'midtrans', order_id: typeof payload.order_id === 'string' ? payload.order_id.slice(0, 50) : null,
      payload: JSON.stringify(safePayload(payload)), signature_valid: signatureValid, result,
    });
  });
}

async function logScoped(trx: any, tenantId: string, payload: MidtransNotice, paymentId: string | null, signatureValid: boolean, result: string) {
  await trx('payment_gateway_webhook_logs').insert({
    tenant_id: tenantId, payment_id: paymentId, gateway: 'midtrans', order_id: String(payload.order_id ?? '').slice(0, 50),
    payload: JSON.stringify(safePayload(payload)), signature_valid: signatureValid, result,
  });
}

function audit(trx: any, tenantId: string, action: string, paymentId: string | null, invoiceId: string | null, payload: MidtransNotice, result: string) {
  return trx('audit_logs').insert({
    tenant_id: tenantId, action, entity_type: 'payment_webhook', entity_id: paymentId,
    actor_type: 'system',
    new_values: { gateway: 'midtrans', order_id: payload.order_id ?? null, transaction_id: payload.transaction_id ?? null, status: payload.transaction_status ?? null, result },
    note: invoiceId ? `invoice:${invoiceId}` : null,
  });
}

midtransWebhookRouter.post('/', async (req: Request, res: Response) => {
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body as MidtransNotice : {};
  let settings;
  try {
    settings = midtransSettings();
  } catch {
    await logUnscoped(payload, null, 'configuration_invalid').catch(() => undefined);
    return res.status(503).json({ error: 'Verifikasi Midtrans belum dikonfigurasi' });
  }
  if (!settings) {
    await logUnscoped(payload, null, 'configuration_missing').catch(() => undefined);
    return res.status(503).json({ error: 'Verifikasi Midtrans belum dikonfigurasi' });
  }

  const signatureValid = verifyMidtransSignature(payload, settings.signatureKey);
  if (!signatureValid) {
    await logUnscoped(payload, false, 'signature_invalid').catch(() => undefined);
    return res.status(403).json({ error: 'Signature Midtrans tidak valid' });
  }

  const tenantId = tenantIdFromMidtransOrderId(payload.order_id);
  if (!tenantId) {
    await logUnscoped(payload, true, 'order_id_invalid').catch(() => undefined);
    return res.status(400).json({ error: 'Order ID Midtrans tidak valid' });
  }

  try {
    const tenantExists = await withTenantContext(tenantId, async (trx) => Boolean(await trx('tenants').where({ id: tenantId }).first('id')));
    if (!tenantExists) {
      await logUnscoped(payload, true, 'tenant_not_found');
      return res.status(400).json({ error: 'Tenant pada Order ID tidak ditemukan' });
    }
    const result = await withTenantContext(tenantId, async (trx) => {
      const payment = await trx('payments').where({ tenant_id: tenantId, order_id: payload.order_id, gateway: 'midtrans' }).forUpdate().first();
      if (!payment) {
        await logScoped(trx, tenantId, payload, null, true, 'order_not_found');
        await audit(trx, tenantId, 'payment.webhook_rejected', null, null, payload, 'order_not_found');
        return { outcome: 'order_not_found' as const, httpStatus: 404 };
      }
      const invoice = await trx('invoices').where({ id: payment.invoice_id, tenant_id: tenantId }).forUpdate().first();
      if (!invoice || Number(payment.amount) !== Number(invoice.total) || Number(payload.gross_amount) !== Number(invoice.total) || payload.currency && payload.currency !== 'IDR') {
        await logScoped(trx, tenantId, payload, payment.id, true, 'amount_or_invoice_mismatch');
        await audit(trx, tenantId, 'payment.webhook_rejected', payment.id, invoice?.id ?? null, payload, 'amount_or_invoice_mismatch');
        return { outcome: 'amount_or_invoice_mismatch' as const, httpStatus: 400 };
      }

      const transactionId = typeof payload.transaction_id === 'string' ? payload.transaction_id : null;
      const transactionStatus = String(payload.transaction_status ?? '').toLowerCase();
      const success = isMidtransSuccessNotification(payload);

      if (success && payment.status === 'paid' && payment.gateway_transaction_id === transactionId) {
        await logScoped(trx, tenantId, payload, payment.id, true, 'duplicate_success_ignored');
        await audit(trx, tenantId, 'payment.webhook_duplicate', payment.id, invoice.id, payload, 'duplicate_success_ignored');
        return { outcome: 'duplicate_success_ignored' as const, httpStatus: 200 };
      }

      if (success && payment.status === 'refunding') {
        await logScoped(trx, tenantId, payload, payment.id, true, 'refund_in_progress_success_ignored');
        await audit(trx, tenantId, 'payment.webhook_duplicate', payment.id, invoice.id, payload, 'refund_in_progress_success_ignored');
        return { outcome: 'refund_in_progress_success_ignored' as const, httpStatus: 200 };
      }

      if (success && (invoice.status === 'paid' || invoice.status === 'cancelled' || payment.status === 'paid')) {
        if (payment.status !== 'paid') {
          await trx('payments').where({ id: payment.id, tenant_id: tenantId }).update({
            status: 'anomaly', gateway_status: transactionStatus, gateway_transaction_id: transactionId, updated_at: trx.fn.now(),
          });
        }
        await logScoped(trx, tenantId, payload, payment.id, true, 'success_after_invoice_paid_anomaly');
        await audit(trx, tenantId, 'payment.success_anomaly', payment.id, invoice.id, payload, 'success_after_invoice_paid_anomaly');
        return { outcome: 'success_after_invoice_paid_anomaly' as const, httpStatus: 200 };
      }

      if (success) {
        const [updated] = await trx('payments').where({ id: payment.id, tenant_id: tenantId }).update({
          status: 'paid', gateway_status: transactionStatus, gateway_transaction_id: transactionId,
          gateway_payment_type: typeof payload.payment_type === 'string' ? payload.payment_type : null,
          paid_at: payment.paid_at ?? new Date(), updated_at: trx.fn.now(),
        }).returning('*');
        await trx('invoices').where({ id: invoice.id, tenant_id: tenantId }).update({ status: 'paid', updated_at: trx.fn.now() });
        const ticket = await trx('service_tickets').where({ id: invoice.ticket_id, tenant_id: tenantId }).forUpdate().first();
        if (ticket && ['selesai', 'batal'].includes(ticket.current_status)) {
          await trx('service_tickets').where({ id: ticket.id, tenant_id: tenantId }).update({ current_status: 'siap_diambil', updated_at: trx.fn.now() });
          await trx('ticket_status_logs').insert({ tenant_id: tenantId, ticket_id: ticket.id, changed_by: null, from_status: ticket.current_status, to_status: 'siap_diambil', note: 'Invoice lunas; siap diserahkan' });
        }
        await logScoped(trx, tenantId, payload, payment.id, true, 'payment_settled');
        await audit(trx, tenantId, 'payment.webhook_received', payment.id, invoice.id, payload, 'payment_settled');
        await trx('audit_logs').insert({
          tenant_id: tenantId, action: 'payment.paid', entity_type: 'invoice', entity_id: invoice.id,
          ticket_id: invoice.ticket_id, actor_type: 'system',
          old_values: { status: invoice.status }, new_values: { status: 'paid', gateway: 'midtrans', order_id: payment.order_id },
        });
        await trx('audit_logs').insert({
          tenant_id: tenantId, action: 'invoice.paid', entity_type: 'invoice', entity_id: invoice.id,
          ticket_id: invoice.ticket_id, actor_type: 'system',
          old_values: { status: invoice.status }, new_values: { status: 'paid', payment_id: payment.id },
        });
        return { outcome: 'payment_settled' as const, httpStatus: 200, invoice, payment: updated, ticket };
      }

      const terminalStatus = transactionStatus === 'expire' ? 'expired' : transactionStatus === 'cancel' ? 'cancelled' :
        ['deny', 'failure'].includes(transactionStatus) ? 'failed' : null;
      if (terminalStatus && payment.status === 'pending') {
        await trx('payments').where({ id: payment.id, tenant_id: tenantId }).update({ status: terminalStatus, gateway_status: transactionStatus, gateway_transaction_id: transactionId, gateway_payment_type: typeof payload.payment_type === 'string' ? payload.payment_type : null, updated_at: trx.fn.now() });
      } else if (payment.status === 'paid') {
        await logScoped(trx, tenantId, payload, payment.id, true, 'stale_status_ignored');
        await audit(trx, tenantId, 'payment.webhook_stale', payment.id, invoice.id, payload, 'stale_status_ignored');
        return { outcome: 'stale_status_ignored' as const, httpStatus: 200 };
      } else {
        await trx('payments').where({ id: payment.id, tenant_id: tenantId }).update({ gateway_status: transactionStatus || 'unknown', gateway_transaction_id: transactionId, gateway_payment_type: typeof payload.payment_type === 'string' ? payload.payment_type : null, updated_at: trx.fn.now() });
      }
      const outcome = terminalStatus ? `payment_${terminalStatus}` : `payment_${transactionStatus || 'unknown'}`;
      await logScoped(trx, tenantId, payload, payment.id, true, outcome);
      await audit(trx, tenantId, 'payment.webhook_received', payment.id, invoice.id, payload, outcome);
      return { outcome: outcome as string, httpStatus: 200 };
    });

    if ('invoice' in result && result.ticket) {
      const customer = await withTenantContext(tenantId, (trx) => trx('customers').where({ id: result.ticket.customer_id, tenant_id: tenantId }).select('phone_wa').first());
      void notifyPaymentReceived({
        tenantId, customerId: result.ticket.customer_id, phone: customer?.phone_wa ?? '',
        ticketId: result.ticket.id, paymentId: result.payment.id,
        invoiceNumber: result.invoice.invoice_no, trackingCode: result.ticket.tracking_code,
        amount: Number(result.payment.amount), paymentStatus: 'Lunas',
      });
    }
    return res.status(result.httpStatus).json({ status: result.outcome });
  } catch {
    return res.status(500).json({ error: 'Webhook Midtrans gagal diproses' });
  }
});
