import { apiClient } from '../services/api-client';

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'demo';

export interface PublicBookingInput {
  slug: string;
  name: string;
  phone_wa: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
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
  source: 'booking' | 'ticket';
  createdAt: string;
}

export interface TrackResult {
  trackingCode: string;
  currentStatus: string;
  currentStatusTitle: string;
  serviceMethod: string;
  complaint: string;
  estimatedDoneAt: string | null;
  finalCost: number | null;
  initialEstimateCost: number | null;  createdAt: string;
  completedAt: string | null;
  customerName: string;
  device: {
    category: string;
    brand: string;
    model: string | null;
    serialNumber: string | null;
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
    plan?: string;
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
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
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
  /** Walk-in: backend akan mencari/membuat perangkat berdasarkan nomor seri */
  device_category?: string;
  device_brand?: string;
  device_model?: string;
  device_serial?: string;
  initial_estimate_cost?: number | null;
}

export async function loginRequest(email: string, password: string, slug: string) {
  const { data } = await apiClient.post<LoginResult>('/auth/login', { email, password, slug });
  return data;
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
  exception_status?: 'closed' | 'limited' | null;
  exception_title?: string | null;
}

export interface PublicCapacityResult {
  branch: { id: string; name: string };
  slots: PublicCapacitySlot[];
  today: { capacity: number; booked_count: number } | null;
  average_turnaround_days: number;
  on_time_rate: number | null;
}

export async function getPublicCapacity(slug: string, month: string) {
  const { data } = await apiClient.get<{ data: PublicCapacityResult }>('/public/capacity', { params: { slug, month } });
  return data.data;
}

export async function getPayments(params?: Record<string, string>) {
  const { data } = await apiClient.get<{ data: any[] }>('/payments', { params });
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

export async function getInventoryParts(status = 'active') {
  const { data } = await apiClient.get<{ data: any[] }>('/inventory/parts', { params: { status } });
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
  complaint: string;
  service_method: string;
  estimated_done_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  serial_number?: string | null;
  device_label?: string | null;
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

export interface TechnicianWorkload {
  id: string;
  name: string;
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
  status: 'unpaid' | 'partial' | 'paid';
  subtotal: number;
  pickup_fee: number | string;
  additional_cost: number | string;
  discount: number | string;
  total: number;
  ticket_code?: string | null;
  tracking_code?: string | null;
  current_status?: string | null;
  customer_name?: string | null;
  [key: string]: unknown;
}

export async function getInvoices() {
  const { data } = await apiClient.get<{ data: InvoiceRow[] }>('/invoices');
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

export async function updateStaff(id: string, payload: { name?: string; email?: string; phone?: string | null; role?: string; branch_id?: string | null; is_active?: boolean }) {
  const { data } = await apiClient.put<{ data: any }>(`/staff/${encodeURIComponent(id)}`, payload);
  return data.data;
}

export async function createStaff(payload: { name: string; email: string; password: string; role: string; branch_id?: string | null }) {
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
  input: { type: string; brand: string; model: string; serial_number?: string }
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

export async function createTicket(payload: CreateTicketPayload) {
  const { data } = await apiClient.post<{ data: any }>('/tickets', payload);
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
