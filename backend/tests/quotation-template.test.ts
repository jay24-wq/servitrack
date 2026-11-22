import { describe, expect, it } from 'vitest';
import { renderWhatsAppTemplate } from '../src/services/notifications/templates';

describe('quotation WhatsApp content', () => {
  it('uses the same Hasil Pemeriksaan Teknisi field label and value', () => {
    const message = renderWhatsAppTemplate('quotation_created', {
      trackingCode: 'TKT5560039009',
      ticketCode: 'SRV123',
      complaint: 'Mati total',
      diagnosis: 'IC charging rusak; ada korosi',
      items: [{
        item_type: 'part', part_name_snapshot: 'IC charging', qty: 1,
        part_cost: 250_000, labor_cost: 104_000, subtotal: 354_000,
        availability_status: 'TIDAK_TERSEDIA', estimated_part_arrival_days: 5,
      }],
      quotationNumber: 'QUO-123',
      totalAmount: 100_000,
      expiresAt: '2026-11-22T03:02:00Z',
      approvalLink: 'https://example.invalid/approval/token',
    });
    expect(message).toContain('*Hasil Pemeriksaan Teknisi:*\nIC charging rusak; ada korosi');
    expect(message).toContain('• *Nomor Resi:* TKT5560039009');
    expect(message).toContain('Part Rp 250.000 + jasa Rp 104.000 = Rp 354.000');
    expect(message).toContain('Perlu dipesan (estimasi 5 hari)');
    expect(message).not.toContain('TIDAK_TERSEDIA');
    expect(message).not.toContain('Catatan teknisi');
    expect(message).not.toContain('Hasil Diagnosa');
  });
});
