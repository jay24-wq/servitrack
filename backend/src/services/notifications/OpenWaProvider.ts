import { withTenantContext } from '@middleware/AuthMiddleware';
import type { NotificationProvider, NotificationProviderResult } from './types';
import { renderWhatsAppTemplate } from './templates';

type OpenWaSession = {
  id?: string;
  status?: string;
  phone?: string | null;
  lastError?: string | null;
};

export interface OpenWaTenantStatus {
  connected: boolean;
  session_status: string | null;
  connected_phone: string | null;
  tenant_phone: string;
  phone_matches: boolean | null;
  last_verified_at: string | null;
  qr_code: string | null;
  openwa_reachable: boolean;
  verification_changed: boolean;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '').replace(/\/api$/i, '');
}

export function normalizeWhatsAppPhone(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

export function maskWhatsAppPhone(value: string | null | undefined) {
  const digits = normalizeWhatsAppPhone(value);
  if (!digits) return null;
  return `+62 ${digits.slice(2, 5)}-****-${digits.slice(-4)}`;
}

function providerMessageId(payload: any) {
  return payload?.messageId ?? payload?.id ?? payload?.data?.messageId ?? payload?.data?.id ?? null;
}

function openWaErrorMessage(error: unknown) {
  if (error instanceof OpenWaRequestError && error.status === 404) return 'Sesi WhatsApp tidak ditemukan di OpenWA';
  return 'OpenWA tidak dapat dijangkau';
}

class OpenWaRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class OpenWaProvider implements NotificationProvider {
  private readonly baseUrl = normalizeBaseUrl(required('OPENWA_BASE_URL'));
  private readonly apiKey = required('OPENWA_API_KEY');

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.text();
    let payload: any = null;
    try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : payload?.message ?? `OpenWA ${response.status}`;
      throw new OpenWaRequestError(String(message), response.status);
    }
    return payload;
  }

  private async tenantData(tenantId: string) {
    return withTenantContext(tenantId, async (trx) => {
      const [settings, tenant] = await Promise.all([
        trx('tenant_notification_settings').where({ tenant_id: tenantId }).first(),
        trx('tenants').where({ id: tenantId }).select('phone', 'name').first(),
      ]);
      return { settings, tenant };
    });
  }

  private async updateSession(tenantId: string, values: Record<string, unknown>) {
    await withTenantContext(tenantId, (trx) => trx('tenant_notification_settings')
      .where({ tenant_id: tenantId })
      .update({ ...values, updated_at: trx.fn.now() }));
  }

  async getTenantStatus(tenantId: string, retrieveQr = true): Promise<OpenWaTenantStatus> {
    const { settings, tenant } = await this.tenantData(tenantId);
    const tenantPhone = String(tenant?.phone ?? '');
    const sessionId = settings?.openwa_session_id as string | null | undefined;
    const lastVerifiedAt = settings?.openwa_verified_at ? new Date(settings.openwa_verified_at).toISOString() : null;

    if (!sessionId) {
      return {
        connected: false,
        session_status: settings?.openwa_session_status ?? null,
        connected_phone: null,
        tenant_phone: tenantPhone,
        phone_matches: null,
        last_verified_at: lastVerifiedAt,
        qr_code: null,
        openwa_reachable: true,
        verification_changed: false,
      };
    }

    let session: OpenWaSession;
    try {
      session = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}`);
    } catch (error) {
      if (error instanceof OpenWaRequestError && error.status === 404) {
        const changed = settings?.openwa_session_status !== 'disconnected' || Boolean(settings?.openwa_connected_phone);
        await this.updateSession(tenantId, { openwa_session_status: 'disconnected', openwa_connected_phone: null });
        return {
          connected: false,
          session_status: 'disconnected',
          connected_phone: null,
          tenant_phone: tenantPhone,
          phone_matches: null,
          last_verified_at: lastVerifiedAt,
          qr_code: null,
          openwa_reachable: true,
          verification_changed: changed,
        };
      }
      await this.updateSession(tenantId, { openwa_session_status: 'openwa_unreachable', openwa_connected_phone: null });
      return {
        connected: false,
        session_status: 'openwa_unreachable',
        connected_phone: null,
        tenant_phone: tenantPhone,
        phone_matches: null,
        last_verified_at: lastVerifiedAt,
        qr_code: null,
        openwa_reachable: false,
        verification_changed: settings?.openwa_session_status !== 'openwa_unreachable',
      };
    }

    const providerStatus = String(session.status ?? 'unknown').toLowerCase();
    const phone = typeof session.phone === 'string' && session.phone.trim() ? session.phone : null;
    const canVerifyPhone = providerStatus === 'ready' && phone !== null;
    const matches = canVerifyPhone
      ? normalizeWhatsAppPhone(phone) === normalizeWhatsAppPhone(tenantPhone)
      : null;
    const storedStatus = providerStatus === 'ready'
      ? matches === false ? 'number_mismatch' : matches === null ? 'number_unavailable' : 'ready'
      : providerStatus;
    const storedPhone = providerStatus === 'ready' ? phone : null;
    const changed = providerStatus === 'ready' && (
      settings?.openwa_session_status !== storedStatus ||
      settings?.openwa_connected_phone !== storedPhone ||
      (canVerifyPhone && settings?.openwa_verified_at == null)
    );
    const verifiedAt = canVerifyPhone ? new Date() : null;
    await this.updateSession(tenantId, {
      openwa_session_status: storedStatus,
      openwa_connected_phone: storedPhone,
      ...(verifiedAt ? { openwa_verified_at: verifiedAt } : {}),
    });

    let qrCode: string | null = null;
    if (retrieveQr && providerStatus === 'qr_ready') {
      try {
        const qr = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/qr`);
        qrCode = typeof qr?.qrCode === 'string' ? qr.qrCode : null;
      } catch {
        // QR rotates; a not-ready response is retried on the next lightweight status poll.
      }
    }

    return {
      connected: providerStatus === 'ready' && matches === true,
      session_status: storedStatus,
      connected_phone: maskWhatsAppPhone(storedPhone),
      tenant_phone: tenantPhone,
      phone_matches: matches,
      last_verified_at: verifiedAt?.toISOString() ?? lastVerifiedAt,
      qr_code: qrCode,
      openwa_reachable: true,
      verification_changed: changed,
    };
  }

  async connectTenant(tenantId: string) {
    await withTenantContext(tenantId, async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`openwa-connect:${tenantId}`]);
      await trx('tenant_notification_settings').insert({ tenant_id: tenantId }).onConflict('tenant_id').ignore();
      const settings = await trx('tenant_notification_settings').where({ tenant_id: tenantId }).first();
      let session: OpenWaSession | null = null;
      let sessionId = settings?.openwa_session_id as string | null;

      if (sessionId) {
        try {
          session = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}`);
        } catch (error) {
          if (!(error instanceof OpenWaRequestError) || error.status !== 404) throw error;
          sessionId = null;
        }
      }

      if (!sessionId) {
        const name = `servitrack-${tenantId}`;
        try {
          session = await this.request('/api/sessions', { method: 'POST', body: JSON.stringify({ name }) });
        } catch (error) {
          if (!(error instanceof OpenWaRequestError) || error.status !== 409) throw error;
          const matches = await this.request(`/api/sessions?name=${encodeURIComponent(name)}`);
          session = Array.isArray(matches) ? matches.find((row: OpenWaSession) => row?.id) ?? null : null;
          if (!session) throw error;
        }
        sessionId = typeof session?.id === 'string' ? session.id : null;
        if (!sessionId) throw new Error('OpenWA tidak mengembalikan ID sesi');
        await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({
          openwa_session_id: sessionId,
          openwa_session_status: session?.status ?? 'created',
          openwa_connected_phone: null,
          openwa_verified_at: null,
          updated_at: trx.fn.now(),
        });
      }

      const status = String(session?.status ?? '').toLowerCase();
      if (!['initializing', 'qr_ready', 'authenticating', 'ready'].includes(status)) {
        try {
          session = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/start`, { method: 'POST' });
        } catch (error) {
          if (!(error instanceof OpenWaRequestError) || error.status !== 400) throw error;
          const current = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}`);
          if (!['initializing', 'qr_ready', 'authenticating', 'ready'].includes(String(current?.status).toLowerCase())) throw error;
          session = current;
        }
      }
      await trx('tenant_notification_settings').where({ tenant_id: tenantId }).update({
        openwa_session_status: session?.status ?? 'initializing',
        openwa_connected_phone: null,
        updated_at: trx.fn.now(),
      });
    });
    return this.getTenantStatus(tenantId);
  }

  async disconnectTenant(tenantId: string) {
    const { settings } = await this.tenantData(tenantId);
    const sessionId = settings?.openwa_session_id as string | null | undefined;
    if (!sessionId) {
      await this.updateSession(tenantId, { openwa_session_status: 'disconnected', openwa_connected_phone: null });
      return this.getTenantStatus(tenantId, false);
    }

    try {
      const session: OpenWaSession = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}`);
      const endpoint = String(session.status).toLowerCase() === 'ready' ? 'logout' : 'stop';
      await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/${endpoint}`, { method: 'POST' });
    } catch (error) {
      if (!(error instanceof OpenWaRequestError) || error.status !== 404) throw error;
    }
    await this.updateSession(tenantId, { openwa_session_status: 'disconnected', openwa_connected_phone: null });
    return this.getTenantStatus(tenantId, false);
  }

  private async sendForTenant(tenantId: string, toPhone: string, text: string): Promise<NotificationProviderResult> {
    const { settings } = await this.tenantData(tenantId);
    if (!settings?.openwa_session_id) throw new Error('WhatsApp tenant belum terhubung');
    const status = await this.getTenantStatus(tenantId, false);
    if (!status.connected) {
      const error = status.session_status === 'number_mismatch'
        ? 'Nomor WhatsApp tenant tidak cocok dengan tenants.phone'
        : status.session_status === 'number_unavailable'
          ? 'Nomor tidak tersedia dari OpenWA'
          : 'WhatsApp tenant belum terhubung';
      if (status.verification_changed) {
        await withTenantContext(tenantId, (trx) => trx('audit_logs').insert({
          tenant_id: tenantId,
          action: 'whatsapp.number_verification',
          entity_type: 'tenant_settings',
          entity_id: tenantId,
          actor_type: 'system',
          new_values: { result: status.phone_matches === true ? 'matched' : status.phone_matches === false ? 'mismatch' : 'unavailable', session_status: status.session_status },
          note: error,
        }));
      }
      throw new Error(error);
    }
    if (status.verification_changed) {
      await withTenantContext(tenantId, (trx) => trx('audit_logs').insert({
        tenant_id: tenantId,
        action: 'whatsapp.number_verification',
        entity_type: 'tenant_settings',
        entity_id: tenantId,
        actor_type: 'system',
        new_values: { result: 'matched', session_status: status.session_status },
      }));
    }
    const sessionId = settings.openwa_session_id as string;
    const payload = await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId: `${normalizeWhatsAppPhone(toPhone)}@c.us`, text }),
    });
    return { providerMessageId: providerMessageId(payload) };
  }

  async sendTextMessage(tenantId: string, toPhone: string, text: string): Promise<NotificationProviderResult> {
    return this.sendForTenant(tenantId, toPhone, text);
  }

  async sendTemplateMessage(
    tenantId: string,
    toPhone: string,
    templateName: string,
    variables: Record<string, unknown>
  ): Promise<NotificationProviderResult> {
    return this.sendForTenant(tenantId, toPhone, renderWhatsAppTemplate(templateName, variables));
  }

  async healthCheck(tenantId: string) {
    try {
      return (await this.getTenantStatus(tenantId, false)).connected;
    } catch {
      return false;
    }
  }
}

export { openWaErrorMessage };
