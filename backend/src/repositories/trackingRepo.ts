import db from '@models/index';
import {
  presentTrackingEvents,
  projectPublicTrackingResult,
  type TrackingContactVisibility,
  type TrackingRawEvent,
  type TrackingStaffRecord,
} from '@services/trackingPrivacy';

export type TrackingSource = 'booking' | 'ticket' | 'courier' | 'payment';

export interface TrackingTimelineEvent {
  status: string;
  title: string;
  note: string | null;
  source: TrackingSource;
  createdAt: string;
  actor: { name: string; phone: string | null } | null;
}

export interface TrackingResult {
  trackingCode: string;
  currentStatus: string;
  currentStatusTitle: string;
  serviceMethod: string;
  estimatedDoneAt: string | null;
  createdAt: string;
  completedAt: string | null;
  device: {
    category: string;
    model: string | null;
  };
  branchName: string;
  timeline: TrackingTimelineEvent[];
}

const STATUS_TITLES: Record<string, string> = {
  booking_created: 'Booking Servis Berhasil Dibuat',
  pickup_requested: 'Permintaan Pickup Diterima',
  pickup_scheduled: 'Pickup Dijadwalkan',
  pickup_confirmed: 'Pickup Dikonfirmasi',
  pickup_courier_assigned: 'Kurir penjemputan ditugaskan',
  pickup_courier_reassigned: 'Kurir penjemputan diperbarui',
  pickup_courier_on_the_way: 'Kurir menuju lokasi penjemputan',
  pickup_courier_arrived: 'Kurir tiba di lokasi penjemputan',
  pickup_device_picked_up: 'Perangkat dijemput',
  pickup_courier_returning: 'Kurir menuju workshop',
  pickup_device_arrived: 'Perangkat tiba di workshop',
  pickup_failed: 'Penjemputan gagal',
  delivery_courier_assigned: 'Pengantaran ditugaskan ke kurir',
  delivery_courier_reassigned: 'Kurir pengantaran diperbarui',
  delivery_courier_on_the_way: 'Kurir menuju pelanggan',
  delivery_courier_arrived: 'Kurir tiba di lokasi pelanggan',
  device_received: 'Perangkat diterima pelanggan',
  delivery_completed: 'Pengantaran selesai',
  delivery_failed: 'Pengantaran gagal',
  invoice_paid: 'Invoice lunas',
  technician_assigned: 'Teknisi ditugaskan',
  courier_returning_to_workshop: 'Kurir Menuju Workshop',
  device_arrived_at_workshop: 'Perangkat Tiba di Workshop',
  unit_received: 'Unit Diterima Cabang',
  ticket_issued: 'Tiket Servis Diterbitkan',
  cancelled: 'Booking Dibatalkan',
  no_show: 'Pelanggan Tidak Hadir',
  antrian: 'Unit Masuk Antrian',
  pengecekan: 'Pengecekan Perangkat',
  menunggu_part: 'Menunggu Sparepart',
  menunggu_persetujuan: 'Menunggu Persetujuan',
  pengerjaan: 'Pengerjaan',
  quality_check: 'Pemeriksaan Akhir',
  selesai: 'Servis Selesai',
  siap_diambil: 'Siap Diambil',
  siap_diantar: 'Siap Diantar',
  batal: 'Servis Dibatalkan',
  status_updated: 'Pembaruan Status',
};

function statusTitle(status: string | null | undefined): string {
  if (!status) return '-';
  return STATUS_TITLES[status.toLowerCase()] ?? 'Pembaruan Status';
}

export async function getTrackingByCode(trackingCode: string): Promise<TrackingResult | null> {
  const result = await db.raw('SELECT public.track_public(?) AS data', [trackingCode]);
  const data = result.rows?.[0]?.data;
  if (!data) return null;

  const activityResult = await db.raw('SELECT public.tracking_activity_events(?) AS data', [trackingCode]);
  const activityData = activityResult.rows?.[0]?.data;
  const rawEvents: TrackingRawEvent[] = Array.isArray(activityData?.events)
    ? activityData.events.map((event: any) => ({
        status: String(event.status ?? ''),
        title: statusTitle(event.status),
        note: event.note ?? null,
        source: ['booking', 'ticket', 'courier', 'payment'].includes(event.source) ? event.source : 'booking',
        createdAt: event.createdAt,
        staffId: event.staffId ?? null,
      }))
    : [];

  const staffIds = [...new Set(rawEvents.map((event) => event.staffId).filter((id): id is string => Boolean(id)))];
  const tenantId = activityData?.tenantId;
  const { visibility, staffById } = tenantId
    ? await db.transaction(async (trx) => {
        await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenantId]);
        const settings = await trx('tenants').where({ id: tenantId }).select('public_tracking_contact_visibility').first();
        const staff = staffIds.length
          ? await trx('users').where({ tenant_id: tenantId }).whereIn('id', staffIds).select('id', 'name', 'phone')
          : [];
        const configured = settings?.public_tracking_contact_visibility;
        const contactVisibility: TrackingContactVisibility = ['full', 'masked', 'hidden'].includes(configured) ? configured : 'masked';
        return {
          visibility: contactVisibility,
          staffById: new Map<string, TrackingStaffRecord>(staff.map((user: any) => [user.id, { name: user.name ?? null, phone: user.phone ?? null }])),
        };
      })
    : { visibility: 'masked' as TrackingContactVisibility, staffById: new Map<string, TrackingStaffRecord>() };

  const timeline = presentTrackingEvents(rawEvents, staffById, visibility).map((event) => ({
    ...event,
    title: statusTitle(event.status),
    source: event.source,
    createdAt: event.createdAt,
  }));
  timeline.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return projectPublicTrackingResult({ ...data, currentStatusTitle: statusTitle(data.currentStatus) }, timeline) as TrackingResult;
}
