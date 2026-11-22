import { create } from 'zustand';

export type QueueStatus =
  | 'Antrian'
  | 'Pengecekan'
  | 'Menunggu Part'
  | 'Menunggu Persetujuan'
  | 'Pengerjaan'
  | 'Quality Control'
  | 'Selesai'
  | 'Siap Diambil'
  | 'Dibatalkan';

export type Handover = 'Antar-Jemput' | 'Drop-off' | 'Pick-up';

export interface PartUsage {
  id: string;
  name: string;
  qty: number;
  price: number;
  sku?: string;
  unit?: string;
  usedAt?: string;
  usedBy?: string;
}

export type QuotationType = 'EXTRA_DAMAGE' | 'PART_OUT_OF_STOCK';
export type QuotationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TicketQuotation {
  type: QuotationType;
  status: QuotationStatus;
  message: string;
  items: PartUsage[];
  etaDays?: number;
  createdAt: string;
}

export interface TechnicianNote {
  at: string;
  note: string;
}

export interface QueueTicket {
  id: string;
  recordId?: string;
  time: string;
  customer: string;
  phone: string;
  handover: Handover;
  device: string;
  devicePin?: string | null;
  pinRefused?: boolean;
  workType?: 'without_parts' | 'with_parts' | null;
  diagnosisStatus?: 'matches_complaint' | 'additional_damage' | null;
  technicianDiagnosis?: string | null;
  additionalDamage?: string | null;
  requestedPartId?: string | null;
  requestedPartQty?: number | null;
  partShortages?: Array<{
    part_id: string;
    part_name: string;
    required_qty: number;
    available_qty: number;
    shortage_qty: number;
    part_request_id?: string | null;
    part_request_status?: string;
    estimated_arrival_days?: number | null;
  }>;
  diagnosis: string;
  technician: string;
  technicianInitials: string;
  status: QueueStatus;
  slaPrimary: string;
  slaTone: string;
  slaSecondary: string;
  slaTertiary?: string;
  extraDamage?: boolean;
  partsUsed?: PartUsage[];
  quotation?: TicketQuotation | null;
  partEtaDays?: number;
  notes?: TechnicianNote[];
}


interface TicketState {
  tickets: QueueTicket[];
  kuotaTerpakai: number;
  kuotaBulanan: number;
  tambahTiket: (ticket: QueueTicket) => void;
  setTickets: (tickets: QueueTicket[]) => void;
  updateTicket: (id: string, patch: Partial<QueueTicket>) => void;
  jumlahTiketBaru: number;
}

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  kuotaTerpakai: 72,
  kuotaBulanan: 100,
  jumlahTiketBaru: 0,
  tambahTiket: (ticket) =>
    set((state) => ({
      tickets: [ticket, ...state.tickets],
      kuotaTerpakai: state.kuotaTerpakai + 1,
      jumlahTiketBaru: state.jumlahTiketBaru + 1,
    })),
  setTickets: (tickets) => set({ tickets }),
  updateTicket: (id, patch) =>
    set((state) => ({
      tickets: state.tickets.map((ticket) => (ticket.id === id ? { ...ticket, ...patch } : ticket)),
    })),
}));

export const FLOW_STAGES: QueueStatus[] = [
  'Antrian',
  'Pengecekan',
  'Menunggu Part',
  'Menunggu Persetujuan',
  'Pengerjaan',
  'Quality Control',
  'Selesai',
  'Siap Diambil',
  'Dibatalkan',
];
