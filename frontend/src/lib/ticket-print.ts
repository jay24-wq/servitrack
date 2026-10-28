import QRCode from 'qrcode';
import type { InvoiceRow } from './api';
import { invoiceFromTicket } from './ticket-code';

export interface PrintableTicket {
  id: string;
  ticket_code: string;
  tracking_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_label?: string | null;
  complaint?: string | null;
  technician_name?: string | null;
  uiStatus?: string | null;
  current_status?: string | null;
  service_method?: string | null;
  estimated_done_at?: string | null;
  final_cost?: number | null;
  created_at?: string | null;
}

const STATUS_MESSAGES: Record<string, string> = {
  Antrian: 'unit sudah kami terima dan saat ini sedang menunggu antrean pengerjaan',
  Pengecekan: 'unit sedang dalam proses pemeriksaan oleh teknisi kami',
  Pengerjaan: 'unit sedang dikerjakan oleh teknisi kami',
  'Menunggu Part': 'pengerjaan sedang menunggu ketersediaan spare part',
  'Quality Control': 'unit sedang melalui tahap quality control',
  Selesai: 'unit sudah selesai dan siap diambil atau dikirim kembali',
};

const SERVICE_METHOD_LABEL: Record<string, string> = {
  dropoff: 'Drop-off',
  pickup_only: 'Pick-up',
  pickup_delivery: 'Antar-Jemput',
  antar_jemput: 'Antar-Jemput',
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export function normalizeWhatsAppNumber(phone?: string | null) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export function getTrackingUrl(ticket: PrintableTicket) {
  const code = ticket.tracking_code || ticket.ticket_code;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/tracking?resi=${encodeURIComponent(code)}`;
}

export function buildServiceStatusMessage(ticket: PrintableTicket) {
  const firstName = ticket.customer_name?.trim().split(/\s+/)[0] || 'Kak';
  const status = ticket.uiStatus || ticket.current_status || 'Antrian';
  const summary = STATUS_MESSAGES[status] ?? 'sedang kami proses';
  const trackingUrl = getTrackingUrl(ticket);
  const device = ticket.device_label ? ` untuk unit ${ticket.device_label}` : '';

  return [
    `Halo ${firstName}, kami dari ServiTrack.`,
    `Tiket servis ${ticket.ticket_code}${device} ${summary}.`,
    `Pantau progres terbaru di: ${trackingUrl}`,
    'Terima kasih.',
  ].join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function printWindow(title: string, body: string, options?: { width?: number; height?: number }) {
  const win = window.open('', '_blank', `width=${options?.width ?? 440},height=${options?.height ?? 680}`);
  if (!win) return null;

  win.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: #171717; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 12px; line-height: 1.5; }
    h1 { margin: 0; font-size: 18px; letter-spacing: -0.02em; }
    h2 { margin: 4px 0 20px; color: #57534e; font-size: 12px; font-weight: 600; }
    .brand { color: #0369a1; }
    .muted { color: #78716c; }
    .divider { margin: 16px 0; border-top: 1px dashed #d6d3d1; }
    .row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
    .row > span:last-child { text-align: right; font-weight: 600; }
    .label { color: #78716c; }
    .box { margin-top: 12px; padding: 12px; border-radius: 8px; background: #f5f5f4; }
    .qr { display: block; width: 220px; height: 220px; margin: 12px auto; }
    .code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-weight: 700; }
    .center { text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${body}</body>
</html>`);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 150);
  return win;
}

function ticketHeader(ticket: PrintableTicket) {
  return `
    <h1>ServiTrack <span class="brand">Service Center</span></h1>
    <h2>${escapeHtml(ticket.ticket_code)}</h2>
  `;
}

export async function printTrackingQr(ticket: PrintableTicket) {
  const trackingUrl = getTrackingUrl(ticket);
  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    width: 440,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return printWindow(
    `QR Tracking ${ticket.ticket_code}`,
    `${ticketHeader(ticket)}
    <div class="center">
      <p class="muted">Scan untuk melihat status servis</p>
      <img class="qr" src="${qrDataUrl}" alt="QR tracking ${escapeHtml(ticket.ticket_code)}" />
      <p class="code">${escapeHtml(ticket.tracking_code || ticket.ticket_code)}</p>
      <p class="muted">${escapeHtml(trackingUrl)}</p>
    </div>`,
    { width: 400, height: 560 }
  );
}

export function printReceipt(ticket: PrintableTicket) {
  return printWindow(
    `Tanda Terima ${ticket.ticket_code}`,
    `${ticketHeader(ticket)}
    <div class="row"><span class="label">Pelanggan</span><span>${escapeHtml(ticket.customer_name || '—')}</span></div>
    <div class="row"><span class="label">WhatsApp</span><span>${escapeHtml(ticket.customer_phone || '—')}</span></div>
    <div class="row"><span class="label">Perangkat</span><span>${escapeHtml(ticket.device_label || '—')}</span></div>
    <div class="row"><span class="label">Layanan</span><span>${escapeHtml(SERVICE_METHOD_LABEL[ticket.service_method || ''] || ticket.service_method || '—')}</span></div>
    <div class="row"><span class="label">Teknisi</span><span>${escapeHtml(ticket.technician_name || 'Belum ditugaskan')}</span></div>
    <div class="row"><span class="label">Diterima</span><span>${escapeHtml(formatDate(ticket.created_at))}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Keluhan</span><span>${escapeHtml(ticket.complaint || '—')}</span></div>
    <div class="row"><span class="label">Status</span><span>${escapeHtml(ticket.uiStatus || ticket.current_status || '—')}</span></div>
    <div class="row"><span class="label">Estimasi selesai</span><span>${escapeHtml(formatDate(ticket.estimated_done_at))}</span></div>
    <div class="box">
      <div class="row"><span class="label">Kode tracking</span><span class="code">${escapeHtml(ticket.tracking_code || ticket.ticket_code)}</span></div>
      <div class="row"><span class="label">Simpan tanda terima ini</span><span>Terima kasih</span></div>
    </div>`
  );
}

export function printInvoice(ticket: PrintableTicket, invoice?: InvoiceRow | null) {
  const invoiceNo = invoice?.invoice_no ?? invoiceFromTicket(ticket.ticket_code);
  const subtotal = Number(invoice?.subtotal ?? ticket.final_cost ?? 0);
  const pickupFee = Number(invoice?.pickup_fee ?? 0);
  const additionalCost = Number(invoice?.additional_cost ?? 0);
  const discount = Number(invoice?.discount ?? 0);
  const total = Number(invoice?.total ?? subtotal + pickupFee + additionalCost - discount);

  return printWindow(
    `Invoice ${invoiceNo}`,
    `${ticketHeader(ticket)}
    <div class="row"><span class="label">No. invoice</span><span class="code">${escapeHtml(invoiceNo)}</span></div>
    <div class="row"><span class="label">Pelanggan</span><span>${escapeHtml(ticket.customer_name || invoice?.customer_name || '—')}</span></div>
    <div class="row"><span class="label">Perangkat</span><span>${escapeHtml(ticket.device_label || '—')}</span></div>
    <div class="row"><span class="label">Status bayar</span><span>${escapeHtml(invoice?.status ?? 'Belum ada invoice')}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Subtotal jasa & part</span><span>${escapeHtml(formatCurrency(subtotal))}</span></div>
    <div class="row"><span class="label">Ongkir pickup</span><span>${escapeHtml(formatCurrency(pickupFee))}</span></div>
    <div class="row"><span class="label">Biaya tambahan</span><span>${escapeHtml(formatCurrency(additionalCost))}</span></div>
    <div class="row"><span class="label">Diskon</span><span>-${escapeHtml(formatCurrency(discount))}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label"><strong>Total</strong></span><span>${escapeHtml(formatCurrency(total))}</span></div>
    <div class="box center">
      <span class="muted">Invoice ini dibuat dari data tiket ${escapeHtml(ticket.ticket_code)}.</span>
    </div>`
  );
}
