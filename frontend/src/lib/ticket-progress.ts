export const TICKET_PROGRESS: Record<string, number> = {
  booking_created: 10,
  unit_received: 20,
  ticket_created: 25,
  antrian: 35,
  pengecekan: 50,
  menunggu_part: 60,
  pengerjaan: 75,
  quality_check: 90,
  selesai: 100,
  siap_diambil: 100,
};

export const TICKET_STAGE: Record<string, string> = {
  booking_created: 'Booking',
  unit_received: 'Booking',
  ticket_created: 'Booking',
  antrian: 'Booking',
  pengecekan: 'Diagnosa',
  menunggu_part: 'Perbaikan',
  pengerjaan: 'Perbaikan',
  quality_check: 'Perbaikan',
  selesai: 'Selesai',
  siap_diambil: 'Selesai',
};

export function getTicketProgress(status: string | null | undefined): number {
  if (!status) return 0;
  const key = status.toLowerCase();
  return TICKET_PROGRESS[key] ?? 0;
}

export function getTicketStage(status: string | null | undefined): string {
  if (!status) return 'Belum Dimulai';
  const key = status.toLowerCase();
  return TICKET_STAGE[key] ?? status;
}
