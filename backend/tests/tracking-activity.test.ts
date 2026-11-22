import { describe, expect, it } from 'vitest';
import type { TrackTimelineEvent } from '../../frontend/src/lib/api';
import {
  groupTrackingActivities,
  trackingActorLabel,
  trackingCompleted,
  trackingCurrentStage,
  trackingEventLabel,
  trackingProgressStages,
} from '../../frontend/src/lib/tracking-activity';

const event = (status: string, createdAt: string, actor: TrackTimelineEvent['actor'] = null, note: string | null = null): TrackTimelineEvent => ({
  status,
  title: status,
  note,
  source: status.includes('courier') || status.includes('device_received') ? 'courier' : 'ticket',
  createdAt,
  actor,
});

describe('public tracking activities', () => {
  it('sorts and combines a nearby pickup journey into one meaningful activity', () => {
    const groups = groupTrackingActivities([
      event('pickup_device_arrived', '2026-11-22T10:40:00Z'),
      event('pickup_courier_on_the_way', '2026-11-22T09:00:00Z', { name: 'Rina', phone: '+6287722745449' }),
      event('pickup_device_picked_up', '2026-11-22T09:30:00Z'),
      event('pickup_courier_arrived', '2026-11-22T09:20:00Z'),
      event('pickup_courier_returning', '2026-11-22T10:00:00Z'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Pickup');
    expect(groups[0].activities).toHaveLength(1);
    expect(groups[0].activities[0].title).toBe('Perangkat dijemput dan dibawa ke workshop');
    expect(groups[0].activities[0].createdAt).toBe('2026-11-22T10:40:00Z');
    expect(trackingEventLabel(groups[0].activities[0])).toBe('Perangkat dijemput dan dibawa ke workshop');
    expect(trackingActorLabel(groups[0].activities[0])).toBe('Diantar oleh: Rina (+6287722745449)');
  });

  it('uses the event actor for frontdesk, technician, and courier subtext, and hides empty actors safely', () => {
    expect(trackingActorLabel(event('unit_received', '2026-11-22T08:00:00Z', { name: 'Ayu', phone: '+6281234567890' })))
      .toBe('Diterima oleh: Ayu (+6281234567890)');
    expect(trackingActorLabel(event('technician_assigned', '2026-11-22T08:05:00Z', { name: 'Budi', phone: null })))
      .toBe('Dikerjakan oleh: Budi');
    expect(trackingActorLabel(event('delivery_courier_assigned', '2026-11-22T08:10:00Z', { name: 'Rina', phone: '+6287722745449' })))
      .toBe('Diantar oleh: Rina (+6287722745449)');
    expect(trackingActorLabel(event('delivery_courier_assigned', '2026-11-22T08:10:00Z'))).toBeNull();
  });

  it('uses Indonesian labels and combines delivery handover with task completion', () => {
    expect(trackingEventLabel({ status: 'quality_check' })).toBe('Pemeriksaan akhir');
    expect(trackingEventLabel({ status: 'invoice_paid' })).toBe('Invoice lunas');
    expect([
      'delivery_courier_assigned',
      'delivery_courier_on_the_way',
      'delivery_courier_arrived',
      'device_received',
      'delivery_failed',
    ].map((status) => trackingEventLabel({ status }))).toEqual([
      'Pengantaran ditugaskan ke kurir',
      'Kurir menuju pelanggan',
      'Kurir tiba di lokasi pelanggan',
      'Perangkat diterima pelanggan',
      'Pengantaran gagal',
    ]);
    expect(trackingEventLabel({ status: 'unknown_english_event' })).toBe('Pembaruan status');
    const groups = groupTrackingActivities([
      event('delivery_completed', '2026-11-22T12:02:00Z'),
      event('device_received', '2026-11-22T12:00:00Z', { name: 'Rina', phone: null }),
    ]);
    expect(groups[0].title).toBe('Pengantaran');
    expect(groups[0].activities).toHaveLength(1);
    expect(groups[0].activities[0].status).toBe('device_received');
  });

  it('keeps stage groups in real chronological order when delivery is assigned before payment', () => {
    const groups = groupTrackingActivities([
      event('invoice_paid', '2026-11-22T10:05:00Z'),
      event('delivery_courier_assigned', '2026-11-22T10:00:00Z'),
      event('delivery_courier_on_the_way', '2026-11-22T10:10:00Z'),
    ]);
    expect(groups.map((group) => group.stage)).toEqual(['delivery', 'pembayaran', 'delivery']);
    expect(groups.flatMap((group) => group.activities.map((activity) => activity.createdAt))).toEqual([
      '2026-11-22T10:00:00Z',
      '2026-11-22T10:05:00Z',
      '2026-11-22T10:10:00Z',
    ]);
  });

  it('groups unit receipt with pickup when the ticket uses courier pickup', () => {
    const groups = groupTrackingActivities([
      event('unit_received', '2026-11-22T10:00:00Z', { name: 'Ayu', phone: null }),
    ], 'pickup_delivery');
    expect(groups[0].stage).toBe('pickup');
    expect(trackingEventLabel(groups[0].activities[0])).toBe('Unit diterima cabang');
  });

  it('shows payment before delivery in the progress indicator and completes after delivery', () => {
    const waitingForPayment = [event('delivery_courier_assigned', '2026-11-22T10:00:00Z')];
    expect(trackingCurrentStage('pickup_delivery', 'siap_diambil', waitingForPayment)).toBe('pembayaran');
    const events = [
      event('delivery_courier_assigned', '2026-11-22T10:00:00Z'),
      event('invoice_paid', '2026-11-22T10:05:00Z'),
    ];
    expect(trackingProgressStages('pickup_delivery', events)).toEqual(['booking', 'pickup', 'diagnosa', 'perbaikan', 'pembayaran', 'delivery']);
    expect(trackingCurrentStage('pickup_delivery', 'siap_diambil', events)).toBe('delivery');
    expect(trackingCompleted(events, 'pickup_delivery')).toBe(false);
    const delivered = [...events, event('device_received', '2026-11-22T11:00:00Z')];
    expect(trackingCompleted(delivered, 'pickup_delivery')).toBe(true);
    expect(trackingCurrentStage('pickup_delivery', 'siap_diambil', delivered)).toBe('delivery');
  });
});
