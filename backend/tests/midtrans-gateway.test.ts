import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MidtransGateway,
  midtransSettings,
  validateMidtransEnvironment,
  newMidtransOrderId,
  tenantIdFromMidtransOrderId,
  isMidtransSuccessNotification,
  verifyMidtransSignature,
} from '../src/services/payments/MidtransGateway';

const tenantId = '123e4567-e89b-12d3-a456-426614174000';
const sandboxEnv = {
  NODE_ENV: 'test',
  MIDTRANS_IS_PRODUCTION: 'false',
  MIDTRANS_SERVER_KEY: 'SB-Mid-server-test-only',
  MIDTRANS_CLIENT_KEY: 'Mid-client-test-only',
  MIDTRANS_SIGNATURE_KEY: 'Mid-server-signature-test-only',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function expectSafeConfigError(env: NodeJS.ProcessEnv, reason: string) {
  let message = '';
  try {
    midtransSettings(env);
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain(reason);
  for (const name of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_SIGNATURE_KEY'] as const) {
    if (env[name]) expect(message).not.toContain(env[name]);
  }
}

describe('Midtrans sandbox gateway', () => {
  it('creates a unique sandbox order ID that resolves only its tenant', () => {
    const first = newMidtransOrderId(tenantId);
    const second = newMidtransOrderId(tenantId);
    expect(first).toHaveLength(50);
    expect(first).not.toBe(second);
    expect(tenantIdFromMidtransOrderId(first)).toBe(tenantId);
    expect(tenantIdFromMidtransOrderId('not-an-order')).toBeNull();
  });

  it('verifies Midtrans signature_key using the signature secret and original amount string', () => {
    const signatureKey = 'signature-secret-test-only';
    const payload = { order_id: 'order-123', status_code: '200', gross_amount: '354000.00' };
    const signature = createHash('sha512').update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${signatureKey}`).digest('hex');
    expect(verifyMidtransSignature({ ...payload, signature_key: signature }, signatureKey)).toBe(true);
    expect(verifyMidtransSignature({ ...payload, gross_amount: '354000', signature_key: signature }, signatureKey)).toBe(false);
    expect(verifyMidtransSignature({ ...payload, signature_key: '00' }, signatureKey)).toBe(false);
  });

  it('only considers accepted settlement/capture notifications successful', () => {
    expect(isMidtransSuccessNotification({ status_code: '200', transaction_status: 'settlement', fraud_status: 'accept' })).toBe(true);
    expect(isMidtransSuccessNotification({ status_code: '200', transaction_status: 'settlement' })).toBe(true);
    expect(isMidtransSuccessNotification({ status_code: '200', transaction_status: 'capture', fraud_status: 'deny' })).toBe(false);
    for (const transaction_status of ['pending', 'expire', 'deny', 'cancel']) {
      expect(isMidtransSuccessNotification({ status_code: '200', transaction_status })).toBe(false);
    }
  });

  it('accepts sandbox keys whose client and signature prefixes do not identify the environment', () => {
    expect(midtransSettings(sandboxEnv)?.isProduction).toBe(false);
  });

  it('rejects a sandbox Server Key when production mode is enabled', () => {
    expectSafeConfigError({ ...sandboxEnv, NODE_ENV: 'production', MIDTRANS_IS_PRODUCTION: 'true' }, 'MIDTRANS_IS_PRODUCTION: harus false');
  });

  it('rejects a production Server Key when production mode is disabled', () => {
    expectSafeConfigError({
      ...sandboxEnv, NODE_ENV: 'production', MIDTRANS_IS_PRODUCTION: 'false', MIDTRANS_SERVER_KEY: 'Mid-server-production-test',
    }, 'MIDTRANS_IS_PRODUCTION: harus true');
  });

  it('rejects a production Server Key outside NODE_ENV=production', () => {
    expectSafeConfigError({
      ...sandboxEnv, MIDTRANS_IS_PRODUCTION: 'true', MIDTRANS_SERVER_KEY: 'Mid-server-production-test',
    }, 'NODE_ENV: harus production');
  });

  it('rejects empty, placeholder, whitespace, and quoted keys without echoing key values', () => {
    for (const name of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'MIDTRANS_SIGNATURE_KEY'] as const) {
      for (const value of ['', '<secret-placeholder>', 'key with-space', '"quoted-key"']) {
        const env = { ...sandboxEnv, [name]: value };
        expectSafeConfigError(env, name);
      }
    }
    expect(() => validateMidtransEnvironment({ NODE_ENV: 'test' })).toThrow('MIDTRANS_SERVER_KEY');
  });

  it('identifies a production-looking Server Key used in sandbox as a likely Signature Key mix-up', () => {
    expectSafeConfigError({
      ...sandboxEnv, MIDTRANS_SERVER_KEY: 'Mid-server-wrong-column',
    }, 'kemungkinan Signature Secret Key tertukar ke kolom Server Key');
  });

  it('warns without rejecting when Server Key and Signature Key are identical', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateMidtransEnvironment({ ...sandboxEnv, MIDTRANS_SIGNATURE_KEY: sandboxEnv.MIDTRANS_SERVER_KEY });
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('MIDTRANS_SERVER_KEY dan MIDTRANS_SIGNATURE_KEY identik'));
    expect(warning.mock.calls.flat().join(' ')).not.toContain(sandboxEnv.MIDTRANS_SERVER_KEY);
  });

  it('sends the integer invoice amount to the official sandbox Snap endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'snap-token', redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new MidtransGateway({
      serverKey: sandboxEnv.MIDTRANS_SERVER_KEY,
      clientKey: sandboxEnv.MIDTRANS_CLIENT_KEY,
      signatureKey: sandboxEnv.MIDTRANS_SIGNATURE_KEY,
      isProduction: false,
    });
    const result = await gateway.createTransaction({
      orderId: newMidtransOrderId(tenantId), amount: 354000,
      items: [{ id: 'service-1', name: 'Jasa servis', price: 354000, quantity: 1 }],
      customer: { name: 'Pelanggan', phone: '628123456789' },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));
    expect(url).toBe('https://app.sandbox.midtrans.com/snap/v1/transactions');
    expect(requestBody.transaction_details).toMatchObject({ gross_amount: 354000 });
    expect(requestBody.expiry).toMatchObject({ unit: 'minutes', duration: 30 });
    expect(result.redirectUrl).toContain('/snap/v2/vtweb/');
  });
});
