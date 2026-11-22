import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logs: [] as any[],
  audits: [] as any[],
  sendCalls: [] as any[],
  status: { connected: true, session_status: 'ready', connected_phone: '+62 812-****-7890', tenant_phone: '6281234567890', phone_matches: true, last_verified_at: null, qr_code: null, openwa_reachable: true, verification_changed: false },
  sendError: '',
}));

vi.mock('@middleware/AuthMiddleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@middleware/AuthMiddleware')>();
  const makeTrx: any = (table: string) => {
    let criteria: Record<string, unknown> = {};
    let inserted: any;
    let counting = false;
    const builder: any = {
      where(value: Record<string, unknown>) { criteria = { ...criteria, ...value }; return builder; },
      whereRaw() { return builder; },
      select() { return builder; },
      count() { counting = true; return builder; },
      first() {
        if (table === 'notification_logs' && counting) {
          return Promise.resolve({ count: state.logs.filter((log) => log.tenant_id === criteria.tenant_id && log.notification_type === 'connection_test').length });
        }
        if (table === 'users') return Promise.resolve({ phone: null });
        if (table === 'tenants') return Promise.resolve({ name: 'Bengkel Asli' });
        return Promise.resolve(null);
      },
      insert(value: any) { inserted = value; return builder; },
      returning() {
        const id = `log-${state.logs.length + 1}`;
        state.logs.push({ id, ...inserted });
        return Promise.resolve([{ id }]);
      },
      async update(values: any) {
        const log = state.logs.find((row) => row.id === criteria.id && row.tenant_id === criteria.tenant_id);
        if (log) Object.assign(log, values);
        return log ? 1 : 0;
      },
    };
    return builder;
  };
  const trx: any = (table: string) => makeTrx(table);
  trx.raw = async () => [];
  trx.fn = { now: () => new Date() };
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: () => void) => {
      req.user = { user_id: 'admin-actor', tenant_id: 'tenant-from-token', role: req.header('x-test-role') ?? 'admin' };
      next();
    },
    withTenantContext: async (_tenantId: string, callback: (trx: any) => Promise<unknown>) => callback(trx),
  };
});

vi.mock('@middleware/TenantResolver', () => ({
  tenantResolver: (_req: any, _res: any, next: () => void) => next(),
  reqDb: () => {
    const trx: any = (table: string) => {
      let criteria: Record<string, unknown> = {};
      let inserted: any;
      let counting = false;
      const builder: any = {
        where(value: Record<string, unknown>) { criteria = { ...criteria, ...value }; return builder; },
        whereRaw() { return builder; },
        select() { return builder; },
        orderBy() { return builder; },
        limit() { return builder; },
        count() { counting = true; return builder; },
        first() {
          if (table === 'notification_logs' && counting) {
            return Promise.resolve({ count: state.logs.filter((log) => log.tenant_id === criteria.tenant_id && log.notification_type === 'connection_test').length });
          }
          if (table === 'tenants') return Promise.resolve({ name: 'Bengkel Asli' });
          return Promise.resolve(null);
        },
        insert(value: any) { inserted = value; return builder; },
        returning() {
          const id = `log-${state.logs.length + 1}`;
          state.logs.push({ id, ...inserted });
          return Promise.resolve([{ id }]);
        },
        async update(values: any) {
          const log = state.logs.find((row) => row.id === criteria.id && row.tenant_id === criteria.tenant_id);
          if (log) Object.assign(log, values);
          return log ? 1 : 0;
        },
        then(resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) {
          const rows = table === 'notification_logs'
            ? state.logs.filter((row) => Object.entries(criteria).every(([key, value]) => row[key] === value))
            : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    };
    trx.fn = { now: () => new Date() };
    return trx;
  },
}));

vi.mock('@services/auditLog', () => ({
  logAudit: async (_db: unknown, req: any, event: any) => state.audits.push({ actor: req.user.user_id, tenant: req.user.tenant_id, ...event }),
}));

vi.mock('@services/notifications/OpenWaProvider', () => ({
  OpenWaProvider: class {
    async getTenantStatus() { return state.status; }
    async connectTenant() { return state.status; }
    async disconnectTenant() { return { ...state.status, connected: false, session_status: 'disconnected' }; }
    async sendTextMessage(tenantId: string, phone: string, text: string) {
      state.sendCalls.push({ tenantId, phone, text });
      if (state.sendError) throw new Error(state.sendError);
      return { providerMessageId: 'provider-test-123' };
    }
  },
  normalizeWhatsAppPhone: (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('62') ? digits : digits.startsWith('0') ? `62${digits.slice(1)}` : `62${digits}`;
  },
  openWaErrorMessage: () => 'OpenWA tidak dapat dijangkau',
}));

import { whatsappRouter } from '../src/api/whatsapp';
import { notificationRouter } from '../src/api/notifications';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/whatsapp', whatsappRouter);
  return app;
}

beforeEach(() => {
  state.logs.length = 0;
  state.audits.length = 0;
  state.sendCalls.length = 0;
  state.sendError = '';
  state.status = { connected: true, session_status: 'ready', connected_phone: '+62 812-****-7890', tenant_phone: '6281234567890', phone_matches: true, last_verified_at: null, qr_code: null, openwa_reachable: true, verification_changed: false };
});

describe('WhatsApp connection test endpoint', () => {
  it('audits connect and disconnect actions under the tenant user from the token', async () => {
    const app = makeApp();
    const connected = await request(app).post('/api/whatsapp/connect').send({ tenant_id: 'ignored' });
    const disconnected = await request(app).post('/api/whatsapp/disconnect').send({ tenant_id: 'ignored' });

    expect(connected.status).toBe(200);
    expect(connected.body.data).not.toHaveProperty('session_id');
    expect(disconnected.status).toBe(200);
    expect(state.audits.map((event) => event.action)).toEqual(['whatsapp.connect', 'whatsapp.disconnect']);
    expect(state.audits.every((event) => event.actor === 'admin-actor' && event.tenant === 'tenant-from-token')).toBe(true);
  });

  it('rejects disconnected sessions and records the failed test without sending', async () => {
    state.status = { ...state.status, connected: false, session_status: 'disconnected' };

    const response = await request(makeApp()).post('/api/whatsapp/test').send({ to_phone: '081234567890' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('WhatsApp tenant belum terhubung');
    expect(state.sendCalls).toHaveLength(0);
    expect(state.logs[0]).toMatchObject({ tenant_id: 'tenant-from-token', customer_id: null, notification_type: 'connection_test', status: 'failed', error_message: 'WhatsApp tenant belum terhubung' });
    expect(state.audits[0]).toMatchObject({ actor: 'admin-actor', tenant: 'tenant-from-token', newValues: { result: 'failed', reason: 'WhatsApp tenant belum terhubung' } });
  });

  it('sends the test to the supplied number, logs a separate type, and returns the provider ID', async () => {
    const response = await request(makeApp()).post('/api/whatsapp/test')
      .send({ tenant_id: 'attacker-selected-tenant', to_phone: '0812 3456 7890' });

    expect(response.status).toBe(200);
    expect(response.body.data.provider_message_id).toBe('provider-test-123');
    expect(state.sendCalls[0]).toMatchObject({
      tenantId: 'tenant-from-token', phone: '6281234567890',
      text: expect.stringContaining('*Tes Koneksi WhatsApp ServiTrack* ✅'),
    });
    expect(state.logs[0]).toMatchObject({ tenant_id: 'tenant-from-token', customer_id: null, notification_type: 'connection_test', to_phone: '6281234567890', status: 'sent', provider_msg_id: 'provider-test-123' });
    expect(state.audits[0]).toMatchObject({ actor: 'admin-actor', tenant: 'tenant-from-token', newValues: { result: 'sent', provider_message_id: 'provider-test-123' } });
  });

  it('fails and audits provider errors, and rate-limits after five attempts per tenant', async () => {
    state.sendError = 'provider unavailable';
    const failed = await request(makeApp()).post('/api/whatsapp/test').send({ to_phone: '081234567890' });
    expect(failed.status).toBe(502);
    expect(state.logs[0]).toMatchObject({ status: 'failed', error_message: 'OpenWA tidak dapat dijangkau' });

    state.sendError = '';
    state.logs.length = 0;
    state.audits.length = 0;
    state.sendCalls.length = 0;
    const app = makeApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request(app).post('/api/whatsapp/test').send({ to_phone: '081234567890' })).status).toBe(200);
    }
    const limited = await request(app).post('/api/whatsapp/test').send({ to_phone: '081234567890' });

    expect(limited.status).toBe(429);
    expect(state.logs).toHaveLength(5);
    expect(state.sendCalls).toHaveLength(5);
    expect(state.audits.at(-1)).toMatchObject({ actor: 'admin-actor', newValues: { result: 'rate_limited' } });
  });

  it('keeps connection tests out of the customer notification feed', async () => {
    state.logs.push(
      { id: 'customer-log', tenant_id: 'tenant-from-token', notification_type: 'customer', status: 'sent' },
      { id: 'test-log', tenant_id: 'tenant-from-token', notification_type: 'connection_test', status: 'sent' },
    );
    const app = express();
    app.use('/api/notifications', notificationRouter);

    const response = await request(app).get('/api/notifications/');

    expect(response.status).toBe(200);
    expect(response.body.data.map((row: any) => row.id)).toEqual(['customer-log']);
  });
});
