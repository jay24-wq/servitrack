/**
 * Kode tiket kanonik: `SRV` + 10 digit acak (tanpa pemisah).
 * Memakai Web Crypto supaya kode tidak bisa ditebak — kode dipublikasikan ke pelanggan untuk tracking.
 */
export function generateTicketCode(): string {
  return `SRV${randomDigits(10)}`;
}

export function generateTrackingToken(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function generateBookingCode(): string {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `BK-${dateStr}-${randomDigits(4)}`;
}

export function randomDigits(length: number): string {
  const digits: string[] = [];
  const buffer = new Uint8Array(length);
  while (digits.length < length) {
    globalThis.crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (digits.length >= length) break;
      if (byte < 250) digits.push(String(byte % 10));
    }
  }
  return digits.join('');
}

/** Nomor nota memakai 10 digit yang sama dengan tiketnya (jejak 1:1). */
export function invoiceFromTicket(ticketCode: string): string {
  return `INV${ticketCode.replace(/^SRV/, '')}`;
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('0')) {
    return `+62${phone.substring(1)}`;
  }
  if (!phone.startsWith('+62')) {
    return `+62${phone}`;
  }
  return phone;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}
