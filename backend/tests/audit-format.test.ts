import { describe, expect, it } from 'vitest';
import {
  formatAuditFields,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditObjectLabel,
} from '../../frontend/src/lib/audit-format';

describe('business-friendly audit formatting', () => {
  it('maps stored actions and database entities to business language', () => {
    expect(getAuditActionLabel({ action: 'ticket.created', entityType: 'service_ticket' })).toBe('Tiket Servis Dibuat');
    expect(getAuditActionLabel({ action: 'inventory.stock.updated', entityType: 'inventory' })).toBe('Stok Sparepart Diperbarui');
    expect(getAuditEntityLabel('service_ticket')).toBe('Tiket Servis');
  });

  it('describes staff role changes instead of showing a generic update', () => {
    expect(getAuditActionLabel({
      action: 'staff.updated',
      entityType: 'staff',
      before: { role: 'frontdesk' },
      after: { role: 'teknisi' },
    })).toBe('Role Staff Diubah');
  });

  it('formats ticket details and omits UUID fields', () => {
    const entry = {
      action: 'ticket.created',
      entityType: 'service_ticket',
      after: {
        ticket_code: 'SRV0562313398',
        customer_name: 'Yesking',
        device_label: 'Laptop Asus',
        current_status: 'antrian',
        ticket_id: '9ef67d80-1234-4567-890a-123456789abc',
      },
    };

    expect(getAuditObjectLabel(entry)).toBe('No Tiket SRV0562313398');
    expect(formatAuditFields(entry.after)).toEqual([
      { label: 'No Tiket', value: 'SRV0562313398' },
      { label: 'Pelanggan', value: 'Yesking' },
      { label: 'Perangkat', value: 'Laptop Asus' },
      { label: 'Status Servis', value: 'Antrian' },
    ]);
  });

  it('renders operating hours as readable text rather than JSON', () => {
    expect(formatAuditFields({ operating_hours: [{ weekday: 1, is_open: true, open_time: '08:30', close_time: '17:30' }] })).toEqual([
      { label: 'Jam Operasional', value: 'Senin: 08:30–17:30' },
    ]);
  });
});
