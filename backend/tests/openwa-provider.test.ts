import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  settings: new Map<string, any>(),
  tenants: new Map<string, any>(),
  audits: [] as any[],
}));

vi.mock('@middleware/AuthMiddleware', () => {
  const trx: any = (table: string) => {
    let criteria: Record<string, unknown> = {};
    let inserted: any;
    const query: any = {
      where(value: Record<string, unknown>) { criteria = value; return query; },
      select() { return query; },
      first() {
        const tenantId = String(criteria.tenant_id ?? criteria.id ?? '');
        return Promise.resolve(table === 'tenants' ? state.tenants.get(tenantId) : state.settings.get(tenantId));
      },
      insert(value: any) {
        inserted = value;
        if (table === 'audit_logs') state.audits.push(value);
        return query;
      },
      onConflict() { return query; },
      ignore() {
        if (table === 'tenant_notification_settings' && !state.settings.has(String(inserted.tenant_id))) {
          state.settings.set(String(inserted.tenant_id), inserted);
        }
        return Promise.resolve([]);
      },
      async update(values: any) {
        if (table === 'tenant_notification_settings') {
          const tenantId = String(criteria.tenant_id ?? '');
          state.settings.set(tenantId, { ...state.settings.get(tenantId), ...values });
        }
        return 1;
      },
    };
    return query;
  };
  trx.fn = { now: () => new Date() };
  trx.raw = async () => [];
  return { withTenantContext: async (_tenantId: string, callback: (trx: any) => Promise<unknown>) => callback(trx) };
});

import { OpenWaProvider, maskWhatsAppPhone, normalizeWhatsAppPhone } from '../src/services/notifications/OpenWaProvider';

const originalEnv = {
  baseUrl: process.env.OPENWA_BASE_URL,
  apiKey: process.env.OPENWA_API_KEY,
};
let fetchCalls: Array<{ url: string; init: RequestInit }>;
let sessionPhones: Record<string, string | null>;
let sessionStatuses: Record<string, string>;
let sendPayload: unknown;

function response(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

beforeEach(() => {
  state.settings.clear();
  state.tenants.clear();
  state.audits.length = 0;
  fetchCalls = [];
  sessionPhones = {};
  sessionStatuses = {};
  sendPayload = undefined;
  process.env.OPENWA_BASE_URL = 'https://openwa.example.invalid/api/';
  process.env.OPENWA_API_KEY = 'test-api-key';
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    fetchCalls.push({ url, init });
    if (url.endsWith('/messages/send-text')) return response(sendPayload ?? { messageId: `message-${fetchCalls.length}`, timestamp: 1 });
    if (url.endsWith('/api/sessions') && init.method === 'POST') {
      sessionStatuses['new-session'] = 'created';
      sessionPhones['new-session'] = null;
      return response({ id: 'new-session', status: 'created' }, 201);
    }
    if (url.endsWith('/start') && init.method === 'POST') {
      sessionStatuses['new-session'] = 'qr_ready';
      return response({ id: 'new-session', status: 'initializing' });
    }
    if (url.endsWith('/qr')) return response({ qrCode: 'data:image/png;base64,test-qr', status: 'qr_ready' });
    if (url.endsWith('/stop') && init.method === 'POST') {
      sessionStatuses['new-session'] = 'disconnected';
      sessionPhones['new-session'] = null;
      return response({ id: 'new-session', status: 'disconnected' });
    }
    if (url.endsWith('/logout') && init.method === 'POST') {
      const sessionId = url.match(/\/api\/sessions\/([^/]+)\/logout$/)?.[1] ?? '';
      sessionStatuses[sessionId] = 'disconnected';
      sessionPhones[sessionId] = null;
      return response({ id: sessionId, status: 'disconnected', phone: null });
    }
    const sessionId = url.match(/\/api\/sessions\/([^/]+)$/)?.[1];
    if (sessionId) return response({ id: sessionId, status: sessionStatuses[sessionId] ?? 'ready', phone: sessionPhones[sessionId] });
    return response({}, 404);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnv.baseUrl === undefined) delete process.env.OPENWA_BASE_URL;
  else process.env.OPENWA_BASE_URL = originalEnv.baseUrl;
  if (originalEnv.apiKey === undefined) delete process.env.OPENWA_API_KEY;
  else process.env.OPENWA_API_KEY = originalEnv.apiKey;
});

function addTenant(tenantId: string, sessionId: string, phone: string) {
  state.tenants.set(tenantId, { id: tenantId, name: tenantId, phone });
  state.settings.set(tenantId, {
    tenant_id: tenantId,
    openwa_session_id: sessionId,
    openwa_session_status: 'ready',
    openwa_connected_phone: phone,
    openwa_verified_at: new Date(),
  });
  sessionPhones[sessionId] = phone;
  sessionStatuses[sessionId] = 'ready';
}

describe('OpenWA tenant sessions', () => {
  it('sends each tenant through only its own session', async () => {
    addTenant('tenant-a', 'session-a', '628111111111');
    addTenant('tenant-b', 'session-b', '628222222222');
    const provider = new OpenWaProvider();

    await provider.sendTextMessage('tenant-a', '08123456789', 'test A');
    await provider.sendTextMessage('tenant-b', '08123456789', 'test B');

    const sendCalls = fetchCalls.filter(({ url }) => url.endsWith('/messages/send-text'));
    expect(sendCalls.map(({ url }) => url)).toEqual([
      'https://openwa.example.invalid/api/sessions/session-a/messages/send-text',
      'https://openwa.example.invalid/api/sessions/session-b/messages/send-text',
    ]);
    expect(JSON.parse(String(sendCalls[0].init.body)).chatId).toBe('628123456789@c.us');
    expect((sendCalls[0].init.headers as Record<string, string>)['x-api-key']).toBe('test-api-key');
  });

  it('reports Connected only after a matching ready phone and returns it masked', async () => {
    addTenant('tenant-a', 'session-a', '6281234567890');

    const status = await new OpenWaProvider().getTenantStatus('tenant-a');

    expect(status).toMatchObject({ connected: true, session_status: 'ready', connected_phone: '+62 812-****-7890', phone_matches: true });
    expect(status).not.toHaveProperty('session_id');
    expect(status).not.toHaveProperty('openwa_api_key');
  });

  it('treats an explicit OpenWA send failure as failed even when HTTP responds successfully', async () => {
    addTenant('tenant-a', 'session-a', '628111111111');
    sendPayload = { success: false, message: 'Pesan ditolak' };

    await expect(new OpenWaProvider().sendTextMessage('tenant-a', '08123456789', 'test'))
      .rejects.toThrow('Pesan ditolak');
    expect(fetchCalls.filter(({ url }) => url.endsWith('/messages/send-text'))).toHaveLength(1);
  });

  it('returns the provider message ID from a successful OpenWA response payload', async () => {
    addTenant('tenant-a', 'session-a', '628111111111');
    sendPayload = { success: true, status: 'success', data: { id: 'message-123' } };

    await expect(new OpenWaProvider().sendTextMessage('tenant-a', '08123456789', 'test'))
      .resolves.toEqual({ providerMessageId: 'message-123' });
  });

  it('creates, starts, reads a QR, and disconnects the tenant session through OpenWA', async () => {
    const tenantId = '81b5b568-7174-4f85-8bab-5a1f30bc0296';
    state.tenants.set(tenantId, { id: tenantId, name: 'Workshop', phone: '6281234567890' });
    const provider = new OpenWaProvider();

    const connected = await provider.connectTenant(tenantId);

    expect(connected).toMatchObject({ connected: false, session_status: 'qr_ready', qr_code: 'data:image/png;base64,test-qr' });
    expect(connected).not.toHaveProperty('session_id');
    expect(state.settings.get(tenantId)).toMatchObject({ openwa_session_id: 'new-session', openwa_session_status: 'qr_ready' });
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({ name: `servitrack-${tenantId}` });
    expect(fetchCalls.map(({ url, init }) => `${init.method ?? 'GET'} ${new URL(url).pathname}`)).toEqual([
      'POST /api/sessions',
      'POST /api/sessions/new-session/start',
      'GET /api/sessions/new-session',
      'GET /api/sessions/new-session/qr',
    ]);

    const disconnected = await provider.disconnectTenant(tenantId);
    expect(disconnected).toMatchObject({ connected: false, session_status: 'disconnected', connected_phone: null, qr_code: null });
    expect(state.settings.get(tenantId)).toMatchObject({ openwa_session_id: 'new-session', openwa_session_status: 'disconnected', openwa_connected_phone: null });
    expect(fetchCalls.some(({ url }) => url.endsWith('/new-session/stop'))).toBe(true);
  });

  it('unlinks a ready WhatsApp number on disconnect', async () => {
    addTenant('tenant-a', 'session-a', '6281234567890');

    const disconnected = await new OpenWaProvider().disconnectTenant('tenant-a');

    expect(fetchCalls.some(({ url }) => url.endsWith('/session-a/logout'))).toBe(true);
    expect(disconnected).toMatchObject({ connected: false, session_status: 'disconnected', connected_phone: null });
    expect(state.settings.get('tenant-a').openwa_connected_phone).toBeNull();
  });

  it('does not fall back to another tenant session when this tenant has none', async () => {
    addTenant('tenant-b', 'session-b', '628222222222');
    state.tenants.set('tenant-a', { id: 'tenant-a', phone: '628111111111' });
    state.settings.set('tenant-a', { tenant_id: 'tenant-a', openwa_session_id: null, openwa_session_status: null });

    await expect(new OpenWaProvider().sendTextMessage('tenant-a', '08123456789', 'no fallback'))
      .rejects.toThrow('WhatsApp tenant belum terhubung');
    expect(fetchCalls).toHaveLength(0);
  });

  it('rejects a mismatched or unavailable connected number before sending', async () => {
    addTenant('tenant-a', 'session-a', '628111111111');
    sessionPhones['session-a'] = '628999999999';
    const provider = new OpenWaProvider();

    await expect(provider.sendTextMessage('tenant-a', '08123456789', 'blocked'))
      .rejects.toThrow('Nomor WhatsApp tenant tidak cocok dengan tenants.phone');
    expect(state.settings.get('tenant-a').openwa_session_status).toBe('number_mismatch');
    expect(fetchCalls.some(({ url }) => url.endsWith('/messages/send-text'))).toBe(false);
    expect(state.audits.at(-1)).toMatchObject({ action: 'whatsapp.number_verification', new_values: { result: 'mismatch', session_status: 'number_mismatch' } });

    sessionPhones['session-a'] = null;
    await expect(provider.sendTextMessage('tenant-a', '08123456789', 'blocked'))
      .rejects.toThrow('Nomor tidak tersedia dari OpenWA');
    expect(state.settings.get('tenant-a').openwa_session_status).toBe('number_unavailable');
  });

  it('normalizes Indonesian prefixes and masks the linked number', () => {
    expect(normalizeWhatsAppPhone('+62 812-3456-7890')).toBe('6281234567890');
    expect(normalizeWhatsAppPhone('0812 3456 7890')).toBe('6281234567890');
    expect(maskWhatsAppPhone('6281234567890')).toBe('+62 812-****-7890');
  });
});
