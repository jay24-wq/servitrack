import { enqueueWhatsAppNotification, sendWhatsAppNotification } from './notificationService';

export function notifyBookingCreated(input: {
  tenantId: string; customerId: string; bookingId: string; phone: string; serviceMethod: string;
  trackingCode: string; queueNumber?: string | null; bookingDate: string | Date;
}) {
  if (input.serviceMethod !== 'dropoff') return Promise.resolve({ status: 'skipped' as const });
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    templateName: 'booking_dropoff_created',
    dedupeKey: `booking:${input.bookingId}:created`,
    variables: { trackingCode: input.trackingCode, queueNumber: input.queueNumber ?? '', bookingDate: input.bookingDate },
  });
}

export function notifyTicketCreated(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; ticketCode: string;
  trackingCode: string; notificationLogId?: string | null;
}) {
  const notification = {
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId,
    templateName: 'service_ticket_created', dedupeKey: `ticket:${input.ticketId}:created`,
    variables: { ticketCode: input.ticketCode, trackingCode: input.trackingCode },
  };
  if (input.notificationLogId) {
    enqueueWhatsAppNotification(notification, input.notificationLogId);
    return Promise.resolve({ status: 'queued' as const, id: input.notificationLogId });
  }
  return sendWhatsAppNotification(notification);
}

export function notifyTicketStatusChanged(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; trackingCode: string;
  previousStatus: string; status: string; details?: string;
}) {
  if (input.previousStatus === input.status) return Promise.resolve({ status: 'skipped' as const });
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId,
    templateName: input.status === 'siap_diambil' ? 'ready_for_pickup' : 'ticket_status_changed',
    dedupeKey: `ticket:${input.ticketId}:status:${input.previousStatus}->${input.status}`,
    variables: { trackingCode: input.trackingCode, status: input.status, details: input.details ?? '' },
  });
}

export async function notifyQuotationCreated(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; quotationId: string;
  quotationNumber: string; totalAmount: number; approvalToken: string; trackingCode: string;
  ticketCode: string; complaint: string; diagnosis: string; items: unknown[]; expiresAt: string;
  dedupeKey?: string | null;
}) {
  const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const approvalUrl = `${baseUrl}/quotation/approve/${input.approvalToken}`;
  const notification = await sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    ticketId: input.ticketId, quotationId: input.quotationId, approvalUrl,
    templateName: 'quotation_created',
    dedupeKey: input.dedupeKey === undefined ? `quotation:${input.quotationId}:created` : input.dedupeKey,
    variables: {
      quotationNumber: input.quotationNumber,
      ticketCode: input.ticketCode,
      trackingCode: input.trackingCode,
      complaint: input.complaint,
      diagnosis: input.diagnosis,
      items: input.items,
      totalAmount: input.totalAmount,
      approvalLink: approvalUrl,
      expiresAt: input.expiresAt,
    },
  });
  return { ...notification, approvalUrl };
}

export async function notifyQuotationReminder(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; quotationId: string;
  quotationNumber: string; totalAmount: number; approvalToken: string; ticketCode: string;
  trackingCode: string; expiresAt: string;
}) {
  const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const approvalUrl = `${baseUrl}/quotation/approve/${input.approvalToken}`;
  const notification = await sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    ticketId: input.ticketId, quotationId: input.quotationId,
    templateName: 'quotation_reminder',
    dedupeKey: `quotation:${input.quotationId}:reminder:${input.approvalToken}`,
    variables: {
      quotationNumber: input.quotationNumber,
      ticketCode: input.ticketCode,
      trackingCode: input.trackingCode,
      totalAmount: input.totalAmount,
      expiresAt: input.expiresAt,
      approvalLink: approvalUrl,
    },
  });
  return { ...notification, approvalUrl };
}

export function notifyPaymentReceived(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; paymentId: string;
  invoiceNumber: string; trackingCode: string; amount: number; paymentStatus: string;
}) {
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    ticketId: input.ticketId, templateName: 'payment_received',
    dedupeKey: `payment:${input.paymentId}:paid`,
    variables: {
      invoiceNumber: input.invoiceNumber, trackingCode: input.trackingCode,
      amount: input.amount, paymentStatus: input.paymentStatus,
    },
  });
}

export function notifyCourierEvent(input: {
  tenantId: string; customerId: string; phone: string; assignmentId: string;
  assignmentType: 'pickup' | 'delivery'; trackingCode: string; previousStatus: string;
  status: string; failureReason?: string | null;
}) {
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    templateName: input.assignmentType === 'pickup' ? 'courier_pickup' : 'courier_delivery',
    dedupeKey: `courier:${input.assignmentId}:status:${input.previousStatus}->${input.status}`,
    variables: {
      trackingCode: input.trackingCode,
      status: input.status,
      failureReason: input.failureReason ?? '',
    },
  });
}
