export type TrackingContactVisibility = 'full' | 'masked' | 'hidden';

export interface TrackingStaffRecord {
  name: string | null;
  phone: string | null;
}

export interface TrackingRawEvent {
  status: string;
  title: string;
  note: string | null;
  source: 'booking' | 'ticket' | 'courier' | 'payment';
  createdAt: string;
  staffId: string | null;
}

const PUBLIC_FAILURE_REASONS = new Set([
  'Pelanggan tidak berada di lokasi',
  'Penjemputan dibatalkan pelanggan',
  'Pengantaran dibatalkan pelanggan',
  'Alamat penjemputan tidak sesuai',
  'Alamat tujuan tidak sesuai',
  'Pelanggan tidak dapat dihubungi',
  'Kendala lainnya',
]);

export function formatTrackingPhone(phone: string | null | undefined, visibility: TrackingContactVisibility) {
  if (!phone || visibility === 'hidden') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;

  const international = digits.startsWith('0062')
    ? digits.slice(2)
    : digits.startsWith('62')
      ? digits
      : digits.startsWith('0')
        ? `62${digits.slice(1)}`
        : digits.startsWith('8')
          ? `62${digits}`
          : digits;

  if (visibility === 'full') return `+${international}`;
  if (international.startsWith('62') && international.length < 9) return null;
  if (!international.startsWith('62')) return `+${international.slice(0, 3)}-****-${international.slice(-4)}`;
  return `+62 ${international.slice(2, 5)}-****-${international.slice(-4)}`;
}

export function presentTrackingStaff(staff: TrackingStaffRecord | undefined, visibility: TrackingContactVisibility) {
  const name = staff?.name?.trim();
  if (!name) return null;
  return { name, phone: formatTrackingPhone(staff?.phone, visibility) };
}

export function presentTrackingEvents(
  events: TrackingRawEvent[],
  staffById: Map<string, TrackingStaffRecord>,
  visibility: TrackingContactVisibility,
) {
  const failureStatuses = new Set(['pickup_failed', 'delivery_failed']);
  return events.map(({ staffId, ...event }) => ({
    ...event,
    note: failureStatuses.has(event.status) && event.note && PUBLIC_FAILURE_REASONS.has(event.note) ? event.note : null,
    actor: staffId ? presentTrackingStaff(staffById.get(staffId), visibility) : null,
  }));
}

export function projectPublicTrackingResult(data: any, timeline: ReturnType<typeof presentTrackingEvents>) {
  return {
    trackingCode: data.trackingCode,
    currentStatus: data.currentStatus,
    currentStatusTitle: data.currentStatusTitle,
    serviceMethod: data.serviceMethod,
    estimatedDoneAt: data.estimatedDoneAt ?? null,
    createdAt: data.createdAt,
    completedAt: data.completedAt ?? null,
    device: {
      category: data.device?.category ?? '-',
      model: data.device?.model ?? null,
    },
    branchName: data.branchName,
    timeline,
  };
}
