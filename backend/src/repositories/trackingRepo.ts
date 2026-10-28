import db from '@models/index';

export type TrackingSource = 'booking' | 'ticket';

export interface TrackingTimelineEvent {
  status: string;
  title: string;
  note: string | null;
  source: TrackingSource;
  createdAt: string;
}

export interface TrackingResult {
  trackingCode: string;
  currentStatus: string;
  currentStatusTitle: string;
  serviceMethod: string;
  complaint: string;
  estimatedDoneAt: string | null;
  finalCost: number | null;
  initialEstimateCost: number | null;  createdAt: string;
  completedAt: string | null;
  customerName: string;
  device: {
    category: string;
    brand: string;
    model: string | null;
    serialNumber: string | null;
  };
  branchName: string;
  timeline: TrackingTimelineEvent[];
}

const STATUS_TITLES: Record<string, string> = {
  booking_created: 'Booking Servis Berhasil Dibuat',
  pickup_requested: 'Permintaan Pickup Diterima',
  pickup_scheduled: 'Pickup Dijadwalkan',
  pickup_confirmed: 'Pickup Dikonfirmasi',
  unit_received: 'Unit Diterima Cabang',
  ticket_issued: 'Tiket Servis Diterbitkan',
  cancelled: 'Booking Dibatalkan',
  no_show: 'Customer Tidak Hadir',
  antrian: 'Unit Masuk Antrian',
  pengecekan: 'Pengecekan Perangkat',
  menunggu_part: 'Menunggu Sparepart',
  pengerjaan: 'Pengerjaan',
  quality_check: 'Quality Check',
  selesai: 'Servis Selesai',
  siap_diambil: 'Siap Diambil',
};

function statusTitle(status: string | null | undefined): string {
  if (!status) return '-';
  if (STATUS_TITLES[status]) return STATUS_TITLES[status];
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getTrackingByCode(trackingCode: string): Promise<TrackingResult | null> {
  const result = await db.raw('SELECT public.track_public(?) AS data', [trackingCode]);
  const data = result.rows?.[0]?.data;
  if (!data) return null;

  const timeline: TrackingTimelineEvent[] = Array.isArray(data.timeline)
    ? data.timeline.map((event: any) => ({
        status: event.status,
        title: statusTitle(event.status),
        note: event.note ?? null,
        source: event.source === 'ticket' ? 'ticket' : 'booking',
        createdAt: event.createdAt,
      }))
    : [];

  return {
    trackingCode: data.trackingCode,
    currentStatus: data.currentStatus,
    currentStatusTitle: statusTitle(data.currentStatus),
    serviceMethod: data.serviceMethod,
    complaint: data.complaint,
    estimatedDoneAt: data.estimatedDoneAt ?? null,
    finalCost: data.finalCost === null || data.finalCost === undefined ? null : Number(data.finalCost),
    initialEstimateCost: data.initialEstimateCost === null || data.initialEstimateCost === undefined ? null : Number(data.initialEstimateCost),    createdAt: data.createdAt,
    completedAt: data.completedAt ?? null,
    customerName: data.customerName,
    device: {
      category: data.device?.category ?? '-',
      brand: data.device?.brand ?? '-',
      model: data.device?.model ?? null,
      serialNumber: data.device?.serialNumber ?? null,
    },
    branchName: data.branchName,
    timeline,
  };
}
