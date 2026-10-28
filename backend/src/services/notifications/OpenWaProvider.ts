import type { NotificationProvider, NotificationProviderResult } from './types';
import { renderWhatsAppTemplate } from './templates';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function providerMessageId(payload: any) {
  return payload?.messageId ?? payload?.id ?? payload?.data?.messageId ?? payload?.data?.id ?? null;
}

export class OpenWaProvider implements NotificationProvider {
  private readonly baseUrl = normalizeBaseUrl(required('OPENWA_BASE_URL'));
  private readonly apiKey = required('OPENWA_API_KEY');
  private readonly session = encodeURIComponent(required('OPENWA_SESSION'));

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
      throw new Error(`OpenWA ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
    }
    return payload;
  }

  async sendTextMessage(toPhone: string, text: string): Promise<NotificationProviderResult> {
    const payload = await this.request(`/api/sessions/${this.session}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId: `${toPhone.replace(/\D/g, '')}@c.us`, text }),
    });
    return { providerMessageId: providerMessageId(payload) };
  }

  async sendTemplateMessage(
    toPhone: string,
    templateName: string,
    variables: Record<string, string | number>
  ): Promise<NotificationProviderResult> {
    return this.sendTextMessage(toPhone, renderWhatsAppTemplate(templateName, variables));
  }

  async healthCheck() {
    try {
      await this.request(`/api/sessions/${this.session}`);
      return true;
    } catch {
      return false;
    }
  }
}
