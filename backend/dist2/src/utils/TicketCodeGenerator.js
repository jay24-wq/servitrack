import { generateTicketCode as generateCanonicalTicketCode } from './code';
/**
 * Tanda tangan lama dipertahankan (tenant + date) agar pemanggil lama tidak rusak,
 * tetapi formatnya kini mengikuti generator kanonik: `SRV` + 10 digit acak.
 */
export function generateTicketCode(_tenantId, _date) {
    return generateCanonicalTicketCode();
}
//# sourceMappingURL=TicketCodeGenerator.js.map