import { apiClient } from '../services/api-client';

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'demo';

export interface PublicBookingInput {
  slug: string;
  name: string;
  phone_wa: string;
  category?: string;
  model: string;
  device_pin?: string;
  device_pin_refused?: boolean;
  complaint?: string;
  symptoms?: string[];
  service_method: 'mandiri' | 'terjadwal' | 'antar_jemput';
  slot_date?: string;
  pickup_time?: string;
  pickup_area?: string;
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
}

export interface PublicBookingResult {
  booking_code: string;
  tracking_code: string;
  queue_number?: string | null;
  slot_date: string;
  service_method: string;
  pickup_area?: string | null;
  pickup_address?: string | null;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
  pickup_time?: string | null;
  pickup_fee?: number | string | null;
  capacity: number;
  booked_count: number;
}

/** Event timeline gabungan (booking + service ticket) */
export interface TrackTimelineEvent {
  status: string;
  title: string;
  note: string | null;
  source: 'booking' | 'ticket' | 'courier' | 'payment';
  createdAt: string;
  actor: { name: string; phone: string | null } | null;
}

export interface TrackResult {
  trackingCode: string;
  currentStatus: string;
  currentStatusTitle: string;
  serviceMethod: string;
  estimatedDoneAt: string | null;
  createdAt: string;
  completedAt: string | null;
  device: {
    category: string;
    model: string | null;
  };
  branchName: string;
  timeline: TrackTimelineEvent[];
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string;
    branch_id?: string | null;
  };
}

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_id: string;
  branch_id: string | null;
  active_branch_id: string | null;
  active_branch_name: string | null;
  tenant_name: string;
  tenant_address?: string | null;
  avatar_data_url: string | null;
  time_zone: string;
  created_at: string;
  last_login_at: string | null;
}

export interface UpdateAccountInput {
  name: string;
  email: string;
  avatar_data_url: string | null;
  time_zone: string;
  current_password?: string;
  new_password?: string;
}

export type NotificationEventKey =
  | 'booking_new'
  | 'booking_pickup_new'
  | 'booking_cancelled'
  | 'courier_assignment_new'
  | 'courier_assignment_pending'
  | 'pickup_today'
  | 'delivery_today'
  | 'device_ready_diagnosis'
  | 'device_ready_repair'
  | 'device_repair_complete'
  | 'booking_capacity_nearly_full'
  | 'queue_over_capacity';

export interface NotificationPreferences {
  event_preferences: Record<NotificationEventKey, boolean>;
  channels: { whatsapp: boolean; email: boolean; in_app: boolean };
  updated_at: string;
}

export type UpdateNotificationPreferencesInput = Omit<NotificationPreferences, 'updated_at'>;

export interface WhatsAppConnectionStatus {
  connected: boolean;
  session_status: string | null;
  connected_phone: string | null;
  tenant_phone: string;
  phone_matches: boolean | null;
  last_verified_at: string | null;
  qr_code: string | null;
  openwa_reachable: boolean;
  test_recipient_default: string | null;
}

export interface TenantCustomizationProfile {
  name: string;
  description: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  logo_data_url: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
}

export interface TenantOperatingHour {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export interface TenantOperationalSettings {
  tracking_prefix: string;
  default_booking_capacity: number;
  operating_hours: TenantOperatingHour[];
}

export interface UpdateTenantOperationalSettingsInput {
  tracking_prefix: string;
  default_booking_capacity: number;
  operating_hours: TenantOperatingHour[];
}

export type UpdateTenantCustomizationProfileInput = Omit<TenantCustomizationProfile, 'latitude' | 'longitude'> & {
  latitude: number;
  longitude: number;
};

export type LoginPortal = 'admin' | 'staff';

export interface BranchRecord {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  is_main: boolean;
}

export interface BranchRecord {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  is_main: boolean;
}

export interface RegisterTenantInput {
  tenant_name: string;
  tenant_address?: string | null;
  owner_name: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  latitude: number;
  longitude: number;
  logo_data_url?: string;
}

export interface RegisterTenantResult {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string;
    branch_id: string;
  };
  data: {
    tenant_id: string;
    tenant_name: string;
  tenant_address?: string | null;
    slug: string;
    user_id: string;
    email: string;
    address: string;
    latitude: number | string;
    longitude: number | string;
  };
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  phone_wa?: string | null;
  [key: string]: any;
}

export interface DeviceRow {
  id: string;
  customer_id: string;
  category?: string | null;
  model?: string | null;
  [key: string]: any;
}

export interface CreateTicketPayload {
  branch_id?: string;
  customer_id?: string;
  device_id?: string;
  service_method: string;
  booking_id?: string | null;
  technician_id?: string | null;
  complaint: string;
  /** Walk-in: backend akan mencari/membuat pelanggan berdasarkan nomor WA */
  customer_name?: string;
  customer_phone?: string;
  /** Check-in baru wajib mengirim nama lengkap perangkat. */
  device_category?: string;
  device_model: string;
  device_pin?: string;
  device_pin_refused?: boolean;
  initial_estimate_cost?: number | null;
}

export async function loginRequest(email: string, password: string, portal: LoginPortal = 'admin') {
  const { data } = await apiClient.post<LoginResult>('/auth/login', { email, password, portal });
  return data;
}

export async function registerTenant(input: RegisterTenantInput) {
  const { data } = await apiClient.post<RegisterTenantResult>('/auth/register', input);
  return data;
}

export async function getBranches() {
  const { data } = await apiClient.get<{ data: BranchRecord[] }>('/branches');
  return data.data;
}

export async function logoutRequest() {
  await apiClient.post('/auth/logout');
}

export async function getMyAccount() {
  const { data } = await apiClient.get<{ user: AccountProfile }>('/auth/me');
  return data.user;
}

export async function updateMyAccount(input: UpdateAccountInput) {
  const { data } = await apiClient.put<{ user: AccountProfile }>('/auth/me', input);
  return data.user;
}

export async function getTenantCustomizationProfile() {
  const { data } = await apiClient.get<{ data: TenantCustomizationProfile }>('/tenant/profile');
  return data.data;
}

export async function getNotificationPreferences() {
  const { data } = await apiClient.get<{ data: NotificationPreferences }>('/notifications/settings');
  return data.data;
}

export async function updateNotificationPreferences(input: UpdateNotificationPreferencesInput) {
  const { data } = await apiClient.put<{ data: NotificationPreferences }>('/notifications/settings', input);
  return data.data;
}

export async function getWhatsAppConnectionStatus() {
  const { data } = await apiClient.get<{ data: WhatsAppConnectionStatus }>('/whatsapp/status');
  return data.data;
}

export async function connectWhatsApp() {
  const { data } = await apiClient.post<{ data: WhatsAppConnectionStatus }>('/whatsapp/connect');
  return data.data;
}

export async function disconnectWhatsApp() {
  const { data } = await apiClient.post<{ data: WhatsAppConnectionStatus }>('/whatsapp/disconnect');
  return data.data;
}

export async function sendWhatsAppConnectionTest(to_phone: string) {
  const { data } = await apiClient.post<{ data: { status: 'sent'; provider_message_id: string | null } }>('/whatsapp/test', { to_phone });
  return data.data;
}

export async function updateTenantCustomizationProfile(input: UpdateTenantCustomizationProfileInput) {
  const { data } = await apiClient.put<{ data: TenantCustomizationProfile }>('/tenant/profile', input);
  return data.data;
}

export async function getTenantOperationalSettings() {
  const { data } = await apiClient.get<{ data: TenantOperationalSettings }>('/tenant/operational');
  return data.data;
}

export async function updateTenantOperationalSettings(input: UpdateTenantOperationalSettingsInput) {
  const { data } = await apiClient.put<{ data: TenantOperationalSettings }>('/tenant/operational', input);
  return data.data;
}

export type TrackingContactVisibility = 'full' | 'masked' | 'hidden';

export interface TenantPublicTrackingSettings {
  contact_visibility: TrackingContactVisibility;
}

export async function getTenantPublicTrackingSettings() {
  const { data } = await apiClient.get<{ data: TenantPublicTrackingSettings }>('/tenant/public-tracking');
  return data.data;
}

export async function updateTenantPublicTrackingSettings(input: TenantPublicTrackingSettings) {
  const { data } = await apiClient.put<{ data: TenantPublicTrackingSettings }>('/tenant/public-tracking', input);
  return data.data;
}

export async function createPublicBooking(input: PublicBookingInput) {
  const { data } = await apiClient.post<{ message: string; data: PublicBookingResult }>('/public/bookings', input);
  return data.data;
}

export interface PublicCapacitySlot {
  slot_date: string;
  capacity: number;
  booked_count: number;
  is_open: boolean;
  open_time?: string | null;
  close_time?: string | null;
  exception_status?: 'closed' | 'limited' | null;
  exception_title?: string | null;
}

export interface PublicCapacityResult {
  branch: { id: string; name: string; address: string | null };
  slots: PublicCapacitySlot[];
  today: { capacity: number; booked_count: number } | null;
  average_turnaround_days: number;
  on_time_rate: number | null;
}

export interface PublicWorkshop {
  tenant_id: string;
  slug: string;
  branch: { id: string; name: string; address: string | null } | null;
}

export async function getPublicWorkshop(slug: string) {
  const { data } = await apiClient.get<{ data: PublicWorkshop }>(`/public/tenant/${encodeURIComponent(slug)}`);
  return data.data;
}

export async function getPublicCapacity(slug: string, month: string) {
  const { data } = await apiClient.get<{ data: PublicCapacityResult }>('/public/capacity', { params: { slug, month } });
  return data.data;
}

export async function getPayments(params?: Record<string, string>) {
  const { data } = await apiClient.get<{ data: any[] }>('/payments', { params });
  return data.data;
}

export async function getPaymentSummary() {
  const { data } = await apiClient.get<{ data: { total_billed: number; total_paid: number; waiting_count: number; transactions_today: number } }>('/payments/summary');
  return data.data;
}

export async function getReadyToBill() {
  const { data } = await apiClient.get<{ data: any[] }>('/invoices/ready');
  return data.data;
}

export interface OfflinePaymentInput {
  invoice_id: string;
  method: 'cash' | 'bank_transfer' | 'qris_static' | 'ewallet' | 'edc';
  amount: number;
  reference_no?: string;
  cash_received?: number;
  idempotency_key: string;
}

export async function createOfflinePayment(input: OfflinePaymentInput, proof?: File | null) {
  const body = new FormData();
  Object.entries(input).forEach(([key, value]) => body.append(key, String(value)));
  if (proof) body.append('proof', proof);
  const { data } = await apiClient.post<{ data: any; invoice_status: string }>('/payments', body, {
    headers: { 'Idempotency-Key': input.idempotency_key, 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function createPaymentLink(invoiceId: string, idempotencyKey: string) {
  const { data } = await apiClient.post<{ data: any; notification: { status: string; error?: string; deduplicated?: boolean } }>(
    `/payments/${encodeURIComponent(invoiceId)}/online-link`, { idempotency_key: idempotencyKey },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return data;
}

export async function sendPaymentInfo(invoiceId: string) {
  const { data } = await apiClient.post<{ data: { status: string; error?: string; deduplicated?: boolean } }>(`/payments/${encodeURIComponent(invoiceId)}/send-info`);
  return data.data;
}

export async function handoverPaidInvoice(invoiceId: string) {
  const { data } = await apiClient.post<{ data: { handed_over_by: string; handed_over_at: string } }>(`/payments/${encodeURIComponent(invoiceId)}/handover`);
  return data.data;
}

export async function refundPaidInvoice(invoiceId: string, reason: string, externalRefundConfirmed = false, refundReference = '') {
  const { data } = await apiClient.post<{ data: { status: string; reason: string; invoice_status: string } }>(`/payments/${encodeURIComponent(invoiceId)}/refund`, {
    reason, external_refund_confirmed: externalRefundConfirmed, refund_reference: refundReference,
  });
  return data.data;
}

export async function cancelUnpaidInvoice(invoiceId: string, reason: string) {
  const { data } = await apiClient.post<{ data: { status: string; reason: string } }>(`/payments/${encodeURIComponent(invoiceId)}/cancel`, { reason });
  return data.data;
}

export interface PaymentInstructions {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  static_qris_image_url: string;
  ewallet_provider: string;
  ewallet_account: string;
}

export async function getPaymentInstructions() {
  const { data } = await apiClient.get<{ data: PaymentInstructions }>('/payments/settings');
  return data.data;
}

export async function updatePaymentInstructions(input: PaymentInstructions) {
  const { data } = await apiClient.put<{ data: PaymentInstructions }>('/payments/settings', input);
  return data.data;
}

export async function getDashboard() {
  const { data } = await apiClient.get<{ data: any }>('/dashboard');
  return data.data;
}

export async function getReportsDashboard(params: Record<string, string | number>) {
  const { data } = await apiClient.get<{ data: any; range: any }>('/reports/dashboard', { params });
  return data;
}

export async function getTechnicianWorkflowReport(params: Record<string, string | number>) {
  const { data } = await apiClient.get<{ data: any[] }>('/reports/technician-workflow', { params });
  return data.data;
}

export async function getReportsAudit(params: Record<string, string | number>) {
  const { data } = await apiClient.get<{ data: any[]; options: any[]; actors?: string[]; actions?: string[]; pagination: any }>('/reports/audit', { params });
  return data;
}

export async function getInventoryMovements(search = '', page = 1, limit = 10) {
  const { data } = await apiClient.get<{ data: any[]; pagination: any }>('/inventory/movements', { params: { search, page, limit } });
  return data;
}

export async function addInventoryStock(payload: { part_id: string; qty: number; cost_price?: number; note?: string }) {
  const { data } = await apiClient.post<{ data: any }>('/inventory/stock-in', payload);
  return data.data;
}

export async function reversePartMovement(movementId: string, reason: string) {
  const { data } = await apiClient.post<{ data: any }>(`/parts-usage/${encodeURIComponent(movementId)}/reverse`, { reason });
  return data.data;
}

export async function deletePart(id: string) {
  const { data } = await apiClient.delete<{ data: any }>(`/inventory/parts/${id}`);
  return data.data;
}

export async function updatePart(id: string, payload: any) {
  const { data } = await apiClient.put<{ data: any }>(`/inventory/parts/${id}`, payload);
  return data.data;
}

export async function createPart(payload: any) {
  const { data } = await apiClient.post<{ data: any }>('/inventory/parts', payload);
  return data.data;
}

export interface InventoryPartRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  sku: string;
  name: string;
  spec?: string | null;
  category?: string | null;
  unit?: string | null;
  stock_qty: number | string;
  min_stock: number | string;
  sell_price: number | string;
  cost_price?: number | string;
  bin_location?: string | null;
  is_active: boolean;
}

export async function getInventoryParts(status = 'active') {
  const { data } = await apiClient.get<{ data: InventoryPartRow[] }>('/inventory/parts', { params: { status } });
  return data.data;
}

export interface PartRequestRow {
  id: string;
  ticket_id: string;
  quotation_id: string;
  quotation_item_id: string;
  requested_name: string;
  specification: string | null;
  qty: number | string;
  estimated_price: number | string;
  estimated_arrival_days: number;
  status: 'PENDING_APPROVAL' | 'OPEN' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  ticket_code: string;
  technician_name: string;
  actual_price?: number | string | null;
  price_difference?: number | string | null;
  linked_part_id?: string | null;
  linked_part_name?: string | null;
}

export async function getPartRequests(status = 'active') {
  const { data } = await apiClient.get<{ data: PartRequestRow[]; summary: Record<string, number> }>('/inventory/part-requests', { params: { status } });
  return data;
}

export async function orderPartRequest(id: string, estimatedArrivalDays?: number) {
  const { data } = await apiClient.post<{ data: PartRequestRow }>(`/inventory/part-requests/${encodeURIComponent(id)}/order`, {
    estimated_arrival_days: estimatedArrivalDays,
  });
  return data.data;
}

export async function cancelPartRequest(id: string, reason: string) {
  const { data } = await apiClient.post<{ data: PartRequestRow }>(`/inventory/part-requests/${encodeURIComponent(id)}/cancel`, { reason });
  return data.data;
}

export async function receivePartRequest(id: string, input: { linked_part_id?: string; new_part?: any; qty_received: number; actual_price?: number }) {
  const { data } = await apiClient.post<{ data: any }>(`/inventory/part-requests/${encodeURIComponent(id)}/receive`, input);
  return data.data;
}

export interface TicketPartUsageRow {
  id: string;
  ticket_id: string;
  part_id: string;
  movement_id: string;
  quotation_item_id?: string | null;
  used_by: string;
  qty: number | string;
  net_qty?: number | string;
  unit_price: number | string;
  used_at: string;
  part_name: string;
  part_sku: string;
  unit: string;
  technician_name: string | null;
}

export async function getTicketPartUsages(ticketId: string) {
  const { data } = await apiClient.get<{ data: TicketPartUsageRow[] }>(
    `/parts-usage/ticket/${encodeURIComponent(ticketId)}`
  );
  return data.data;
}

export async function recordTicketPartUsage(input: { ticket_id: string; part_id: string; qty: number }) {
  const { data } = await apiClient.post<{
    data: { usage: TicketPartUsageRow; movement: any; stock_qty: number };
  }>('/parts-usage/use', input);
  return data.data;
}

export async function getTickets() {
  const { data } = await apiClient.get<{ data: any[] }>('/tickets');
  return data.data;
}

export interface TechnicianDashboardRow {
  id: string;
  ticket_code: string;
  tracking_code?: string | null;
  technician_id: string;
  current_status: string;
  device_pin?: string | null;
  device_pin_refused?: boolean;
  work_type?: 'without_parts' | 'with_parts' | null;
  diagnosis_status?: 'matches_complaint' | 'additional_damage' | null;
  technician_diagnosis?: string | null;
  additional_damage?: string | null;
  requested_part_id?: string | null;
  requested_part_qty?: number | string | null;
  complaint: string;
  service_method: string;
  estimated_done_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_model?: string | null;
  [key: string]: unknown;
}

export interface TechnicianDashboardResult {
  stats: {
    antrean: number;
    prioritas: number;
    menunggu_part: number;
    selesai: number;
  };
  tickets: TechnicianDashboardRow[];
}

export async function getTechnicianDashboard(search = '') {
  const { data } = await apiClient.get<{ data: TechnicianDashboardResult }>('/tickets/technician/dashboard', {
    params: search ? { search } : undefined,
  });
  return data.data;
}

export async function getTicket(id: string) {
  const { data } = await apiClient.get<{ data: any }>(`/tickets/${encodeURIComponent(id)}`);
  return data.data;
}

export interface TicketAssessmentInput {
  work_type: 'without_parts' | 'with_parts';
  diagnosis_status: 'matches_complaint';
  technician_diagnosis: string;
  part_id?: string;
  part_qty?: number;
}

export interface TicketQuotationInput {
  ticket_id: string;
  work_type: 'without_parts' | 'with_parts';
  diagnosis_status: 'matches_complaint' | 'additional_damage';
  technician_diagnosis: string;
  additional_damage: string;
  part_id?: string;
  part_qty?: number;
  labor_estimate: number;
  items?: Array<{
    damage_description: string;
    part_id?: string;
    is_unregistered_part?: boolean;
    requested_name?: string;
    specification?: string;
    estimated_price?: number;
    estimated_part_arrival_days?: number;
    qty: number;
    labor_cost: number;
  }>;
}

export async function saveTicketAssessment(ticketId: string, input: TicketAssessmentInput) {
  const { data } = await apiClient.post<{ data: any }>(`/tickets/${encodeURIComponent(ticketId)}/assessment`, input);
  return data.data;
}

export async function saveTicketServiceFee(ticketId: string, serviceFee: number) {
  const { data } = await apiClient.put<{ data: any }>(`/tickets/${encodeURIComponent(ticketId)}/service-fee`, {
    service_fee: serviceFee,
  });
  return data.data;
}

export async function saveTicketDiagnosticFee(ticketId: string, diagnosticFee: number) {
  const { data } = await apiClient.put<{ data: any }>(`/tickets/${encodeURIComponent(ticketId)}/diagnostic-fee`, { diagnostic_fee: diagnosticFee });
  return data.data;
}

export async function saveTicketWorkNote(ticketId: string, content: string) {
  const { data } = await apiClient.post<{ data: any }>(`/tickets/${encodeURIComponent(ticketId)}/notes`, {
    note_type: 'internal',
    content,
  });
  return data.data;
}

export async function createTicketQuotation(input: TicketQuotationInput) {
  const { data } = await apiClient.post<{ data: any }>('/quotations', input);
  return data.data;
}

export async function retryTicketQuotation(quotationId: string) {
  const { data } = await apiClient.post<{ data: any }>(`/quotations/${encodeURIComponent(quotationId)}/retry-send`);
  return data.data;
}

export async function decideTicketQuotationManually(quotationId: string, decision: 'approved' | 'rejected', note: string) {
  const { data } = await apiClient.post<{ data: any }>(`/quotations/${encodeURIComponent(quotationId)}/manual-decision`, { decision, note });
  return data.data;
}

export interface PublicQuotation {
  id: string;
  quotation_number: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'superseded';
  is_expired?: boolean;
  ticket_status?: string;
  total_amount: number | string;
  expires_at: string;
  decided_at: string | null;
  decision_note: string | null;
  ticket_code: string;
  complaint: string;
  work_type: 'without_parts' | 'with_parts' | null;
  technician_diagnosis: string | null;
  customer_name: string;
  items: Array<{
    id: string;
    part_id: string | null;
    item_type: 'part' | 'labor';
    part_is_registered?: boolean;
    part_name_snapshot?: string | null;
    part_specification_snapshot?: string | null;
    description: string;
    qty: number;
    unit_price: number | string;
    subtotal: number | string;
    damage_description?: string;
    labor_cost?: number | string;
    part_cost?: number | string;
    part_unit_price_snapshot?: number | string;
    availability_status?: 'TERSEDIA' | 'TIDAK_TERSEDIA' | 'TERSEDIA_SEBAGIAN' | null;
    available_qty_snapshot?: number | null;
    estimated_part_arrival_days?: number | null;
    part_name?: string | null;
    part_sku?: string | null;
  }>;
}

export async function getPublicQuotation(token: string) {
  const { data } = await apiClient.get<{ data: PublicQuotation }>(`/public/quotations/${encodeURIComponent(token)}`);
  return data.data;
}

export async function decidePublicQuotation(token: string, decision: 'approve' | 'reject', note?: string) {
  const { data } = await apiClient.post<{ data: { quotation: PublicQuotation; ticket_status: string } }>(
    `/public/quotations/${encodeURIComponent(token)}/decision`,
    { decision, note }
  );
  return data.data;
}

export async function resolveRejectedQuotation(ticketId: string, quotationId: string, action: 'continue_original' | 'cancel_and_return') {
  const { data } = await apiClient.post<{ data: any }>(
    `/quotations/${encodeURIComponent(quotationId)}/resolve-rejection`,
    { ticket_id: ticketId, action }
  );
  return data.data;
}

export interface TechnicianWorkload {
  id: string;
  name: string;
  phone?: string | null;
  created_at: string;
  active_count: number;
  total_count: number;
  completed_count: number;
  last_assigned_at: string | null;
}

export interface TechnicianWorkloadSummary {
  total_active: number;
  total_technicians: number;
  busiest_technician: TechnicianWorkload | null;
}

export async function getTechnicianWorkload() {
  const { data } = await apiClient.get<{
    data: TechnicianWorkload[];
    summary: TechnicianWorkloadSummary;
  }>('/tickets/technicians/workload');
  return data;
}

export async function assignTicketTechnician(
  id: string,
  input: { technician_id: string; note?: string; to_status?: string }
) {
  const { data } = await apiClient.put<{
    message: string;
    data: {
      from_technician: { id: string; name: string } | null;
      to_technician: { id: string; name: string; active_count: number };
      note: string;
    };
  }>(`/tickets/${encodeURIComponent(id)}/assign`, input);
  return data;
}

// Fetch bookings from backend API
export async function getBookings() {
  const { data } = await apiClient.get<{ data: any[] }>('/bookings');
  return data.data;
}

export interface BookingCalendarException {
  id: string;
  branch_id: string;
  slot_date: string;
  status: 'closed' | 'limited';
  capacity_override: number | null;
  title: string;
  notes: string | null;
}

export async function getBookingCalendarExceptions(month: string) {
  const { data } = await apiClient.get<{ data: BookingCalendarException[] }>('/booking-calendar', { params: { month } });
  return data.data;
}

export async function createBookingCalendarException(input: Omit<BookingCalendarException, 'id' | 'branch_id'>) {
  const { data } = await apiClient.post<{ data: BookingCalendarException }>('/booking-calendar', input);
  return data.data;
}

export async function updateBookingCalendarException(id: string, input: Omit<BookingCalendarException, 'id' | 'branch_id'>) {
  const { data } = await apiClient.put<{ data: BookingCalendarException }>(`/booking-calendar/${encodeURIComponent(id)}`, input);
  return data.data;
}

export async function deleteBookingCalendarException(id: string) {
  await apiClient.delete(`/booking-calendar/${encodeURIComponent(id)}`);
}

export interface InvoiceRow {
  id: string;
  ticket_id: string;
  invoice_no: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  subtotal: number;
  pickup_fee: number | string;
  additional_cost: number | string;
  discount: number | string;
  total: number;
  ticket_code?: string | null;
  tracking_code?: string | null;
  current_status?: string | null;
  customer_name?: string | null;
  line_items?: Array<{ type: string; name: string; quantity: number; unit_price: number; total: number }>;
  [key: string]: unknown;
}

export async function getInvoices() {
  const { data } = await apiClient.get<{ data: InvoiceRow[] }>('/invoices');
  return data.data;
}

export async function createInvoice(ticketId: string) {
  const { data } = await apiClient.post<{ data: InvoiceRow }>('/invoices', { ticket_id: ticketId });
  return data.data;
}

export async function trackTicket(trackingCode: string) {
  const { data } = await apiClient.get<TrackResult>(`/tracking/${encodeURIComponent(trackingCode)}`);
  return data;
}

export async function getStaff(params: Record<string, string | number> = {}) {
  const { data } = await apiClient.get<{ data: any[]; stats: any; pagination: any }>('/staff', { params });
  return data;
}

export async function updateStaff(id: string, payload: { name?: string; email?: string; password?: string; phone?: string; role?: string; branch_id?: string | null; is_active?: boolean; courier_status?: 'ONLINE' | 'OFFLINE' }) {
  const { data } = await apiClient.put<{ data: any }>(`/staff/${encodeURIComponent(id)}`, payload);
  return data.data;
}

export async function createStaff(payload: { name: string; email: string; phone: string; password: string; role: string; branch_id?: string | null }) {
  const { data } = await apiClient.post<{ data: any }>('/staff', payload);
  return data.data;
}

export async function deleteStaff(id: string) {
  const { data } = await apiClient.delete<{ data: any }>(`/staff/${encodeURIComponent(id)}`);
  return data;
}

export async function createCustomer(input: { name: string; phone: string }) {
  const { data } = await apiClient.post<{ data: CustomerRow }>('/customers', input);
  return data.data;
}

export async function getCustomers() {
  const { data } = await apiClient.get<{ data: CustomerRow[] }>('/customers');
  return data.data;
}

export async function createDevice(
  customerId: string,
  input: { category: string; model: string }
) {
  const { data } = await apiClient.post<{ data: DeviceRow }>(
    `/customers/${encodeURIComponent(customerId)}/devices`,
    input
  );
  return data.data;
}

export async function getCustomerDevices(customerId: string) {
  const { data } = await apiClient.get<{ data: DeviceRow[] }>(
    `/customers/${encodeURIComponent(customerId)}/devices`
  );
  return data.data;
}

export async function createTicket(payload: CreateTicketPayload, idempotencyKey: string) {
  const { data } = await apiClient.post<{ data: any }>('/tickets', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data.data;
}

export async function updateTicketStatus(id: string, status: string, note?: string) {
  const { data } = await apiClient.put<{ message: string }>(
    `/tickets/${encodeURIComponent(id)}/status`,
    { to_status: status, note }
  );
  return data;
}

export async function updateBooking(id: string, patch: { status: string }) {
  const { data } = await apiClient.put<{ data: any }>(`/bookings/${encodeURIComponent(id)}`, patch);
  return data.data;
}

export interface CourierAssignment {
  id: string;
  assignment_type: 'pickup' | 'delivery';
  status: string;
  booking_code?: string | null;
  ticket_code?: string | null;
  reference?: string | null;
  customer_name?: string;
  customer_phone?: string;
  booking_customer_phone_snapshot?: string | null;
  customer_address?: string | null;
  customer_latitude?: number | string | null;
  customer_longitude?: number | string | null;
  branch_name?: string | null;
  branch_address?: string | null;
  tenant_name?: string | null;
  tenant_address?: string | null;
  store_latitude?: number | string | null;
  store_longitude?: number | string | null;
  device_picked_up?: boolean;
  failure_reason?: string | null;
  failure_notes?: string | null;
  proofs?: unknown[];
  tracking_code?: string;
  pickup_address?: string;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
  pickup_time?: string | null;
  service_status?: string | null;
  invoice_status?: string | null;
  device_model?: string | null;
  schedule_date?: string | null;
  schedule_time?: string | null;
  [key: string]: unknown;
}

export async function getCourierDashboard() {
  const { data } = await apiClient.get<{ data: { stats: Record<string, number>; active: CourierAssignment[]; schedule: CourierAssignment[] } }>('/courier/dashboard');
  return data.data;
}

export async function getCourierAssignments(type?: 'pickup' | 'delivery') {
  const { data } = await apiClient.get<{ data: CourierAssignment[] }>('/courier/assignments', { params: type ? { type } : undefined });
  return data.data;
}

export async function getCourierAssignment(id: string) {
  const { data } = await apiClient.get<{ data: CourierAssignment & { locations?: Array<{ latitude: number | string; longitude: number | string; status: string }>; proofs?: unknown[] } }>(`/courier/assignments/${encodeURIComponent(id)}`);
  return data.data;
}

export interface CourierRoute {
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  distance: number;
  duration: number;
}

export async function getCourierAssignmentRoute(id: string, signal: AbortSignal) {
  const { data } = await apiClient.get<{ data: CourierRoute }>(`/courier/assignments/${encodeURIComponent(id)}/route`, { signal, timeout: 6500 });
  return data.data;
}

export async function updateCourierStatus(id: string, payload: { status: string; latitude?: number; longitude?: number; failure_reason?: string; failure_notes?: string }) {
  const { data } = await apiClient.patch<{ data: CourierAssignment }>(`/courier/assignments/${encodeURIComponent(id)}/status`, payload);
  return data.data;
}

export async function uploadCourierProof(id: string, input: { type: 'pickup' | 'delivery'; photo?: File; notes: string; latitude?: number; longitude?: number }) {
  const body = new FormData();
  body.append('type', input.type); body.append('notes', input.notes);
  if (input.photo) body.append('photo', input.photo);
  if (input.latitude !== undefined) body.append('latitude', String(input.latitude));
  if (input.longitude !== undefined) body.append('longitude', String(input.longitude));
  const { data } = await apiClient.post<{ data: unknown }>(`/courier/assignments/${encodeURIComponent(id)}/proofs`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.data;
}

export interface CourierQueueItem {
  id: string;
  reference: string;
  assignment_type: 'pickup' | 'delivery';
  customer_name: string;
  customer_phone?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  created_at: string;
}

export async function getCourierAssignmentQueue() {
  const { data } = await apiClient.get<{ data: CourierQueueItem[] }>('/courier/queue');
  return data.data;
}

export async function getCourierRecommendations(type: 'pickup' | 'delivery', id: string) {
  const { data } = await apiClient.get<{ data: Array<{ id: string; name: string; phone: string | null; active_tasks: number; recommended: boolean; reason: string }> }>(`/courier/queue/${type}/${encodeURIComponent(id)}/recommendations`);
  return data.data;
}

export async function assignCourier(input: { courier_id: string; assignment_type: 'pickup' | 'delivery'; booking_id?: string; ticket_id?: string; assignment_reason?: string }) {
  const { data } = await apiClient.post<{ data: CourierAssignment }>('/courier/assignments', input);
  return data.data;
}
