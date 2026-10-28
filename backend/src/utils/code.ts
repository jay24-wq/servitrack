import crypto from 'crypto';

/** 10 digit acak yang aman dipakai sebagai identifier publik. */
export function randomDigits(length: number): string {
  const digits: string[] = [];
  while (digits.length < length) {
    for (const byte of crypto.randomBytes(16)) {
      if (digits.length >= length) break;
      if (byte < 250) digits.push(String(byte % 10));
    }
  }
  return digits.join('');
}

/** Kode tiket internal: `SRV` + 10 digit acak (tanpa pemisah). */
export function generateTicketCode(): string {
  return `SRV${randomDigits(10)}`;
}

/**
 * Nomor resi customer: `SRV` + 10 digit acak.
 * Dibuat sekali saat booking dan tidak berubah sampai servis selesai.
 */
export function generateTrackingCode(): string {
  return `SRV${randomDigits(10)}`;
}

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

export function generateBookingCode(): string {
  return 'BK-' + crypto.randomBytes(3).toString('hex').toUpperCase().padEnd(6, '0').slice(0, 6);
}

/** Nomor nota memakai 10 digit yang sama dengan tiketnya (jejak 1:1). */
export function invoiceFromTicket(ticketCode: string): string {
  return `INV${ticketCode.replace(/^SRV/, '')}`;
}
