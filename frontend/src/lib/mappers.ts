import type { HandoverMethod } from '../store';
import type { QueueStatus, QueueTicket } from '../store/ticketStore';
import type { BookingSlot, ActiveTicket } from '../data/frontdesk';
import { formatBookingSchedule, formatPickupTime } from './booking-schedule';
import { getDeviceDisplayName } from '../../../common/utils/device';

export { getDeviceDisplayName } from '../../../common/utils/device';

/** Map DB current_status values → UI Status labels */
export const DB_STATUS_MAP: Record<string, QueueStatus> = {
  antrian: 'Antrian',
  pengecekan: 'Pengecekan',
  pengerjaan: 'Pengerjaan',
  menunggu_part: 'Menunggu Part',
  menunggu_persetujuan: 'Menunggu Persetujuan',
  quality_check: 'Quality Control',
  selesai: 'Selesai',
  siap_diambil: 'Siap Diambil',
  batal: 'Dibatalkan',
};

/** Reverse map: label UI → nilai current_status di DB (untuk PUT status dari kanban) */
export const STATUS_TO_DB: Record<QueueStatus, string> = {
  Antrian: 'antrian',
  Pengecekan: 'pengecekan',
  Pengerjaan: 'pengerjaan',
  'Menunggu Part': 'menunggu_part',
  'Menunggu Persetujuan': 'menunggu_persetujuan',
  'Quality Control': 'quality_check',
  Selesai: 'selesai',
  'Siap Diambil': 'siap_diambil',
  Dibatalkan: 'batal',
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
  device_pin?: string | null;
  device_pin_refused?: boolean;
  work_type?: 'without_parts' | 'with_parts' | null;
  diagnosis_status?: 'matches_complaint' | 'additional_damage' | null;
  technician_diagnosis?: string | null;
  additional_damage?: string | null;
  requested_part_id?: string | null;
  requested_part_qty?: number | string | null;
  part_shortages?: Array<{
    part_id: string; part_name: string; required_qty: number; available_qty: number; shortage_qty: number;
    part_request_id?: string | null; part_request_status?: string; estimated_arrival_days?: number | null;
  }> | null;
  complaint: string;
  service_method: string;
  created_at: string;
  tracking_code?: string | null;
  estimated_done_at?: string | null;
  completed_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_model?: string | null;
  technician_name?: string | null;
  technician_initials?: string | null;
  [key: string]: unknown;
}

const SLA_DEFAULT_MENIT = 120;

export function mapServiceTicketToQueueTicket(t: ServiceTicketRow): QueueTicket {
  const status = DB_STATUS_MAP[t.current_status] ?? 'Antrian';
  const dibuat = new Date(t.created_at);
  const batas = t.estimated_done_at ? new Date(t.estimated_done_at) : new Date(dibuat.getTime() + SLA_DEFAULT_MENIT * 60_000);
  const lewat = !Number.isNaN(dibuat.getTime()) && Date.now() > batas.getTime() && status !== 'Selesai' && status !== 'Siap Diambil';

  return {
    id: t.ticket_code,
    recordId: t.id,
    time: formatTanggal(t.created_at),
    customer: t.customer_name ?? '—',
    phone: digits(t.customer_phone),
    handover: METHOD_HANDOVER[mapServiceMethod(t.service_method)],
    device: getDeviceDisplayName(t.device_model),
    devicePin: t.device_pin ?? null,
    pinRefused: Boolean(t.device_pin_refused),
    workType: t.work_type ?? null,
    diagnosisStatus: t.diagnosis_status ?? null,
    technicianDiagnosis: t.technician_diagnosis ?? null,
    additionalDamage: t.additional_damage ?? null,
    requestedPartId: t.requested_part_id ?? null,
    requestedPartQty: t.requested_part_qty === null || t.requested_part_qty === undefined ? null : Number(t.requested_part_qty),
    partShortages: t.part_shortages ?? [],
    diagnosis: t.complaint ?? '',
    technician: t.technician_name ?? 'Belum ditugaskan',
    technicianInitials: t.technician_initials ?? '?',
    status,
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
  device_model?: string | null;
  device_pin?: string | null;
  device_pin_refused?: boolean | null;
  status?: string | null;
  branch_id?: string | null;
  customer_id?: string | null;
  pickup_time?: string | null;
  pickup_area?: string | null;
  pickup_fee?: number | string | null;
  courier_pickup_status?: string | null;
  [key: string]: any;
}

export type DeviceCategory = 'laptop' | 'smartphone' | 'console' | 'workstation';

export interface BookingDevice {
  /** Nama lengkap perangkat yang disimpan pengguna. */
  model: string;
  category: DeviceCategory;
  /** Nilai kategori mentah dari DB (untuk kasus yang tidak ada di daftar tile) */
  rawCategory: string;
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
  courierPickupStatus: string | null;
  devicePin: string | null;
  pinRefused: boolean;
  raw: BookingApiRow;
}

export function canCheckInBooking(booking: Pick<BookingRow, 'status' | 'method' | 'courierPickupStatus'>) {
  if (booking.status !== 'MENUNGGU_CHECKIN') return false;
  if (booking.method === 'mandiri') return true;
  return ['PERANGKAT_TIBA_DI_WORKSHOP', 'SELESAI'].includes(booking.courierPickupStatus ?? '');
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
  const category = (b.device_category ?? '').trim();
  if (b.device_model == null && !category) return undefined;
  return {
    model: b.device_model ?? '',
    category: mapDeviceCategory(category),
    rawCategory: category,
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
    courierPickupStatus: b.courier_pickup_status ?? null,
    devicePin: b.device_pin ?? null,
    pinRefused: Boolean(b.device_pin_refused),
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
    device: getDeviceDisplayName(b.device_model),
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
    device: getDeviceDisplayName(b.device_model),
    status: trackingStatus(b.status),
    updated: relatif(b.slot_date && new Date(b.slot_date) > new Date() ? undefined : b.created_at ?? b.slot_date),
  };
}
