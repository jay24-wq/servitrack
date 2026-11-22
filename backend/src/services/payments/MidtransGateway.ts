import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface SnapTransactionRequest {
  orderId: string;
  amount: number;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  customer: { name: string; phone?: string | null };
}

export interface SnapTransaction {
  token: string;
  redirectUrl: string;
  expiresAt: Date;
}

export interface PaymentGateway {
  createTransaction(input: SnapTransactionRequest): Promise<SnapTransaction>;
  refund(input: { orderId: string; transactionId?: string | null; refundKey: string; amount: number; reason: string }): Promise<void>;
}

export interface MidtransSettings {
  serverKey: string;
  clientKey: string;
  signatureKey: string;
  isProduction: boolean;
}

export function midtransSettings(env: NodeJS.ProcessEnv = process.env): MidtransSettings | null {
  const serverKey = env.MIDTRANS_SERVER_KEY ?? '';
  const clientKey = env.MIDTRANS_CLIENT_KEY ?? '';
  const signatureKey = env.MIDTRANS_SIGNATURE_KEY ?? '';
  const productionSetting = env.MIDTRANS_IS_PRODUCTION?.trim().toLowerCase();
  const errors: string[] = [];
  const keys = [
    ['MIDTRANS_SERVER_KEY', serverKey],
    ['MIDTRANS_CLIENT_KEY', clientKey],
    ['MIDTRANS_SIGNATURE_KEY', signatureKey],
  ] as const;

  for (const [name, value] of keys) {
    if (!value) errors.push(`${name}: wajib diisi`);
    else {
      if (/<[^>]*>/.test(value)) errors.push(`${name}: tidak boleh berisi placeholder`);
      if (/[\s'"]/.test(value)) errors.push(`${name}: tidak boleh mengandung spasi atau tanda kutip`);
    }
  }
  if (productionSetting && !['true', 'false'].includes(productionSetting)) {
    errors.push('MIDTRANS_IS_PRODUCTION: harus bernilai true atau false');
  }
  const isProduction = productionSetting === 'true';
  if (isProduction && env.NODE_ENV !== 'production') {
    errors.push('MIDTRANS_IS_PRODUCTION: nilai true hanya boleh digunakan saat NODE_ENV=production');
  }
  const configured = [serverKey, clientKey, signatureKey].some(Boolean);
  if (!configured) return null;

  const sandboxServer = serverKey.startsWith('SB-Mid-server-');
  const productionServer = !sandboxServer && serverKey.startsWith('Mid-server-');

  if (!sandboxServer && !productionServer) {
    errors.push('MIDTRANS_SERVER_KEY: format tidak dikenal; harus berawalan SB-Mid-server- atau Mid-server-');
  }
  if (sandboxServer && isProduction) {
    errors.push('MIDTRANS_IS_PRODUCTION: harus false untuk MIDTRANS_SERVER_KEY sandbox');
  }
  if (productionServer && !isProduction) {
    errors.push('MIDTRANS_IS_PRODUCTION: harus true untuk MIDTRANS_SERVER_KEY produksi');
    errors.push('MIDTRANS_SERVER_KEY: awalan Mid-server- tanpa SB-; kemungkinan Signature Secret Key tertukar ke kolom Server Key');
  }
  if (productionServer && env.NODE_ENV !== 'production') {
    errors.push('NODE_ENV: harus production saat MIDTRANS_SERVER_KEY menggunakan key produksi');
  }
  if (errors.length) throw new Error(errors.join('; '));
  return { serverKey, clientKey, signatureKey, isProduction };
}

export function validateMidtransEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const settings = midtransSettings(env);
  if (!settings) {
    throw new Error('MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, dan MIDTRANS_SIGNATURE_KEY: wajib diisi untuk menjalankan backend');
  }
  if (settings.serverKey === settings.signatureKey) {
    console.warn('Peringatan konfigurasi Midtrans: MIDTRANS_SERVER_KEY dan MIDTRANS_SIGNATURE_KEY identik; kemungkinan akun lama');
  }
}

export function newMidtransOrderId(tenantId: string) {
  const compactTenantId = tenantId.replace(/-/g, '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(compactTenantId)) throw new Error('Tenant ID tidak valid');
  return `${compactTenantId}${randomBytes(9).toString('hex')}`;
}

export function tenantIdFromMidtransOrderId(orderId: unknown) {
  if (typeof orderId !== 'string' || !/^[a-f0-9]{50}$/i.test(orderId)) return null;
  const id = orderId.slice(0, 32).toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

export function verifyMidtransSignature(
  payload: Record<string, unknown>,
  signatureKey: string
) {
  if (!signatureKey || typeof payload.order_id !== 'string' || typeof payload.status_code !== 'string' ||
      typeof payload.gross_amount !== 'string' || typeof payload.signature_key !== 'string') return false;
  const expected = createHash('sha512')
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${signatureKey}`)
    .digest();
  const received = Buffer.from(payload.signature_key, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function isMidtransSuccessNotification(payload: Record<string, unknown>) {
  const status = String(payload.transaction_status ?? '').toLowerCase();
  return payload.status_code === '200' && ['settlement', 'capture'].includes(status) &&
    (!payload.fraud_status || String(payload.fraud_status).toLowerCase() === 'accept');
}

function authHeader(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}

function expiryStartTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second} +0700`;
}

export class MidtransGateway implements PaymentGateway {
  private readonly settings: MidtransSettings;

  constructor(settings = midtransSettings()) {
    if (!settings) throw new Error('Kredensial Midtrans belum dikonfigurasi');
    this.settings = settings;
  }

  private get apiBase() {
    return this.settings.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  }

  async createTransaction(input: SnapTransactionRequest): Promise<SnapTransaction> {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 30 * 60_000);
    const baseUrl = this.settings.isProduction
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: authHeader(this.settings.serverKey),
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.amount },
        item_details: input.items,
        customer_details: {
          first_name: input.customer.name || 'Pelanggan',
          ...(input.customer.phone ? { phone: input.customer.phone } : {}),
        },
        credit_card: { secure: true },
        expiry: { start_time: expiryStartTime(startedAt), unit: 'minutes', duration: 30 },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json().catch(() => ({})) as { token?: string; redirect_url?: string };
    if (!response.ok || !body.token || !body.redirect_url) {
      throw Object.assign(new Error(`Midtrans gagal membuat tautan pembayaran (HTTP ${response.status})`), {
        status: 502,
        definitive: response.status >= 400 && response.status < 500,
      });
    }
    return { token: body.token, redirectUrl: body.redirect_url, expiresAt };
  }

  async refund(input: { orderId: string; transactionId?: string | null; refundKey: string; amount: number; reason: string }) {
    const identifier = input.transactionId || input.orderId;
    const response = await fetch(`${this.apiBase}/v2/${encodeURIComponent(identifier)}/refund`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: authHeader(this.settings.serverKey),
      },
      body: JSON.stringify({ refund_key: input.refundKey, amount: input.amount, reason: input.reason }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Object.assign(new Error(`Midtrans gagal menerima permintaan refund (HTTP ${response.status})`), { status: 502 });
  }
}

export function getPaymentGateway(): PaymentGateway {
  return new MidtransGateway();
}
