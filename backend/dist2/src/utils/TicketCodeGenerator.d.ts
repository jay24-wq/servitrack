/**
 * Tanda tangan lama dipertahankan (tenant + date) agar pemanggil lama tidak rusak,
 * tetapi formatnya kini mengikuti generator kanonik: `SRV` + 10 digit acak.
 */
export declare function generateTicketCode(_tenantId: string, _date: Date): string;
//# sourceMappingURL=TicketCodeGenerator.d.ts.map