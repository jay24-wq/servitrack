import { sendWhatsAppNotification } from './notificationService';

const dateLabel = (value: string | Date | null | undefined) => value
  ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  : '-';

export function notifyBookingCreated(input: {
  tenantId: string; customerId: string; phone: string; serviceMethod: string; trackingCode: string; queueNumber?: string | null; bookingDate: string;
}) {
  if (input.serviceMethod !== 'dropoff') return Promise.resolve({ status: 'skipped' as const });
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone,
    templateName: 'booking_dropoff_created',
    variables: { trackingCode: input.trackingCode, queueNumber: input.queueNumber ?? '-', bookingDate: dateLabel(input.bookingDate) },
  });
}

export function notifyTicketCreated(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; ticketCode: string; trackingCode: string;
}) {
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId,
    templateName: 'service_ticket_created', variables: { ticketCode: input.ticketCode, trackingCode: input.trackingCode },
  });
}

export function notifyTicketStatusChanged(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; trackingCode: string; status: string;
}) {
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId,
    templateName: input.status === 'siap_diambil' ? 'ready_for_pickup' : 'ticket_status_changed',
    variables: { trackingCode: input.trackingCode, status: input.status },
  });
}

export function notifyQuotationCreated(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; quotationId: string; quotationNumber: string; totalAmount: number; approvalToken: string;
}) {
  const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId, quotationId: input.quotationId,
    templateName: 'quotation_created', variables: { quotationNumber: input.quotationNumber, totalAmount: input.totalAmount, approvalLink: `${baseUrl}/quotation/approve/${input.approvalToken}` },
  });
}

export function notifyPaymentReceived(input: {
  tenantId: string; customerId: string; phone: string; ticketId: string; invoiceNumber: string; amount: number; paymentStatus: string;
}) {
  return sendWhatsAppNotification({
    tenantId: input.tenantId, customerId: input.customerId, toPhone: input.phone, ticketId: input.ticketId,
    templateName: 'payment_received', variables: { invoiceNumber: input.invoiceNumber, amount: input.amount, paymentStatus: input.paymentStatus },
  });
}
