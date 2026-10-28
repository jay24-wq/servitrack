export interface Ticket {
  id: string;
  tenant_id: string;
  branch_id?: string;
  customer_id: string;
  device_id: string;
  booking_id?: string;
  status: TicketStatus;
  status_label: string;
  serial_number?: string;
  warranty_expired: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export type TicketStatus = 
  | 'ANTRIAN'
  | 'PENGECEKAN'
  | 'MENUNGGU_PART'
  | 'PENGGERJAAN'
  | 'QUALITY_CHECK'
  | 'SELESAI'
  | 'SIAP_DIAMBIL';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string;
  phone?: string;
  role: UserRole;
  active: boolean;
  last_login?: string;
  created_at: string;
}

export type UserRole = 'ADMIN' | 'FRONTDESK' | 'TEKNIKI' | 'KURIR';

export interface Quotation {
  id: string;
  tenant_id: string;
  ticket_id: string;
  customer_id: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: QuotationStatus;
  approved_at?: string;
  rejected_at?: string;
  created_at: string;
  expires_at: string;
}

export type QuotationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface QuotationItem {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Plan {
  id: string;
  name: PlanName;
  price: number;
  features: PlanFeature[];
  limits: PlanLimit;
}

export type PlanName = 'STARTER' | 'PRO' | 'ADVANCE';

export interface PlanFeature {
  name: string;
  enabled: boolean;
}

export interface PlanLimit {
  max_users?: number;
  max_tickets_per_month?: number;
  max_branches?: number;
}

export interface Payment {
  id: string;
  tenant_id: string;
  ticket_id: string;
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string;
  paid_at?: string;
  created_at: string;
}

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'VIRTUAL_ACCOUNT' | 'EWALLET';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';

export interface Booking {
  id: string;
  tenant_id: string;
  slot_date: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_model: string;
  complaint: string;
  status: BookingStatus;
  code: string;
  tracking_token: string;
  created_at: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Inventory {
  id: string;
  tenant_id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  min_stock: number;
  unit_price: number;
  supplier?: string;
}

export interface ServiceTicket {
  id: string;
  ticket_code: string;
  current_status: string;
  complaint: string;
  service_method: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  device_label?: string;
  technician_name?: string;
  technician_initials?: string;
  estimated_done_at?: string | null;
  final_cost?: number | null;
}