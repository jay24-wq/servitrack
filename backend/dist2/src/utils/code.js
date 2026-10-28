import crypto from 'crypto';
/** Kode tiket kanonik: `SRV` + 10 digit acak (tanpa pemisah). */
export function generateTicketCode() {
    const digits = [];
    while (digits.length < 10) {
        for (const byte of crypto.randomBytes(16)) {
            if (digits.length >= 10)
                break;
            if (byte < 250)
                digits.push(String(byte % 10));
        }
    }
    return `SRV${digits.join('')}`;
}
export function generateTrackingToken() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
}
export function generateBookingCode() {
    return 'BK-' + crypto.randomBytes(3).toString('hex').toUpperCase().padEnd(6, '0').slice(0, 6);
}
/** Nomor nota memakai 10 digit yang sama dengan tiketnya (jejak 1:1). */
export function invoiceFromTicket(ticketCode) {
    return `INV${ticketCode.replace(/^SRV/, '')}`;
}
//# sourceMappingURL=code.js.map