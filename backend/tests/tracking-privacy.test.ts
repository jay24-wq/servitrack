import { describe, expect, it } from 'vitest';
import {
  formatTrackingPhone,
  presentTrackingEvents,
  presentTrackingStaff,
  projectPublicTrackingResult,
  type TrackingRawEvent,
} from '../src/services/trackingPrivacy';

describe('public tracking contact privacy', () => {
  it('formats Indonesian staff numbers internationally and masks only the middle digits', () => {
    expect(formatTrackingPhone('0877 2274 5449', 'full')).toBe('+6287722745449');
    expect(formatTrackingPhone('+62 877-2274-5449', 'masked')).toBe('+62 877-****-5449');
    expect(formatTrackingPhone('0877 2274 5449', 'hidden')).toBeNull();
    expect(formatTrackingPhone('1234', 'masked')).toBeNull();
  });

  it('keeps a name without a phone and omits an actor with no name', () => {
    expect(presentTrackingStaff({ name: '  Rina  ', phone: null }, 'masked')).toEqual({ name: 'Rina', phone: null });
    expect(presentTrackingStaff({ name: 'Rina', phone: '087722745449' }, 'hidden')).toEqual({ name: 'Rina', phone: null });
    expect(presentTrackingStaff({ name: null, phone: '087722745449' }, 'full')).toBeNull();
    expect(presentTrackingStaff(undefined, 'full')).toBeNull();
  });

  it('returns only the petugas tied to each event and strips raw actor identifiers', () => {
    const events: TrackingRawEvent[] = [
      { status: 'delivery_failed', title: 'Pengantaran gagal', note: 'Alamat tujuan tidak sesuai', source: 'courier', createdAt: '2026-11-22T10:00:00Z', staffId: 'courier-1' },
      { status: 'delivery_failed', title: 'Pengantaran gagal', note: 'Rumah di Jalan Mawar nomor 8', source: 'courier', createdAt: '2026-11-22T10:01:00Z', staffId: 'courier-1' },
      { status: 'pengerjaan', title: 'Perbaikan berlangsung', note: 'Catatan teknisi rahasia', source: 'ticket', createdAt: '2026-11-22T11:00:00Z', staffId: 'tech-1' },
    ];
    const staff = new Map([
      ['courier-1', { name: 'Rina', phone: '087722745449' }],
      ['tech-1', { name: 'Budi', phone: '081234567890' }],
      ['unrelated', { name: 'Petugas Lain', phone: '089999999999' }],
    ]);

    const publicEvents = presentTrackingEvents(events, staff, 'masked');
    expect(publicEvents[0].actor).toEqual({ name: 'Rina', phone: '+62 877-****-5449' });
    expect(publicEvents[0].note).toBe('Alamat tujuan tidak sesuai');
    expect(publicEvents[1].note).toBeNull();
    expect(publicEvents[2].note).toBeNull();
    expect(JSON.stringify(publicEvents)).not.toContain('staffId');
    expect(JSON.stringify(publicEvents)).not.toContain('Petugas Lain');
    expect(JSON.stringify(publicEvents)).not.toContain('089999999999');
  });

  it('projects no customer details, internal notes, or monetary fields into the public DTO', () => {
    const result = projectPublicTrackingResult({
      trackingCode: 'SRV123',
      currentStatus: 'siap_diambil',
      currentStatusTitle: 'Siap diambil',
      serviceMethod: 'pickup_delivery',
      estimatedDoneAt: null,
      createdAt: '2026-11-22T09:00:00Z',
      completedAt: null,
      customerName: 'Data pelanggan',
      customerPhone: '081234567890',
      customerAddress: 'Alamat rahasia',
      complaint: 'Catatan internal',
      internalNote: 'Jangan kirim',
      initialEstimateCost: 200000,
      finalCost: 250000,
      device: { category: 'laptop', model: 'Model A' },
      branchName: 'Cabang Utama',
    }, []);

    expect(result).not.toHaveProperty('customerName');
    expect(result).not.toHaveProperty('customerPhone');
    expect(result).not.toHaveProperty('customerAddress');
    expect(result).not.toHaveProperty('complaint');
    expect(result).not.toHaveProperty('internalNote');
    expect(result).not.toHaveProperty('initialEstimateCost');
    expect(result).not.toHaveProperty('finalCost');
  });
});
