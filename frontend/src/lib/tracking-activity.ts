import type { TrackTimelineEvent } from './api';

export type TrackingStage = 'booking' | 'pickup' | 'diagnosa' | 'perbaikan' | 'pembayaran' | 'delivery';

export interface TrackingActivity extends TrackTimelineEvent {
  stage: TrackingStage;
}

export interface TrackingActivityGroup {
  stage: TrackingStage;
  title: string;
  activities: TrackingActivity[];
}

export const TRACKING_STAGE_TITLES: Record<TrackingStage, string> = {
  booking: 'Booking',
  pickup: 'Pickup',
  diagnosa: 'Diagnosa',
  perbaikan: 'Perbaikan',
  pembayaran: 'Pembayaran',
  delivery: 'Pengantaran',
};

const STATUS_LABELS: Record<string, string> = {
  booking_created: 'Booking servis dibuat',
  pickup_requested: 'Permintaan pickup diterima',
  pickup_scheduled: 'Pickup dijadwalkan',
  pickup_confirmed: 'Pickup dikonfirmasi',
  unit_received: 'Unit diterima cabang',
  ticket_issued: 'Tiket servis diterbitkan',
  cancelled: 'Booking dibatalkan',
  no_show: 'Booking tidak dilanjutkan',
  antrian: 'Masuk antrean',
  pengecekan: 'Pengecekan perangkat',
  menunggu_part: 'Menunggu suku cadang',
  menunggu_persetujuan: 'Menunggu persetujuan',
  pengerjaan: 'Perbaikan berlangsung',
  quality_check: 'Pemeriksaan akhir',
  selesai: 'Servis selesai',
  siap_diambil: 'Siap diambil',
  siap_diantar: 'Siap diantar',
  batal: 'Servis dibatalkan',
  technician_assigned: 'Teknisi ditugaskan',
  pickup_courier_assigned: 'Kurir pickup ditugaskan',
  pickup_courier_reassigned: 'Kurir pickup diperbarui',
  pickup_courier_on_the_way: 'Kurir menuju lokasi penjemputan',
  pickup_courier_arrived: 'Kurir tiba di lokasi penjemputan',
  pickup_device_picked_up: 'Perangkat dijemput',
  pickup_courier_returning: 'Kurir menuju workshop',
  pickup_device_arrived: 'Perangkat tiba di workshop',
  pickup_trip: 'Perangkat dijemput dan dibawa ke workshop',
  pickup_failed: 'Penjemputan gagal',
  delivery_courier_assigned: 'Pengantaran ditugaskan ke kurir',
  delivery_courier_reassigned: 'Kurir pengantaran diperbarui',
  delivery_courier_on_the_way: 'Kurir menuju pelanggan',
  delivery_courier_arrived: 'Kurir tiba di lokasi pelanggan',
  device_received: 'Perangkat diterima pelanggan',
  delivery_completed: 'Pengantaran selesai',
  delivery_failed: 'Pengantaran gagal',
  invoice_paid: 'Invoice lunas',
  status_updated: 'Pembaruan status',
  courier_returning_to_workshop: 'Kurir menuju workshop',
  device_arrived_at_workshop: 'Perangkat tiba di workshop',
};

const STAGE_ORDER: TrackingStage[] = ['booking', 'pickup', 'diagnosa', 'perbaikan', 'pembayaran', 'delivery'];
const PICKUP_TRIP_STATUSES = new Set([
  'pickup_courier_on_the_way',
  'pickup_courier_arrived',
  'pickup_device_picked_up',
  'pickup_courier_returning',
  'pickup_device_arrived',
  'courier_returning_to_workshop',
  'device_arrived_at_workshop',
]);

function stageForStatus(status: string, serviceMethod = ''): TrackingStage {
  if (status.startsWith('pickup_')) return 'pickup';
  if (status === 'unit_received' && serviceMethod.includes('pickup')) return 'pickup';
  if (status.startsWith('delivery_') || status === 'device_received') return 'delivery';
  if (status === 'invoice_paid') return 'pembayaran';
  if (['antrian', 'technician_assigned', 'pengecekan', 'menunggu_persetujuan'].includes(status)) return 'diagnosa';
  if (['menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil', 'siap_diantar', 'batal'].includes(status)) return 'perbaikan';
  return 'booking';
}

export function trackingEventLabel(event: Pick<TrackTimelineEvent, 'status'>) {
  return STATUS_LABELS[event.status.toLowerCase()] || 'Pembaruan status';
}

export function trackingActorLabel(event: Pick<TrackTimelineEvent, 'status' | 'actor'>) {
  const name = event.actor?.name?.trim();
  if (!name) return null;
  const contact = event.actor?.phone ? ` (${event.actor.phone})` : '';
  const by = `${name}${contact}`;
  const status = event.status.toLowerCase();

  if (status === 'unit_received') return `Diterima oleh: ${by}`;
  if (status === 'technician_assigned') return `Dikerjakan oleh: ${by}`;
  if (status.includes('courier') || status === 'device_received' || status === 'pickup_trip') return `Diantar oleh: ${by}`;
  if (status === 'booking_created') return `Dicatat oleh: ${by}`;
  return `Diperbarui oleh: ${by}`;
}

function mergeNearbyPickupSteps(events: TrackTimelineEvent[]) {
  const merged: TrackTimelineEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!PICKUP_TRIP_STATUSES.has(event.status)) {
      merged.push(event);
      continue;
    }

    const trip = [event];
    while (index + 1 < events.length && PICKUP_TRIP_STATUSES.has(events[index + 1].status)) {
      const next = events[index + 1];
      const gap = new Date(next.createdAt).getTime() - new Date(trip[trip.length - 1].createdAt).getTime();
      if (gap < 0 || gap > 12 * 60 * 60 * 1000) break;
      trip.push(next);
      index += 1;
    }

    if (trip.length === 1) {
      merged.push(event);
      continue;
    }
    merged.push({
      ...event,
      status: 'pickup_trip',
      title: 'Perangkat dijemput dan dibawa ke workshop',
      createdAt: trip[trip.length - 1].createdAt,
      actor: [...trip].reverse().find((step) => step.actor?.name)?.actor ?? null,
      note: null,
    });
  }

  return merged;
}

function mergeDeliveryHandover(events: TrackTimelineEvent[]) {
  const merged: TrackTimelineEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const complete = events[index + 1];
    if (event.status !== 'device_received' || complete?.status !== 'delivery_completed') {
      merged.push(event);
      continue;
    }
    const gap = new Date(complete.createdAt).getTime() - new Date(event.createdAt).getTime();
    if (gap < 0 || gap > 60 * 60 * 1000) {
      merged.push(event);
      continue;
    }
    merged.push({ ...event, createdAt: complete.createdAt, actor: event.actor ?? complete.actor });
    index += 1;
  }
  return merged;
}

export function groupTrackingActivities(events: TrackTimelineEvent[], serviceMethod = ''): TrackingActivityGroup[] {
  const chronological = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const folded = mergeDeliveryHandover(mergeNearbyPickupSteps(chronological));
  const groups: TrackingActivityGroup[] = [];
  for (const event of folded) {
    const stage = stageForStatus(event.status.toLowerCase(), serviceMethod);
    const current = groups[groups.length - 1];
    if (current?.stage === stage) current.activities.push({ ...event, stage });
    else groups.push({ stage, title: TRACKING_STAGE_TITLES[stage], activities: [{ ...event, stage }] });
  }
  return groups;
}

export function trackingProgressStages(serviceMethod: string, events: TrackTimelineEvent[]) {
  const hasPickup = serviceMethod.includes('pickup') || events.some((event) => stageForStatus(event.status.toLowerCase()) === 'pickup');
  const hasDelivery = serviceMethod.includes('delivery') || events.some((event) => stageForStatus(event.status.toLowerCase()) === 'delivery');
  return STAGE_ORDER.filter((stage) => (stage !== 'pickup' || hasPickup) && (stage !== 'delivery' || hasDelivery));
}

export function trackingCurrentStage(serviceMethod: string, currentStatus: string, events: TrackTimelineEvent[]): TrackingStage {
  const statuses = new Set(events.map((event) => event.status.toLowerCase()));
  const hasDelivery = serviceMethod.includes('delivery') || [...statuses].some((status) => stageForStatus(status) === 'delivery');
  const delivered = statuses.has('device_received') || statuses.has('delivery_completed');
  const failed = statuses.has('delivery_failed');
  const paid = statuses.has('invoice_paid');

  if (delivered) return 'delivery';
  if (paid && !hasDelivery) return 'pembayaran';
  if (failed || (hasDelivery && paid)) return 'delivery';
  if (hasDelivery && !paid && [...statuses].some((status) => stageForStatus(status) === 'delivery')) return 'pembayaran';
  if (['siap_diambil', 'siap_diantar', 'selesai'].includes(currentStatus.toLowerCase())) return 'pembayaran';
  if (['menunggu_part', 'pengerjaan', 'quality_check'].includes(currentStatus.toLowerCase())) return 'perbaikan';
  if (['antrian', 'pengecekan', 'menunggu_persetujuan'].includes(currentStatus.toLowerCase())) return 'diagnosa';
  if (serviceMethod.includes('pickup') && !statuses.has('unit_received')) return 'pickup';
  if (statuses.has('unit_received') || statuses.has('ticket_issued')) return 'diagnosa';
  return 'booking';
}

export function trackingCompleted(events: TrackTimelineEvent[], serviceMethod: string) {
  const statuses = new Set(events.map((event) => event.status.toLowerCase()));
  const hasDelivery = serviceMethod.includes('delivery') || [...statuses].some((status) => stageForStatus(status) === 'delivery');
  return statuses.has('device_received') || statuses.has('delivery_completed') || (statuses.has('invoice_paid') && !hasDelivery);
}
