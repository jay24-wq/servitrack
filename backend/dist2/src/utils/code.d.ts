/** Kode tiket kanonik: `SRV` + 10 digit acak (tanpa pemisah). */
export declare function generateTicketCode(): string;
export declare function generateTrackingToken(): string;
export declare function generateBookingCode(): string;
/** Nomor nota memakai 10 digit yang sama dengan tiketnya (jejak 1:1). */
export declare function invoiceFromTicket(ticketCode: string): string;
//# sourceMappingURL=code.d.ts.map