import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let state: { settings: any; logs: any[]; audits: any[]; dedupeKeys: Set<string>; failSentUpdates?: number };
const fakeTrx: any = (table: string) => {
  let inserted: any;
  let logId: string | undefined;
  let ignoreConflict = false;
  let filter: Record<string, unknown> = {};
  const builder: any = {
    insert(row: any) {
      if (table === 'notification_logs') {
        inserted = row;
        logId = `log-${state.logs.length + 1}`;
      }
      if (table === 'audit_logs') state.audits.push(row);
      return builder;
    },
    onConflict() { return builder; },
    ignore() {
      if (table === 'notification_logs') {
        ignoreConflict = true;
        return builder;
      }
      return Promise.resolve([]);
    },
    where(criteria: Record<string, unknown>) { filter = { ...filter, ...criteria }; return builder; },
    select() { return builder; },
    async first() { return state.settings; },
    async returning() {
      const dedupeKey = inserted?.dedupe_key;
      if (ignoreConflict && dedupeKey && state.dedupeKeys.has(dedupeKey)) return [];
      if (dedupeKey) state.dedupeKeys.add(dedupeKey);
      const log = { id: logId, attempt_count: 0, ...inserted };
      state.logs.push(log);
      return [log];
    },
    async update(patch: any) {
      if (patch.status === 'sent' && state.failSentUpdates) {
        state.failSentUpdates -= 1;
        throw new Error('DB sibuk sementara');
      }
      const log = state.logs.find((row) => row.id === (filter.id ?? logId)) ?? state.logs.at(-1);
      Object.assign(log, patch);
      return 1;
    },
  };
  return builder;
};
fakeTrx.fn = { now: () => new Date() };

vi.mock('../src/middleware/AuthMiddleware', () => ({
  withTenantContext: (_tenantId: string, callback: (trx: any) => Promise<unknown>) => callback(fakeTrx),
}));

import {
  createQueuedWhatsAppNotification,
  enqueueWhatsAppNotification,
  sendWhatsAppNotification,
  setNotificationProviderForTests,
} from '../src/services/notifications/notificationService';
import { notifyTicketStatusChanged } from '../src/services/notifications/events';

const input = {
  tenantId: 'tenant-1', customerId: 'customer-1', toPhone: '08123456789',
  templateName: 'quotation_created', variables: {
    trackingCode: 'TKT5560039009', ticketCode: 'SRV123', quotationNumber: 'QUO-123',
    complaint: 'Mati total', diagnosis: 'IC charging rusak',
    items: [{ item_type: 'labor', damage_description: 'Pemeriksaan', qty: 1, labor_cost: 354000, subtotal: 354000 }],
    totalAmount: 354000,
    expiresAt: '2026-11-22T03:02:00Z', approvalLink: 'https://app.example.invalid/approve/token',
  },
  quotationId: 'quotation-1', ticketId: 'ticket-1', approvalUrl: 'https://app.example.invalid/quotation/approve/token',
};
const openWaEnv = ['OPENWA_BASE_URL', 'OPENWA_API_KEY'] as const;
const originalEnv = Object.fromEntries([...openWaEnv, 'NODE_ENV'].map((key) => [key, process.env[key]]));

function configureProvider() {
  process.env.OPENWA_BASE_URL = 'https://openwa.example.invalid';
  process.env.OPENWA_API_KEY = 'test-key';
}

beforeEach(() => {
  state = { settings: { channels: { whatsapp: true } }, logs: [], audits: [], dedupeKeys: new Set() };
  setNotificationProviderForTests(null);
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  setNotificationProviderForTests(null);
  for (const key of [...openWaEnv, 'NODE_ENV']) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.useRealTimers();
});

describe('WhatsApp notification delivery', () => {
  it('skips a service notification when the status did not change', async () => {
    const result = await notifyTicketStatusChanged({
      tenantId: 'tenant-1', customerId: 'customer-1', phone: '08123456789', ticketId: 'ticket-1',
      trackingCode: 'TKT5560039009', previousStatus: 'pengerjaan', status: 'pengerjaan',
    });
    expect(result.status).toBe('skipped');
    expect(state.logs).toHaveLength(0);
  });

  it('records a successful send and attempt count', async () => {
    configureProvider();
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => ({ providerMessageId: 'provider-123' }),
      healthCheck: async () => true,
    });

    const result = await sendWhatsAppNotification(input);

    expect(result.status).toBe('sent');
    expect(state.logs[0]).toMatchObject({ status: 'sent', attempt_count: 1, provider_msg_id: 'provider-123', error_message: null });
  });

  it('tidak mengirim ulang pesan ketika update status sent gagal sementara', async () => {
    configureProvider();
    state.failSentUpdates = 1;
    let sends = 0;
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => {
        sends += 1;
        return { providerMessageId: 'single-send' };
      },
      healthCheck: async () => true,
    });

    const result = await sendWhatsAppNotification(input);

    expect(result.status).toBe('sent');
    expect(sends).toBe(1);
    expect(state.logs[0]).toMatchObject({ status: 'sent', provider_msg_id: 'single-send' });
  });

  it('does not repeat a provider send after an ambiguous transport error', async () => {
    configureProvider();
    let attempts = 0;
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => { attempts += 1; throw new Error('OpenWA tidak dapat dijangkau'); },
      healthCheck: async () => true,
    });

    const result = await sendWhatsAppNotification(input);

    expect(result).toMatchObject({ status: 'failed', error: 'OpenWA tidak dapat dijangkau' });
    expect(attempts).toBe(1);
    expect(state.logs[0]).toMatchObject({ status: 'failed', error_code: 'PROVIDER_SEND_FAILED', error_message: 'OpenWA tidak dapat dijangkau', attempt_count: 1 });
  });

  it('skips a tenant without a ready WhatsApp session and records the clear reason once', async () => {
    configureProvider();
    let attempts = 0;
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => {
        attempts += 1;
        throw new Error('WhatsApp tenant belum terhubung');
      },
      healthCheck: async () => true,
    });

    const result = await sendWhatsAppNotification(input);

    expect(result).toMatchObject({ status: 'failed', error: 'WhatsApp tenant belum terhubung' });
    expect(attempts).toBe(1);
    expect(state.logs[0]).toMatchObject({ status: 'failed', error_message: 'WhatsApp tenant belum terhubung' });
  });

  it('sends only once when OpenWA times out after possibly accepting the message', async () => {
    configureProvider();
    let attempts = 0;
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => {
        attempts += 1;
        throw new Error('timeout');
      },
      healthCheck: async () => true,
    });

    const result = await sendWhatsAppNotification(input);

    expect(result.status).toBe('failed');
    expect(attempts).toBe(1);
    expect(state.logs[0]).toMatchObject({ status: 'failed', attempt_count: 1 });
  });

  it('logs an unconfigured provider in development and keeps the approval URL admin-only', async () => {
    process.env.NODE_ENV = 'development';
    for (const key of openWaEnv) delete process.env[key];

    const result = await sendWhatsAppNotification(input);

    expect(result).toMatchObject({ status: 'failed', error: 'provider tidak dikonfigurasi', errorCode: 'PROVIDER_NOT_CONFIGURED' });
    expect(state.logs[0]).toMatchObject({ status: 'failed', error_code: 'PROVIDER_NOT_CONFIGURED', error_message: 'provider tidak dikonfigurasi', approval_url: input.approvalUrl, attempt_count: 0 });
  });

  it('does not persist an approval URL when the provider is unconfigured in production', async () => {
    process.env.NODE_ENV = 'production';
    for (const key of openWaEnv) delete process.env[key];

    const result = await sendWhatsAppNotification(input);

    expect(result).toMatchObject({ status: 'failed', error: 'provider tidak dikonfigurasi' });
    expect(state.logs[0]).toMatchObject({ status: 'failed', error_code: 'PROVIDER_NOT_CONFIGURED', approval_url: null });
  });

  it('mengembalikan dispatch segera saat provider lambat dan membatasi pengiriman paralel', async () => {
    configureProvider();
    let active = 0;
    let maxActive = 0;
    let completed = 0;
    let resolveComplete!: () => void;
    const allSent = new Promise<void>((resolve) => { resolveComplete = resolve; });
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        completed += 1;
        if (completed === 20) resolveComplete();
        return { providerMessageId: `provider-${completed}` };
      },
      healthCheck: async () => true,
    });

    const ids = await Promise.all(Array.from({ length: 20 }, () => createQueuedWhatsAppNotification(fakeTrx, input)));
    for (const id of ids) if (id) enqueueWhatsAppNotification(input, id);
    await allSent;
    for (let attempt = 0; attempt < 100 && !state.logs.every((row) => row.status === 'sent'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(state.logs).toHaveLength(20);
    expect(state.logs.every((row) => row.status === 'sent')).toBe(true);
  });

  it('deduplicates an identical event key but allows intentional manual resends without one', async () => {
    configureProvider();
    let sends = 0;
    setNotificationProviderForTests({
      sendTextMessage: async () => ({}),
      sendTemplateMessage: async () => { sends += 1; return {}; },
      healthCheck: async () => true,
    });

    const eventInput = { ...input, dedupeKey: 'ticket:ticket-1:status:pengecekan->pengerjaan' };
    expect((await sendWhatsAppNotification(eventInput)).status).toBe('sent');
    expect((await sendWhatsAppNotification(eventInput)).status).toBe('skipped');
    expect((await sendWhatsAppNotification(input)).status).toBe('sent');
    expect((await sendWhatsAppNotification(input)).status).toBe('sent');
    expect(sends).toBe(3);
    expect(state.logs).toHaveLength(3);
  });

  it('deduplicates queued check-in notifications in the transaction that creates them', async () => {
    const eventInput = { ...input, dedupeKey: 'ticket:ticket-1:created' };
    const first = await createQueuedWhatsAppNotification(fakeTrx, eventInput);
    const duplicate = await createQueuedWhatsAppNotification(fakeTrx, eventInput);
    expect(first).toBe('log-1');
    expect(duplicate).toBeNull();
    expect(state.logs).toHaveLength(1);
  });
});
