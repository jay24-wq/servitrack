export interface NotificationProviderResult {
  providerMessageId?: string | null;
}

export interface NotificationProvider {
  sendTextMessage(tenantId: string, toPhone: string, text: string): Promise<NotificationProviderResult>;
  sendTemplateMessage(
    tenantId: string,
    toPhone: string,
    templateName: string,
    variables: Record<string, unknown>
  ): Promise<NotificationProviderResult>;
  healthCheck(tenantId: string): Promise<boolean>;
}

export interface WhatsAppNotificationInput {
  tenantId: string;
  customerId: string;
  toPhone: string;
  templateName: string;
  variables: Record<string, unknown>;
  dedupeKey?: string | null;
  ticketId?: string | null;
  quotationId?: string | null;
  approvalUrl?: string;
}
