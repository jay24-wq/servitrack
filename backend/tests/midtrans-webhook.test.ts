import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import db from '../src/models/index';
import app from '../src/server';
import { newMidtransOrderId } from '../src/services/payments/MidtransGateway';

const signatureSecret = 'sandbox-signature-test-only';
const originalEnv: Record<string, string | undefined> = {};
let tenantId = '';
let branchId = '';
let customerId = '';
let deviceId = '';
let userId = '';

function signedNotice(orderId: string, overrides: Record<string, unknown> = {}) {
  const payload: Record<string, any> = {
    order_id: orderId,
    status_code: '200',
    gross_amount: '100000.00',
    transaction_status: 'settlement',
    transaction_id: `trx-${uuidv4()}`,
    fraud_status: 'accept',
    currency: 'IDR',
    payment_type: 'bank_transfer',
    ...overrides,
  };
  payload.signature_key = createHash('sha512')
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${signatureSecret}`)
    .digest('hex');
  return payload;
}

async function createInvoiceWithOnlineAttempt(total = 100_000) {
  return db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
    const [ticket] = await trx('service_tickets').insert({
      tenant_id: tenantId, branch_id: branchId, customer_id: customerId, device_id: deviceId, received_by: userId,
      ticket_code: `SRV${uuidv4().replace(/-/g, '').slice(0, 12)}`,
      tracking_token: uuidv4().replace(/-/g, '').slice(0, 32), service_method: 'dropoff', complaint: 'Webhook test', current_status: 'selesai',
    }).returning('id');
    const [invoice] = await trx('invoices').insert({
      tenant_id: tenantId, ticket_id: ticket.id, invoice_no: `INV${uuidv4().replace(/-/g, '').slice(0, 10)}`,
      subtotal: total, service_fee: total, line_items: JSON.stringify([{ type: 'service', name: 'Jasa', quantity: 1, unit_price: total, total }]), total, status: 'unpaid',
    }).returning('*');
    const orderId = newMidtransOrderId(tenantId);
    const [payment] = await trx('payments').insert({
      tenant_id: tenantId, invoice_id: invoice.id, received_by: userId, method: 'midtrans', amount: total,
      status: 'pending', gateway: 'midtrans', order_id: orderId, gateway_status: 'pending',
      idempotency_key: `webhook-${uuidv4()}`, is_full_settlement: true, expires_at: new Date(Date.now() + 30 * 60_000),
    }).returning('*');
    return { ticketId: ticket.id, invoiceId: invoice.id, paymentId: payment.id, orderId };
  });
}

async function tenantRows(table: string, where: Record<string, unknown> = {}) {
  return db.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
    return trx(table).where({ tenant_id: tenantId, ...where });
  });
}

describe('Midtrans webhook', () => {
  beforeAll(async () => {
    for (const name of ['NODE_ENV', 'MIDTRANS_IS_PRODUCTION', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_SIGNATURE_KEY']) originalEnv[name] = process.env[name];
    process.env.NODE_ENV = 'test';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test-only';
    process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test-only';
    process.env.MIDTRANS_SIGNATURE_KEY = signatureSecret;

    tenantId = uuidv4();
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('tenants').insert({ id: tenantId, name: 'Webhook Tenant', slug: `wh-${tenantId.slice(0, 8)}`, owner_name: 'Owner', phone: '628123456789' });
      const [branch] = await trx('branches').insert({ tenant_id: tenantId, name: 'Cabang', is_main: true }).returning('id');
      branchId = branch.id;
      const role = await trx('roles').where({ code: 'admin' }).first();
      const [user] = await trx('users').insert({ tenant_id: tenantId, branch_id: branchId, role_id: role.id, name: 'Admin', email: `wh-${tenantId.slice(0, 8)}@test.invalid`, password_hash: 'test' }).returning('id');
      userId = user.id;
      const [customer] = await trx('customers').insert({ tenant_id: tenantId, name: 'Customer', phone_wa: '628123456789' }).returning('id');
      customerId = customer.id;
      const [device] = await trx('devices').insert({ tenant_id: tenantId, customer_id: customerId, category: 'hp', model: 'Test Device' }).returning('id');
      deviceId = device.id;
    });
  });

  afterAll(async () => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('rejects bad signatures and mismatches, settles once, and records a second success as an anomaly', async () => {
    const attempt = await createInvoiceWithOnlineAttempt();
    const badSignature = signedNotice(attempt.orderId);
    badSignature.signature_key = 'not-a-valid-signature';
    const rejected = await request(app).post('/api/webhooks/midtrans').send(badSignature);
    expect(rejected.status).toBe(403);

    const mismatch = await request(app).post('/api/webhooks/midtrans').send(signedNotice(attempt.orderId, { gross_amount: '99999.00' }));
    expect(mismatch.status).toBe(400);
    expect((await tenantRows('invoices', { id: attempt.invoiceId }))[0].status).toBe('unpaid');

    const success = signedNotice(attempt.orderId, { transaction_id: 'trx-success-1' });
    const settled = await request(app).post('/api/webhooks/midtrans').send(success);
    expect(settled.status).toBe(200);
    expect(settled.body.status).toBe('payment_settled');
    const duplicate = await request(app).post('/api/webhooks/midtrans').send(success);
    expect(duplicate.body.status).toBe('duplicate_success_ignored');

    const secondOrder = newMidtransOrderId(tenantId);
    await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
      await trx('payments').insert({ tenant_id: tenantId, invoice_id: attempt.invoiceId, received_by: userId, method: 'midtrans', amount: 100_000, status: 'pending', gateway: 'midtrans', order_id: secondOrder, idempotency_key: `second-${uuidv4()}`, is_full_settlement: true, expires_at: new Date(Date.now() + 30 * 60_000) });
    });
    const secondSuccess = await request(app).post('/api/webhooks/midtrans').send(signedNotice(secondOrder, { transaction_id: 'trx-success-2' }));
    expect(secondSuccess.body.status).toBe('success_after_invoice_paid_anomaly');
    expect((await tenantRows('invoices', { id: attempt.invoiceId }))[0].status).toBe('paid');
    expect((await tenantRows('payments', { id: attempt.paymentId }))[0].status).toBe('paid');
    expect((await tenantRows('payments', { order_id: secondOrder }))[0].status).toBe('anomaly');
    const rejectedLog = await db.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.tenant_id', '', true)");
      return trx('payment_gateway_webhook_logs').whereNull('tenant_id').where({ gateway: 'midtrans', result: 'signature_invalid' }).first();
    });
    expect(rejectedLog).toMatchObject({ signature_valid: false, result: 'signature_invalid' });
  });

  it.each([
    ['pending', 'pending'], ['expire', 'expired'], ['deny', 'failed'], ['cancel', 'cancelled'],
  ])('does not settle a %s notification', async (transactionStatus, expectedPaymentStatus) => {
    const attempt = await createInvoiceWithOnlineAttempt();
    const response = await request(app).post('/api/webhooks/midtrans').send(signedNotice(attempt.orderId, { transaction_status: transactionStatus }));
    expect(response.status).toBe(200);
    expect((await tenantRows('invoices', { id: attempt.invoiceId }))[0].status).toBe('unpaid');
    expect((await tenantRows('payments', { id: attempt.paymentId }))[0].status).toBe(expectedPaymentStatus);
  });
});
