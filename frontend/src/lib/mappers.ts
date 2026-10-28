import type { HandoverMethod } from '../store';
import type { QueueStatus, QueueTicket } from '../store/ticketStore';
import type { BookingSlot, ActiveTicket } from '../data/frontdesk';
import { formatBookingSchedule, formatPickupTime } from './booking-schedule';

/** Map DB current_status values → UI Status labels */
export const DB_STATUS_MAP: Record<string, QueueStatus> = {
  antrian: 'Antrian',
  pengecekan: 'Pengecekan',
  pengerjaan: 'Pengerjaan',
  menunggu_part: 'Menunggu Part',
  quality_check: 'Quality Control',
  selesai: 'Selesai',
  siap_diambil: 'Selesai',
};

/** Reverse map: label UI → nilai current_status di DB (untuk PUT status dari kanban) */
export const STATUS_TO_DB: Record<QueueStatus, string> = {
  Antrian: 'antrian',
  Pengecekan: 'pengecekan',
  Pengerjaan: 'pengerjaan',
  'Menunggu Part': 'menunggu_part',
  'Quality Control': 'quality_check',
  Selesai: 'selesai',
};

const METHOD_LABEL: Record<string, HandoverMethod> = {
  dropoff: 'mandiri',
  terjadwal: 'terjadwal',
  pickup_only: 'terjadwal',
  antar_jemput: 'antar_jemput',
  pickup_delivery: 'antar_jemput',
  mandiri: 'mandiri',
};

export function mapServiceMethod(value?: string | null): HandoverMethod {
  return METHOD_LABEL[value ?? ''] ?? 'mandiri';
}

const METHOD_HANDOVER: Record<HandoverMethod, 'Drop-off' | 'Pick-up' | 'Antar-Jemput'> = {
  mandiri: 'Drop-off',
  terjadwal: 'Pick-up',
  antar_jemput: 'Antar-Jemput',
};

function formatTanggal(value?: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', options);
}

function digits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

function relatif(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const menit = Math.round((Date.now() - date.getTime()) / 60000);
  if (menit < 1) return 'Baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return formatTanggal(value, { dateStyle: 'short', timeStyle: 'short' });
}

export interface ServiceTicketRow {
  id?: string;
  ticket_code: string;
  current_status: string;
  complaint: string;
  service_method: string;
  created_at: string;
  tracking_code?: string | null;
  estimated_done_at?: string | null;
  completed_at?: string | null;
  serial_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_label?: string | null;
  technician_name?: string | null;
  technician_initials?: string | null;
  [key: string]: unknown;
}

const SLA_DEFAULT_MENIT = 120;

export function mapServiceTicketToQueueTicket(t: ServiceTicketRow): QueueTicket {
  const status = DB_STATUS_MAP[t.current_status] ?? 'Antrian';
  const dibuat = new Date(t.created_at);
  const batas = t.estimated_done_at ? new Date(t.estimated_done_at) : new Date(dibuat.getTime() + SLA_DEFAULT_MENIT * 60_000);
  const lewat = !Number.isNaN(dibuat.getTime()) && Date.now() > batas.getTime() && status !== 'Selesai';

  return {
    id: t.ticket_code,
    time: formatTanggal(t.created_at),
    customer: t.customer_name ?? '—',
    phone: digits(t.customer_phone),
    handover: METHOD_HANDOVER[mapServiceMethod(t.service_method)],
    device: t.device_label ?? '—',
    diagnosis: t.complaint ?? '',
    technician: t.technician_name ?? 'Belum ditugaskan',
    technicianInitials: t.technician_initials ?? '?',
    status,
    serial: t.serial_number ?? undefined,
    slaPrimary: t.estimated_done_at
      ? `SLA: ${formatTanggal(t.estimated_done_at, { dateStyle: 'short', timeStyle: 'short' })}`
      : 'SLA: Belum ditentukan',
    slaSecondary: t.estimated_done_at
      ? `Batas SLA: ${formatTanggal(t.estimated_done_at, { dateStyle: 'short', timeStyle: 'short' })} WIB`
      : 'Batas SLA belum ditentukan',
    slaTone: lewat ? 'text-rose-600' : 'text-amber-500',
  };
}

export interface BookingApiRow {
  id: string;
  booking_code?: string | null;
  tracking_code?: string | null;
  queue_number?: string | null;
  slot_date?: string | null;
  created_at?: string | null;
  customer_name?: string | null;
  phone_wa?: string | null;
  service_method?: string | null;
  complaint?: string | null;
  device_id?: string | null;
  device_category?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  device_serial?: string | null;
  status?: string | null;
  branch_id?: string | null;
  customer_id?: string | null;
  pickup_time?: string | null;
  pickup_area?: string | null;
  pickup_fee?: number | string | null;
  [key: string]: any;
}

export type DeviceCategory = 'laptop' | 'smartphone' | 'console' | 'workstation';

export interface BookingDevice {
  /** "Merk & model" gabungan, mis. "Apple iPhone 13" */
  model: string;
  brand: string;
  category: DeviceCategory;
  /** Nilai kategori mentah dari DB (untuk kasus yang tidak ada di daftar tile) */
  rawCategory: string;
  serial: string;
  symptoms: string[];
}

export interface BookingRow {
  id: string;
  code: string;
  trackingCode: string | null;
  queueNumber: string | null;
  createdAt: string;
  slotDate: string;
  pickupFee: number;
  name: string;
  whatsapp: string;
  method: HandoverMethod;
  device?: BookingDevice;
  /** Kronologi keluhan pelanggan (tanpa segmen "Gejala:") */
  complaint: string;
  status: 'MENUNGGU_CHECKIN' | 'CHECKED_IN' | 'DIBATALKAN';
  raw: BookingApiRow;
}

const DEVICE_CATEGORY_ALIASES: Record<string, DeviceCategory> = {
  laptop: 'laptop',
  notebook: 'laptop',
  netbook: 'laptop',
  ultrabook: 'laptop',
  smartphone: 'smartphone',
  hp: 'smartphone',
  tablet: 'smartphone',
  ipad: 'smartphone',
  smartwatch: 'smartphone',
  console: 'console',
  game: 'console',
  konsol: 'console',
  playstation: 'console',
  xbox: 'console',
  nintendo: 'console',
  workstation: 'workstation',
  pc: 'workstation',
  desktop: 'workstation',
  komputer: 'workstation',
  'pc / build': 'workstation',
};

const GEJALA_TOKENS = ['overheat', 'mati_total', 'layar', 'baterai', 'air'];

/** Nilai kategori di DB (varchar bebas) → kategori yang punya tile di form TicketInputPage. */
export function mapDeviceCategory(value?: string | null): DeviceCategory {
  return DEVICE_CATEGORY_ALIASES[(value ?? '').trim().toLowerCase()] ?? 'laptop';
}

/** Gabungkan brand + model tanpa menduplikasi brand yang sudah ada di model. */
export function deviceLabel(brand?: string | null, model?: string | null): string {
  const b = (brand ?? '').trim();
  const m = (model ?? '').trim();
  if (!m) return b;
  if (!b) return m;
  return m.toLowerCase().startsWith(b.toLowerCase()) ? m : `${b} ${m}`;
}

/** Ambil token gejala dari segmen "Gejala: overheat, air" di field complaint. */
export function parseGejala(complaint?: string | null): string[] {
  if (!complaint) return [];
  const segmen = complaint
    .split('|')
    .map((part) => part.trim())
    .find((part) => /^gejala\s*:/i.test(part));
  if (!segmen) return [];
  return segmen
    .replace(/^gejala\s*:\s*/i, '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => GEJALA_TOKENS.includes(token));
}

/** Kronologi = bagian complaint selain segmen "Gejala:". */
export function complaintText(complaint?: string | null): string {
  if (!complaint) return '';
  return complaint
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part && !/^gejala\s*:/i.test(part))
    .join(' | ');
}

function bookingStatus(status?: string | null): BookingRow['status'] {
  if (status === 'arrived' || status === 'CHECKED_IN' || status === 'completed') return 'CHECKED_IN';
  if (status === 'cancelled' || status === 'no_show') return 'DIBATALKAN';
  return 'MENUNGGU_CHECKIN';
}

function mapBookingDevice(b: BookingApiRow): BookingDevice | undefined {
  const brand = (b.device_brand ?? '').trim();
  const model = (b.device_model ?? '').trim();
  const category = (b.device_category ?? '').trim();
  const serial = (b.device_serial ?? '').trim();
  if (!brand && !model && !category && !serial) return undefined;
  return {
    model: deviceLabel(brand, model),
    brand,
    category: mapDeviceCategory(category),
    rawCategory: category,
    serial,
    symptoms: parseGejala(b.complaint),
  };
}

export function mapBookingRow(b: BookingApiRow): BookingRow {
  return {
    id: b.id,
    code: b.booking_code ?? b.id,
    trackingCode: b.tracking_code ?? null,
    queueNumber: b.queue_number ?? null,
    createdAt: formatTanggal(b.created_at),
    slotDate: formatBookingSchedule(b.slot_date, b.pickup_time, b.service_method),
    pickupFee: Number(b.pickup_fee ?? 0),
    name: b.customer_name ?? 'Pelanggan',
    whatsapp: b.phone_wa ?? '',
    method: mapServiceMethod(b.service_method),
    device: mapBookingDevice(b),
    complaint: complaintText(b.complaint),
    status: bookingStatus(b.status),
    raw: b,
  };
}

function frontdeskMethod(value?: string | null): BookingSlot['method'] {
  if (value === 'pickup_delivery' || value === 'antar_jemput') return 'Pickup-Delivery';
  if (value === 'pickup_only' || value === 'terjadwal') return 'Pickup';
  return 'Dropoff';
}

function frontdeskStatus(status?: string | null): BookingSlot['status'] {
  if (status === 'arrived' || status === 'CHECKED_IN' || status === 'completed') return 'Checked-in';
  if (status === 'cancelled') return 'Batal';
  if (status === 'no_show') return 'No-Show';
  return 'Menunggu';
}

export function mapBookingToFrontdesk(b: BookingApiRow): BookingSlot {
  const phoneDisplay = b.phone_wa ?? '—';
  return {
    id: b.id,
    time:
      (b.pickup_time && formatPickupTime(b.pickup_time)) ||
      (b.created_at ? new Date(b.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '09:00'),
    code: b.booking_code ?? b.id ?? '-',
    customer: b.customer_name ?? 'Pelanggan',
    phone: digits(phoneDisplay),
    phoneDisplay,
    device: deviceLabel(b.device_brand, b.device_model) || 'Perangkat Servis',
    method: frontdeskMethod(b.service_method),
    status: frontdeskStatus(b.status),
  };
}

export interface BookingTicketRow extends Omit<ActiveTicket, 'status'> {
  ticketId: string;
  status: 'Menunggu Check-in' | 'Checked-in' | 'Batal';
  updated: string;
}

function trackingStatus(status?: string | null): BookingTicketRow['status'] {
  if (status === 'arrived' || status === 'CHECKED_IN' || status === 'completed') return 'Checked-in';
  if (status === 'cancelled' || status === 'no_show') return 'Batal';
  return 'Menunggu Check-in';
}

export function mapBookingToTicketRow(b: BookingApiRow): BookingTicketRow {
  const phoneDisplay = b.phone_wa ?? '—';
  return {
    ticketId: b.booking_code ?? b.id ?? '-',
    customer: b.customer_name ?? 'Pelanggan',
    phone: digits(phoneDisplay),
    phoneDisplay,
    device: deviceLabel(b.device_brand, b.device_model) || 'Perangkat Servis',
    status: trackingStatus(b.status),
    updated: relatif(b.slot_date && new Date(b.slot_date) > new Date() ? undefined : b.created_at ?? b.slot_date),
  };
}
