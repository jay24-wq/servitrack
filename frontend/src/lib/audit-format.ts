export interface AuditDisplayRecord {
  action: string;
  entityType: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditField {
  label: string;
  value: string;
}

const ACTION_LABELS: Record<string, string> = {
  'ticket.created': 'Tiket Servis Dibuat',
  'ticket.updated': 'Data Servis Diperbarui',
  'ticket.deleted': 'Tiket Servis Dihapus',
  'ticket.status_changed': 'Status Tiket Servis Diubah',
  'ticket.assessment_recorded': 'Hasil Pemeriksaan Teknisi Dicatat',
  'ticket.inspection_result_updated_after_send': 'Hasil Pemeriksaan Teknisi Dikoreksi Setelah Quotation Terkirim',
  'quotation.created': 'Quotation Servis Dibuat',
  'ticket.closed': 'Tiket Servis Ditutup',
  'service_ticket.created': 'Tiket Servis Dibuat',
  'service_ticket.updated': 'Data Servis Diperbarui',
  'service_ticket.deleted': 'Tiket Servis Dihapus',
  'staff.created': 'Staff Baru Ditambahkan',
  'staff.updated': 'Data Staff Diperbarui',
  'staff.deleted': 'Staff Dihapus',
  'user.created': 'Staff Baru Ditambahkan',
  'user.updated': 'Data Staff Diperbarui',
  'user.deleted': 'Staff Dihapus',
  'user.role.updated': 'Role Staff Diubah',
  'staff.role.updated': 'Role Staff Diubah',
  'staff.role_updated': 'Role Staff Diubah',
  'part.created': 'Sparepart Ditambahkan',
  'part.updated': 'Data Sparepart Diperbarui',
  'part.deleted': 'Sparepart Dihapus',
  'part.stock_received': 'Stok Sparepart Ditambahkan',
  'part_request.created': 'Permintaan Part Dibuat',
  'part_request.opened': 'Permintaan Part Siap Dibeli',
  'part_request.ordered': 'Permintaan Part Dipesan',
  'part_request.eta_updated': 'Estimasi Kedatangan Part Diperbarui',
  'part_request.received': 'Part Diterima',
  'part_request.linked_to_inventory': 'Part Ditautkan ke Inventory',
  'part_request.cancelled': 'Permintaan Part Dibatalkan',
  'part.used': 'Sparepart Digunakan',
  'part.usage_recorded': 'Pemakaian Sparepart Dicatat',
  'part.stock_adjusted': 'Stok Sparepart Disesuaikan',
  'part.delete_blocked': 'Sparepart Tidak Dapat Dihapus',
  'part.price.updated': 'Harga Sparepart Diperbarui',
  'inventory.created': 'Sparepart Ditambahkan',
  'inventory.updated': 'Stok Sparepart Diperbarui',
  'inventory.stock.updated': 'Stok Sparepart Diperbarui',
  'inventory.deleted': 'Sparepart Dihapus',
  'courier.assigned': 'Kurir Ditugaskan',
  'courier.reassigned': 'Kurir Dialihkan',
  'courier_assignment.status_changed': 'Status Tugas Kurir Diperbarui',
  'settings.account_updated': 'Pengaturan Akun Diperbarui',
  'settings.workshop_profile_updated': 'Profil Workshop Diperbarui',
  'settings.operational_updated': 'Pengaturan Operasional Diperbarui',
  'settings.notifications_updated': 'Pengaturan Notifikasi Diperbarui',
  'booking.created': 'Booking Baru Dibuat',
  'booking.updated': 'Data Booking Diperbarui',
  'booking.cancelled': 'Booking Dibatalkan',
  'invoice.created': 'Nota Servis Dibuat',
  'invoice.paid': 'Pembayaran Nota Dikonfirmasi',
  'invoice.voided': 'Nota Servis Dibatalkan',
  'payment.created': 'Pembayaran Dicatat',
  'payment.paid': 'Pembayaran Dikonfirmasi',
  'payment.voided': 'Pembayaran Dibatalkan',
  'notification.sent': 'Notifikasi Dikirim',
  'quotation.approved': 'Persetujuan Biaya Diterima',
  'quotation.rejected': 'Persetujuan Biaya Ditolak',
  'auth.login_failed': 'Percobaan Masuk Gagal',
  'auth.account_locked': 'Akun Dikunci',
};

const ENTITY_LABELS: Record<string, string> = {
  service_ticket: 'Tiket Servis',
  service_tickets: 'Tiket Servis',
  ticket: 'Tiket Servis',
  tiket: 'Tiket Servis',
  staff: 'Staff',
  user: 'Staff',
  part: 'Sparepart',
  parts: 'Sparepart',
  inventory: 'Sparepart',
  courier_assignment: 'Tugas Kurir',
  courier_assignments: 'Tugas Kurir',
  tenant_settings: 'Pengaturan Workshop',
  user_settings: 'Pengaturan Akun',
  booking: 'Booking',
  invoice: 'Nota Servis',
  payment: 'Pembayaran',
  quotation: 'Persetujuan Biaya',
  part_request: 'Permintaan Part',
  auth: 'Akun',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nama',
  email: 'Email',
  phone: 'Nomor WhatsApp',
  role: 'Role',
  branch_name: 'Cabang',
  address: 'Alamat Workshop',
  description: 'Deskripsi',
  ticket_code: 'No Tiket',
  booking_code: 'No Booking',
  invoice_no: 'No Nota',
  customer_name: 'Pelanggan',
  device_label: 'Perangkat',
  technician_name: 'Teknisi',
  hasil_pemeriksaan_teknisi: 'Hasil Pemeriksaan Teknisi',
  courier_name: 'Kurir',
  current_status: 'Status Servis',
  service_method: 'Metode Servis',
  status: 'Status',
  assignment_type: 'Jenis Tugas',
  method: 'Metode Pembayaran',
  sku: 'SKU',
  category: 'Kategori',
  unit: 'Satuan',
  stock_qty: 'Stok',
  min_stock: 'Batas Minimum Stok',
  cost_price: 'Harga Modal',
  sell_price: 'Harga Jual',
  unit_price: 'Harga Satuan',
  received_qty: 'Stok Masuk',
  qty: 'Jumlah Pemakaian',
  bin_location: 'Lokasi Rak',
  is_active: 'Status Akun',
  courier_status: 'Ketersediaan Kurir',
  password_changed: 'Password',
  avatar_configured: 'Foto Profil',
  avatar_changed: 'Foto Profil',
  logo_configured: 'Logo Workshop',
  logo_changed: 'Logo Workshop',
  deleted: 'Status Data',
  reason: 'Alasan',
  requested_name: 'Nama Part yang Diminta',
  estimated_price: 'Estimasi Harga Part',
  estimated_arrival_days: 'Estimasi Kedatangan (Hari)',
  actual_price: 'Harga Aktual Part',
  failure_reason: 'Alasan Gagal',
  failure_notes: 'Catatan Gagal',
  note: 'Catatan',
  tracking_prefix: 'Awalan Nomor Resi',
  default_booking_capacity: 'Kapasitas Booking Harian',
  operating_hours: 'Jam Operasional',
  event_preferences: 'Jenis Notifikasi',
  channels: 'Kanal Notifikasi',
  time_zone: 'Zona Waktu',
};

const VALUE_LABELS: Record<string, string> = {
  admin: 'Admin',
  frontdesk: 'Frontdesk',
  teknisi: 'Teknisi',
  kurir: 'Kurir',
  antrian: 'Antrian',
  pengecekan: 'Pengecekan',
  menunggu_part: 'Menunggu Sparepart',
  pengerjaan: 'Pengerjaan',
  quality_check: 'Pemeriksaan Akhir',
  selesai: 'Selesai',
  siap_diambil: 'Siap Diambil',
  dropoff: 'Antar Langsung',
  pickup_only: 'Jemput',
  pickup_delivery: 'Jemput dan Antar',
  mandiri: 'Antar Langsung',
  terjadwal: 'Jemput Terjadwal',
  antar_jemput: 'Jemput dan Antar',
  online: 'Online',
  offline: 'Offline',
  siap_diantar: 'Siap Diantar',
  menuju_toko: 'Menuju Toko',
  perangkat_tiba_di_workshop: 'Perangkat Tiba di Workshop',
  kurir_ditugaskan: 'Kurir Ditugaskan',
  pickup: 'Penjemputan',
  delivery: 'Pengantaran',
  paid: 'Lunas',
  unpaid: 'Belum Dibayar',
  partial: 'Belum lunas (data historis)',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  void: 'Dibatalkan',
  pickup_failed: 'Penjemputan Gagal',
  delivery_failed: 'Pengantaran Gagal',
  customer_not_home: 'Pelanggan Tidak di Tempat',
  customer_cancelled: 'Dibatalkan Pelanggan',
  wrong_address: 'Alamat Tidak Sesuai',
  unreachable: 'Pelanggan Tidak Dapat Dihubungi',
  other: 'Lainnya',
  menuju_lokasi: 'Menuju Lokasi',
  tiba_di_lokasi: 'Tiba di Lokasi',
  perangkat_dijemput: 'Perangkat Dijemput',
  menunggu_check_in: 'Menunggu Check-In',
  menuju_customer: 'Menuju Pelanggan',
  sampai_di_lokasi: 'Tiba di Lokasi Pelanggan',
  perangkat_diserahkan: 'Perangkat Diserahkan',
  cash: 'Tunai',
  qris: 'QRIS',
  va: 'Virtual Account',
  ewallet: 'Dompet Digital',
  'asia/jakarta': 'WIB (Jakarta)',
  'asia/makassar': 'WITA (Makassar)',
  'asia/jayapura': 'WIT (Jayapura)',
  utc: 'UTC',
};

const NOTIFICATION_LABELS: Record<string, string> = {
  booking_new: 'Booking Baru',
  booking_pickup_new: 'Booking Jemput Baru',
  booking_cancelled: 'Booking Dibatalkan',
  courier_assignment_new: 'Kurir Ditugaskan',
  courier_assignment_pending: 'Tugas Kurir Menunggu',
  pickup_today: 'Penjemputan Hari Ini',
  delivery_today: 'Pengantaran Hari Ini',
  device_ready_diagnosis: 'Perangkat Siap Diperiksa',
  device_ready_repair: 'Perangkat Siap Diperbaiki',
  device_repair_complete: 'Servis Selesai',
  booking_capacity_nearly_full: 'Kapasitas Booking Hampir Penuh',
  queue_over_capacity: 'Antrean Melebihi Kapasitas',
  subscription_expiring: 'Langganan Akan Berakhir',
  user_quota_nearly_full: 'Kuota Staff Hampir Penuh',
  branch_quota_nearly_full: 'Kuota Cabang Hampir Penuh',
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_app: 'Dalam Aplikasi',
};

const PRIVATE_OR_TECHNICAL_FIELDS = /(^id$|_id$|password_hash|data_url|latitude|longitude|ip_address|token)/i;
const DAY_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readableWords(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableValue(value: unknown, key: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') {
    if (key === 'password_changed') return value ? 'Diubah' : 'Tidak diubah';
    if (key.endsWith('_configured')) return value ? 'Tersedia' : 'Belum diatur';
    if (key.endsWith('_changed')) return value ? 'Diperbarui' : 'Tidak diubah';
    if (key === 'deleted') return value ? 'Dihapus' : 'Aktif';
    if (key === 'is_active') return value ? 'Aktif' : 'Nonaktif';
    return value ? 'Ya' : 'Tidak';
  }
  if (typeof value === 'number') {
    if (/(price|amount|total|discount)/i.test(key)) {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat('id-ID').format(value);
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return VALUE_LABELS[normalized] ?? value;
  }
  if (Array.isArray(value)) return `${value.length} data`;
  return 'Diperbarui';
}

function formatOperatingHours(value: unknown): string {
  if (!Array.isArray(value)) return 'Diperbarui';
  return value.map((item) => {
    const day = record(item);
    if (!day) return null;
    const weekday = Number(day.weekday);
    const label = DAY_LABELS[weekday] || `Hari ${weekday || ''}`.trim();
    return `${label}: ${day.is_open ? `${day.open_time ?? '—'}–${day.close_time ?? '—'}` : 'Tutup'}`;
  }).filter(Boolean).join(' · ') || 'Tidak ada jadwal';
}

function formatBooleanMap(value: unknown): string {
  const values = record(value);
  if (!values) return 'Diperbarui';
  return Object.entries(values)
    .map(([key, enabled]) => `${NOTIFICATION_LABELS[key] ?? readableWords(key)} ${enabled ? 'aktif' : 'nonaktif'}`)
    .join(' · ') || 'Tidak ada pilihan';
}

export function getAuditActionLabel(entry: AuditDisplayRecord): string {
  if (entry.action === 'staff.updated') {
    const beforeRole = record(entry.before)?.role;
    const afterRole = record(entry.after)?.role;
    if (beforeRole && afterRole && beforeRole !== afterRole) return 'Role Staff Diubah';
  }
  return ACTION_LABELS[entry.action] ?? 'Aktivitas Bengkel Diperbarui';
}

export function getAuditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? 'Data Bengkel';
}

export function getAuditObjectLabel(entry: AuditDisplayRecord): string {
  const after = record(entry.after);
  const before = record(entry.before);
  const values = [after, before].filter((value): value is Record<string, unknown> => Boolean(value));
  const ticketCode = values.find((value) => value.ticket_code)?.ticket_code;
  if (ticketCode) return `No Tiket ${ticketCode}`;
  const bookingCode = values.find((value) => value.booking_code)?.booking_code;
  if (bookingCode) return `No Booking ${bookingCode}`;
  const invoiceNo = values.find((value) => value.invoice_no)?.invoice_no;
  if (invoiceNo) return `No Nota ${invoiceNo}`;
  const sku = values.find((value) => value.sku)?.sku;
  const name = values.find((value) => value.name)?.name;
  if (sku && name) return `${name} · ${sku}`;
  if (name) return String(name);
  const courier = values.find((value) => value.courier_name)?.courier_name;
  if (courier) return `Kurir ${courier}`;
  return getAuditEntityLabel(entry.entityType);
}

export function formatAuditFields(value: unknown): AuditField[] {
  const values = record(value);
  if (!values) return [];

  return Object.entries(values).flatMap(([key, item]) => {
    if (PRIVATE_OR_TECHNICAL_FIELDS.test(key)) return [];
    if ((key.endsWith('_changed') || key.endsWith('_configured')) && item === false) return [];
    const label = FIELD_LABELS[key] ?? readableWords(key);
    if (key === 'operating_hours') return [{ label, value: formatOperatingHours(item) }];
    if (key === 'event_preferences' || key === 'channels') return [{ label, value: formatBooleanMap(item) }];
    return [{ label, value: readableValue(item, key) }];
  });
}

export function getAuditSummary(entry: AuditDisplayRecord): string {
  const values = formatAuditFields(entry.after);
  const summary = values.slice(0, 2).map(({ label, value }) => `${label}: ${value}`).join(' · ');
  return summary || getAuditObjectLabel(entry);
}
