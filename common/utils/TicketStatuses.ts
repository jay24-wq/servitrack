// Ticket status constants and label mapping
export const TICKET_STATUSES = {
  ANTRIAN: { label: 'Antrian', color: 'bg-yellow-100 text-yellow-700' },
  PENGECEKAN: { label: 'Pengecekan', color: 'bg-sky-100 text-sky-700' },
  MENUNGGU_PART: { label: 'Menunggu Part', color: 'bg-amber-100 text-amber-700' },
  PENGGERJAAN: { label: 'Pengerjaan', color: 'bg-blue-100 text-blue-700' },
  QUALITY_CHECK: { label: 'Quality Check', color: 'bg-green-100 text-green-700' },
  SELESAI: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  SIAP_DIAMBIL: { label: 'Siap Diambil', color: 'bg-purple-100 text-purple-700' },
} as const;

export const TICKET_STATUS_ORDER = ['ANTRIAN', 'PENGECEKAN', 'MENUNGGU_PART', 'PENGGERJAAN', 'QUALITY_CHECK', 'SELESAI', 'SIAP_DIAMBIL'] as const;

export type TicketStatus = typeof TICKET_STATUS_ORDER[number];

export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUSES[status]?.label || status;
}

export function getTicketStatusColor(status: TicketStatus): string {
  return TICKET_STATUSES[status]?.color || 'bg-gray-100 text-gray-700';
}
