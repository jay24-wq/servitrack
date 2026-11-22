// Ticket status constants and label mapping
export const TICKET_STATUSES = {
  ANTRIAN: { label: 'Antrian', color: 'bg-yellow-100 text-yellow-700' },
  PENGECEKAN: { label: 'Pengecekan', color: 'bg-sky-100 text-sky-700' },
  MENUNGGU_PART: { label: 'Menunggu Part', color: 'bg-amber-100 text-amber-700' },
  MENUNGGU_PERSETUJUAN: { label: 'Menunggu Persetujuan', color: 'bg-amber-100 text-amber-800' },
  PENGGERJAAN: { label: 'Pengerjaan', color: 'bg-blue-100 text-blue-700' },
  QUALITY_CHECK: { label: 'Quality Check', color: 'bg-green-100 text-green-700' },
  SELESAI: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  SIAP_DIAMBIL: { label: 'Siap Diambil', color: 'bg-purple-100 text-purple-700' },
  BATAL: { label: 'Dibatalkan', color: 'bg-stone-100 text-stone-600' },
} as const;

export const TICKET_STATUS_ORDER = ['ANTRIAN', 'PENGECEKAN', 'MENUNGGU_PART', 'MENUNGGU_PERSETUJUAN', 'PENGGERJAAN', 'QUALITY_CHECK', 'SELESAI', 'SIAP_DIAMBIL', 'BATAL'] as const;

export type TicketStatus = typeof TICKET_STATUS_ORDER[number];

// Persisted lowercase values are kept for DB compatibility. This table is the
// shared source of truth for API validation and Kanban drag/drop affordances.
export const TICKET_STATUS_TRANSITIONS = {
  antrian: ['pengecekan', 'batal'],
  pengecekan: ['pengerjaan', 'menunggu_part', 'menunggu_persetujuan', 'batal'],
  menunggu_persetujuan: ['pengerjaan', 'menunggu_part', 'batal', 'siap_diambil'],
  menunggu_part: ['pengerjaan', 'batal'],
  pengerjaan: ['menunggu_part', 'quality_check', 'batal'],
  quality_check: ['pengerjaan', 'selesai', 'siap_diambil'],
  selesai: ['siap_diambil'],
  siap_diambil: [],
  batal: ['siap_diambil'],
} as const satisfies Record<string, readonly string[]>;

export type DbTicketStatus = keyof typeof TICKET_STATUS_TRANSITIONS;

export function canTransitionTicket(from: string, to: string): boolean {
  return (TICKET_STATUS_TRANSITIONS as Record<string, readonly string[]>)[from]?.includes(to) ?? false;
}

export function allowedTicketTransitions(from: string): readonly string[] {
  return (TICKET_STATUS_TRANSITIONS as Record<string, readonly string[]>)[from] ?? [];
}

export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUSES[status]?.label || status;
}

export function getTicketStatusColor(status: TicketStatus): string {
  return TICKET_STATUSES[status]?.color || 'bg-gray-100 text-gray-700';
}
