export interface NotificationProviderResult {
  providerMessageId?: string | null;
}

export interface NotificationProvider {
  sendTextMessage(toPhone: string, text: string): Promise<NotificationProviderResult>;
  sendTemplateMessage(
    toPhone: string,
    templateName: string,
    variables: Record<string, string | number>
  ): Promise<NotificationProviderResult>;
  healthCheck(): Promise<boolean>;
}

export interface WhatsAppNotificationInput {
  tenantId: string;
  customerId: string;
  toPhone: string;
  templateName: string;
  variables: Record<string, string | number>;
  ticketId?: string | null;
  quotationId?: string | null;
}
