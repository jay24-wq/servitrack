import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlass,
  DownloadSimple,
  QrCode,
  Plus,
  CaretDown,
  CaretLeft,
  CaretRight,
  Wrench,
  CalendarBlank,
  DotsThreeVertical,
  ArrowSquareOut,
  UsersThree,
  ChartBar,
  Crown,
  Eye,
  WhatsappLogo,
  UserSwitch,
  ArrowClockwise,
  Receipt,
  FileText,
} from '@phosphor-icons/react';

import { TrackingCode } from '../../components/admin/TrackingCode';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { UserAvatar } from '../../components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { type QueueStatus } from '../../store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignTicketTechnician,
  getInvoices,
  getTechnicianWorkload,
  getTicket,
  getTickets,
  updateTicketStatus,
  type TechnicianWorkload,
} from '../../lib/api';
import { DB_STATUS_MAP } from '../../lib/mappers';
import {
  buildServiceStatusMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
  printInvoice,
  printReceipt,
  printTrackingQr,
} from '../../lib/ticket-print';

type Status = QueueStatus;

interface ServiceTicket {
  id: string;
  ticket_code: string;
  tracking_code?: string | null;
  current_status: string;
  complaint: string;
  service_method: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  device_label?: string;
  technician_id?: string | null;
  technician_name?: string;
  technician_initials?: string;
  assignment_type?: 'AUTO' | 'MANUAL' | null;
  assigned_at?: string | null;
  estimated_done_at?: string | null;
  final_cost?: number | null;
  [key: string]: unknown;
}

const STATUS_STYLE: Record<Status, string> = {
  Antrian: 'bg-amber-500/20 text-amber-800',
  Pengecekan: 'bg-sky-50 text-sky-700',
  Pengerjaan: 'bg-sky-100 text-sky-700',
  'Menunggu Part': 'bg-red-500/20 text-red-700',
  'Quality Control': 'bg-zinc-100 text-gray-700',
  Selesai: 'bg-sky-100 text-sky-700',
};

const STATUS_ORDER: Status[] = ['Antrian', 'Pengecekan', 'Pengerjaan', 'Menunggu Part', 'Quality Control', 'Selesai'];

const STATUS_DB_OPTIONS = [
  { value: 'antrian', label: 'Antrian' },
  { value: 'pengecekan', label: 'Pengecekan' },
  { value: 'pengerjaan', label: 'Pengerjaan' },
  { value: 'menunggu_part', label: 'Menunggu Part' },
  { value: 'quality_check', label: 'Quality Control' },
  { value: 'siap_diambil', label: 'Siap Diambil' },
  { value: 'selesai', label: 'Selesai' },
] as const;

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function QueuePage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const statusParam = searchParams.get('status');
  const statusFromUrl = STATUS_ORDER.includes(statusParam as Status) ? (statusParam as Status) : 'Semua';

  const { data: rawTickets = [] } = useQuery<ServiceTicket[]>({
    queryKey: ['tickets'],
    queryFn: getTickets,
    retry: false as any,
  });

  const { data: workloadData } = useQuery({
    queryKey: ['technician-workload'],
    queryFn: getTechnicianWorkload,
    retry: false,
  });
  const workload = useMemo(() => workloadData?.data ?? [], [workloadData]);
  const workloadSummary = workloadData?.summary;

  const [assigningTicket, setAssigningTicket] = useState<ServiceTicket | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignError, setAssignError] = useState('');

  const [detailTicket, setDetailTicket] = useState<ServiceTicket | null>(null);
  const [statusTicket, setStatusTicket] = useState<ServiceTicket | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusError, setStatusError] = useState('');

  const assignMutation = useMutation({
    mutationFn: (input: { ticketId: string; technicianId: string; note?: string }) =>
      assignTicketTechnician(input.ticketId, {
        technician_id: input.technicianId,
        note: input.note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['technician-workload'] });
      setAssigningTicket(null);
      setSelectedTechnician('');
      setAssignReason('');
      setAssignError('');
    },
    onError: (error: any) => {
      setAssignError(
        error?.response?.data?.error || error?.message || 'Gagal mengganti teknisi. Coba lagi.'
      );
    },
  });

  const { data: detailData, isFetching: detailLoading } = useQuery({
    queryKey: ['ticket', detailTicket?.id],
    queryFn: () => getTicket(detailTicket!.id),
    enabled: Boolean(detailTicket?.id),
    retry: false,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (input: { ticketId: string; toStatus: string; note?: string }) =>
      updateTicketStatus(input.ticketId, input.toStatus, input.note),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['technician-workload'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', input.ticketId] });
      setStatusTicket(null);
      setNextStatus('');
      setStatusNote('');
      setStatusError('');
    },
    onError: (error: any) => {
      setStatusError(
        error?.response?.data?.error || error?.message || 'Gagal memperbarui status. Coba lagi.'
      );
    },
  });

  const openAssignment = (ticket: ServiceTicket) => {
    setAssigningTicket(ticket);
    setSelectedTechnician('');
    setAssignReason('');
    setAssignError('');
  };

  const openStatus = (ticket: ServiceTicket) => {
    setStatusTicket(ticket);
    setNextStatus(ticket.current_status || 'antrian');
    setStatusNote('');
    setStatusError('');
  };

  const openWhatsApp = (ticket: ServiceTicket) => {
    const url = buildWhatsAppUrl(ticket.customer_phone ?? '', buildServiceStatusMessage(ticket));
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openInvoicePrint = (ticket: ServiceTicket) => {
    const invoice = invoices.find((row) => row.ticket_id === ticket.id) ?? null;
    void printInvoice(ticket, invoice);
  };

  const detailTimeline = useMemo(() => {
    if (!detailData) return [];
    const statusLogs = (detailData.statusLogs ?? []).map((log: any) => ({
      id: `status-${log.id}`,
      at: log.created_at,
      label: DB_STATUS_MAP[log.to_status] ?? log.to_status,
      detail: log.note || '',
    }));
    const assignmentLogs = (detailData.assignmentLogs ?? []).map((log: any) => ({
      id: `assignment-${log.id}`,
      at: log.created_at,
      label: log.assignment_type === 'AUTO' ? 'Auto assign teknisi' : 'Manual assign teknisi',
      detail: log.note || '',
    }));
    return [...statusLogs, ...assignmentLogs].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [detailData]);

  const detailInvoice = detailTicket
    ? invoices.find((row) => row.ticket_id === detailTicket.id) ?? null
    : null;
  const detailStatus = detailTicket
    ? DB_STATUS_MAP[detailTicket.current_status] ?? detailTicket.current_status
    : '';
  const detailTotal = detailInvoice?.total ?? detailTicket?.final_cost ?? null;

  // Normalise DB rows so the UI can work with a consistent shape
  const tickets = useMemo(
    () =>
      rawTickets.map((t: any) => ({
        ...t,
        uiStatus: DB_STATUS_MAP[t.current_status] ?? 'Antrian',
      })),
    [rawTickets]
  );

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'Semua'>(statusFromUrl);
  const [techFilter, setTechFilter] = useState('Semua');

  useEffect(() => {
    setStatusFilter(statusFromUrl);
  }, [statusFromUrl]);

  const countByStatus = (status: Status) =>
    tickets.filter((t: any) => t.uiStatus === status).length;

  const technicians = useMemo(
    () =>
      Array.from(
        new Set([
          ...workload.map((technician) => technician.name),
          ...tickets.map((t: any) => t.technician_name).filter(Boolean),
        ])
      ).sort() as string[],
    [tickets, workload]
  );

  // Computed stats from service_tickets only
  const statSedangDikerjakan = countByStatus('Pengerjaan');
  const statMenungguAntrean = countByStatus('Antrian');
  const statMenungguPart = countByStatus('Menunggu Part');
  const statSelesai = countByStatus('Selesai');
  const maxActiveLoad = Math.max(1, ...workload.map((technician) => technician.active_count));
  const busiestTechnician =
    workloadSummary?.busiest_technician ??
    [...workload].sort((a, b) => b.total_count - a.total_count)[0] ??
    null;
  const totalActiveTickets = workload.reduce((total, technician) => total + technician.active_count, 0);
  const assignmentOptions = workload.filter(
    (technician) => technician.id !== assigningTicket?.technician_id
  );

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...values: Array<string | null | undefined>) =>
    normalizedQuery === '' ||
    values.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));

  const rows = tickets.filter((ticket: any) => {
    const matchQuery = matchesQuery(
      ticket.ticket_code,
      ticket.tracking_code,
      ticket.customer_name,
      ticket.customer_phone,
      ticket.device_label
    );
    const matchStatus = statusFilter === 'Semua' || ticket.uiStatus === statusFilter;
    const matchTech = techFilter === 'Semua' || ticket.technician_name === techFilter;
    return matchQuery && matchStatus && matchTech;
  });

  const totalVisible = rows.length;

  return (
    <div className="page-enter flex flex-col">
      <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-7 text-neutral-900">
            Manajemen Antrean Tiket (Ticket Queue)
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-stone-600">
            Pantau prioritas pengerjaan, beban kerja workbench teknisi, kepatuhan SLA 120 menit, dan rute kurir
            antar-jemput secara terpusat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700" asChild>
            <a href="#">
              <DownloadSimple weight="bold" className="size-4 text-stone-600" /> Ekspor antrean (.CSV / PDF)
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700" asChild>
            <Link to="/queue/new?mode=scan">
              <QrCode weight="bold" className="size-4 text-stone-600" /> Scan barcode / QR
            </Link>
          </Button>
          <Button size="sm" className="h-auto gap-1.5 px-3.5 py-1.5 text-xs font-semibold" asChild>
            <Link to="/queue/new">
              <Plus weight="bold" className="size-4" /> Check-in Booking
            </Link>
          </Button>
        </div>
      </div>


      {/* Live stats derived from service_tickets */}
      <div className="grid gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-zinc-600">Sedang dikerjakan</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sky-600">
              <Wrench weight="bold" className="size-4" />
            </span>
          </div>
          <div className="pt-3">
            <p className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{statSedangDikerjakan}</p>
            <span className="mt-1 block text-xs font-medium text-stone-400">Tiket berstatus Pengerjaan</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-zinc-600">Menunggu antrean</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <CalendarBlank weight="bold" className="size-4" />
            </span>
          </div>
          <div className="pt-3">
            <p className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{statMenungguAntrean}</p>
            <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium leading-4">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              <span className="text-amber-700">Tiket berstatus Antrian</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-zinc-600">Menunggu part</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ArrowSquareOut weight="bold" className="size-4" />
            </span>
          </div>
          <div className="pt-3">
            <p className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{statMenungguPart}</p>
            <span className="mt-1 block text-xs font-medium text-stone-400">Tiket on-hold sparepart</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-zinc-600">Selesai</span>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <QrCode weight="bold" className="size-4" />
            </span>
          </div>
          <div className="pt-3">
            <p className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{statSelesai}</p>
            <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium leading-4">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-emerald-700">Tiket berstatus Selesai</span>
            </span>
          </div>
        </div>
      </div>

      <div className="pb-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <ChartBar weight="bold" className="size-4 text-sky-600" />
              Beban Kerja Teknisi
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Distribusi tiket aktif dan total penanganan per teknisi. Auto assignment memilih beban terendah.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700">
              <UsersThree weight="bold" className="size-4 text-stone-500" />
              {workloadSummary?.total_technicians ?? workload.length} teknisi aktif
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
              <Wrench weight="bold" className="size-4" />
              {workloadSummary?.total_active ?? totalActiveTickets} tiket aktif
            </span>
            {busiestTechnician && (
              <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                <Crown weight="bold" className="size-4" />
                {busiestTechnician.name}: {busiestTechnician.total_count} tiket
              </span>
            )}
          </div>
        </div>

        {workload.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workload.map((technician: TechnicianWorkload) => {
              const isBusiest = busiestTechnician?.id === technician.id;
              const loadPercent = Math.round((technician.active_count / maxActiveLoad) * 100);
              return (
                <div
                  key={technician.id}
                  className={cn(
                    'rounded-xl border bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]',
                    isBusiest ? 'border-amber-200 ring-1 ring-amber-100' : 'border-black/10'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        seed={technician.name}
                        initials={initialsFromName(technician.name)}
                        alt={`Avatar ${technician.name}`}
                        className="size-9"
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold text-neutral-900">{technician.name}</span>
                        <span className="text-[11px] text-stone-500">
                          {technician.active_count} aktif · {technician.total_count} total
                        </span>
                      </div>
                    </div>
                    {isBusiest && <Badge variant="warning">Terbanyak</Badge>}
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-stone-500">Beban kerja</span>
                      <span className="font-bold tabular-nums text-neutral-900">
                        {technician.active_count} tiket
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={cn('h-full rounded-full', isBusiest ? 'bg-amber-500' : 'bg-sky-500')}
                        style={{ width: `${technician.active_count === 0 ? 0 : Math.max(loadPercent, 8)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-stone-500">
                      <span>{technician.completed_count} tiket selesai</span>
                      <span>
                        {technician.last_assigned_at
                          ? `Terakhir ${new Date(technician.last_assigned_at).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}`
                          : 'Belum pernah ditugaskan'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center">
            <span className="block text-sm font-semibold text-neutral-900">Belum ada teknisi aktif</span>
            <span className="mt-1 block text-xs text-stone-500">
              Tambahkan pengguna dengan role teknisi agar auto assignment berjalan.
            </span>
          </div>
        )}
      </div>

      <div className="pb-4">
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-2 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-72">
            <MagnifyingGlass
              weight="bold"
              className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-500"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Cari nomor tiket, nomor resi, nama pelanggan, nomor WhatsApp, atau perangkat"
              placeholder="Cari tiket, resi, pelanggan, WhatsApp, atau perangkat."
              className="h-auto rounded-lg border-transparent bg-stone-100 py-2.5 pl-9 pr-4 text-sm text-neutral-900 caret-sky-600 shadow-none placeholder:text-stone-500 focus-visible:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Status {statusFilter === 'Semua' ? `semua (${tickets.length})` : `${statusFilter} (${countByStatus(statusFilter as Status)})`}
                  <CaretDown weight="bold" className="size-4 text-stone-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-stone-400">Filter status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setStatusFilter('Semua')}>
                  <span className="flex-1">Semua ({tickets.length})</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUS_ORDER.map((status) => (
                  <DropdownMenuItem key={status} onSelect={() => setStatusFilter(status)}>
                    <span className={cn('flex-1', statusFilter === status && 'font-bold text-sky-700')}>
                      {status} ({countByStatus(status)})
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Teknisi {techFilter === 'Semua' ? 'semua' : techFilter}
                  <CaretDown weight="bold" className="size-4 text-stone-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-stone-400">Filter teknisi</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setTechFilter('Semua')}>
                  <span className="flex-1">Semua teknisi</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {technicians.map((technician) => (
                  <DropdownMenuItem key={technician} onSelect={() => setTechFilter(technician)}>
                    <span className={cn('flex-1', techFilter === technician && 'font-bold text-sky-700')}>
                      {technician}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="min-w-0 pb-4">
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
          <div className="ledger-scroll overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <caption className="sr-only">
                Daftar antrean tiket aktif dengan status, teknisi, dan kepatuhan SLA
              </caption>
              <thead>
                <tr className="bg-stone-100">
                  <th
                    scope="col"
                    className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600 max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-stone-100 max-lg:shadow-[inset_-1px_0_0_0_#e7e5e4]"
                  >
                    Tiket
                  </th>
                  <th scope="col" className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Pelanggan &amp; layanan
                  </th>
                  <th scope="col" className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Perangkat &amp; diagnosa
                  </th>
                  <th scope="col" className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Teknisi
                  </th>
                  <th scope="col" className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Estimasi / durasi
                  </th>
                  <th scope="col" className="px-4 py-4 text-right text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ticket: any, index: number) => (
                  <tr
                    key={ticket.id}
                    className={cn(
                      'border-b border-black/5 align-top transition-colors last:border-b-0 hover:bg-sky-50/40',
                      index % 2 === 1 && 'bg-stone-100/30'
                    )}
                  >
                    <td
                      className={cn(
                        'px-4 py-4 max-lg:sticky max-lg:left-0 max-lg:z-[1] max-lg:shadow-[inset_-1px_0_0_0_#e7e5e4]',
                        index % 2 === 1 ? 'max-lg:bg-[#f6f5f4]' : 'max-lg:bg-white'
                      )}
                    >
                      <span className="block font-mono text-sm font-bold leading-5 text-neutral-900">{ticket.ticket_code}</span>
                      <TrackingCode code={ticket.tracking_code} />
                      <span className="mt-1 block text-xs font-normal tracking-tight text-stone-500">
                        {new Date(ticket.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block text-sm font-semibold leading-5 text-neutral-900">{ticket.customer_name ?? '—'}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-normal tracking-tight text-stone-600">
                        {ticket.customer_phone ?? ''}
                        <span className="size-3 rounded-sm bg-sky-700" aria-hidden="true" />
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-normal tracking-tight text-stone-500">
                        <span className="size-2.5 rounded-sm bg-stone-500" aria-hidden="true" />
                        {ticket.service_method === 'dropoff' ? 'Drop-off' : ticket.service_method === 'pickup_delivery' ? 'Antar-Jemput' : 'Pick-up'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block text-sm font-semibold leading-5 text-neutral-900">{ticket.device_label ?? '—'}</span>
                      <span className="mt-0.5 block text-xs font-normal leading-4 tracking-tight text-stone-600">
                        {ticket.complaint}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          seed={ticket.technician_name ?? ''}
                          initials={ticket.technician_initials ?? ''}
                          alt={`Avatar ${ticket.technician_name ?? ''}`}
                          className="size-7"
                        />
                        <div className="min-w-0">
                          <span className="block text-sm font-medium leading-5 text-neutral-900">
                            {ticket.technician_name ?? 'Belum ditugaskan'}
                          </span>
                          {ticket.assignment_type && (
                            <Badge
                              variant={ticket.assignment_type === 'AUTO' ? 'default' : 'secondary'}
                              className="mt-1 px-1.5 py-0 text-[10px]"
                            >
                              {ticket.assignment_type === 'AUTO' ? 'Assigned by System' : 'Manual Override'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-tight',
                            STATUS_STYLE[ticket.uiStatus as Status]
                          )}
                      >
                        {ticket.uiStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {ticket.estimated_done_at ? (
                        <span className="block text-sm font-bold leading-5 text-sky-700">
                          {new Date(ticket.estimated_done_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      ) : (
                        <span className="block text-sm font-medium leading-5 text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Lihat detail tiket ${ticket.ticket_code}`}
                          title="Lihat detail tiket"
                          onClick={() => setDetailTicket(ticket)}
                          className="size-8 text-sky-700 hover:bg-sky-100"
                        >
                          <Eye weight="bold" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={
                            normalizeWhatsAppNumber(ticket.customer_phone)
                              ? `Kirim WhatsApp ke ${ticket.customer_name}`
                              : `Nomor WhatsApp ${ticket.customer_name} tidak tersedia`
                          }
                          title={
                            normalizeWhatsAppNumber(ticket.customer_phone)
                              ? 'Kirim update status via WhatsApp'
                              : 'Nomor WhatsApp pelanggan tidak tersedia'
                          }
                          disabled={!normalizeWhatsAppNumber(ticket.customer_phone)}
                          onClick={() => openWhatsApp(ticket)}
                          className="size-8 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                        >
                          <WhatsappLogo weight="bold" className="size-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Aksi lain untuk ${ticket.ticket_code}`}
                              title="Aksi lainnya"
                              className="size-8 text-stone-600 hover:bg-stone-200"
                            >
                              <DotsThreeVertical weight="bold" className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onSelect={() => openAssignment(ticket)}>
                              <UserSwitch weight="bold" className="size-4 text-stone-500" />
                              Assign Teknisi
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openStatus(ticket)}>
                              <ArrowClockwise weight="bold" className="size-4 text-stone-500" />
                              Ubah Status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => void printTrackingQr(ticket)}>
                              <QrCode weight="bold" className="size-4 text-stone-500" />
                              Cetak QR Tracking
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => printReceipt(ticket)}>
                              <Receipt weight="bold" className="size-4 text-stone-500" />
                              Cetak Tanda Terima
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openInvoicePrint(ticket)}>
                              <FileText weight="bold" className="size-4 text-stone-500" />
                              Cetak Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {totalVisible === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <span className="block text-sm font-semibold text-neutral-900">
                        Tidak ada tiket yang cocok dengan filter ini
                      </span>
                      <span className="mt-1 block text-xs text-stone-500">
                        Kosongkan pencarian atau pilih “Status semua” untuk melihat 8 tiket terbaru.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setQuery('');
                          setStatusFilter('Semua');
                          setTechFilter('Semua');
                        }}
                      >
                        Reset filter
                      </Button>                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs leading-4">
              <span className="text-zinc-600">
                Menampilkan <span className="font-medium text-zinc-900">{totalVisible ? 1 : 0} - {totalVisible}</span> dari{' '}
                <span className="font-medium text-zinc-900">{tickets.length}</span> tiket aktif
              </span>
              <span className="hidden h-3 w-px bg-black/10 md:block" aria-hidden="true" />
              <span className="flex items-center gap-1.5">
                <span className="text-stone-400">Baris:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-stone-50 px-2 py-1 text-xs font-medium text-zinc-900 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      10
                      <CaretDown weight="bold" className="size-3.5 text-stone-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-32">
                    {[10, 25, 50].map((option) => (
                      <DropdownMenuItem key={option}>{option} baris</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled className="h-8 gap-1 text-xs font-medium">
                <CaretLeft weight="bold" className="size-3.5" /> Sebelumnya
              </Button>
              <span className="flex size-8 items-center justify-center rounded-lg bg-sky-600 text-xs font-semibold text-white">
                1
              </span>
              {[2, 3, 5].map((page) => (
                <button
                  key={page}
                  type="button"
                  disabled
                  title="Halaman contoh belum dimuat (data mock 8 tiket)"
                  className="flex size-8 items-center justify-center rounded-lg text-xs font-medium text-zinc-600 disabled:opacity-60"
                >
                  {page}
                </button>
              ))}
              <span className="w-6 text-center text-xs font-bold tracking-wider text-stone-400">...</span>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Halaman contoh belum dimuat (data mock 8 tiket)"
                className="h-8 gap-1 text-xs font-medium"
              >
                Berikutnya <CaretRight weight="bold" className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={Boolean(detailTicket)}
        onOpenChange={(open) => {
          if (!open) setDetailTicket(null);
        }}
      >
        <SheetContent side="right" className="w-full max-w-lg">
          <SheetHeader>
            <SheetTitle>Detail Tiket</SheetTitle>
            <SheetDescription>
              {detailTicket?.ticket_code} · {detailTicket?.customer_name ?? 'Pelanggan'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-tight',
                  detailStatus ? STATUS_STYLE[detailStatus as Status] : 'bg-stone-100 text-stone-600'
                )}
              >
                {detailStatus || '—'}
              </span>
              {detailTicket?.assignment_type && (
                <Badge variant={detailTicket.assignment_type === 'AUTO' ? 'default' : 'secondary'}>
                  {detailTicket.assignment_type === 'AUTO' ? 'Assigned by System' : 'Manual Override'}
                </Badge>
              )}
              <span className="text-xs text-stone-500">
                Dibuat {detailTicket?.created_at
                  ? new Date(detailTicket.created_at).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </span>
            </div>

            <section className="rounded-lg border border-stone-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Pelanggan &amp; layanan</h3>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-xs text-stone-500">Nama</span>
                  <span className="font-semibold text-neutral-900">{detailTicket?.customer_name ?? '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-stone-500">WhatsApp</span>
                  <span className="font-semibold text-neutral-900">{detailTicket?.customer_phone ?? '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-stone-500">Metode layanan</span>
                  <span className="font-semibold text-neutral-900">
                    {detailTicket?.service_method === 'dropoff'
                      ? 'Drop-off'
                      : detailTicket?.service_method === 'pickup_only'
                        ? 'Pick-up'
                        : 'Antar-Jemput'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-stone-500">Estimasi selesai</span>
                  <span className="font-semibold text-neutral-900">
                    {detailTicket?.estimated_done_at
                      ? new Date(detailTicket.estimated_done_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </section>

             <section className="rounded-lg border border-stone-200 p-4">
               <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Perangkat &amp; diagnosa</h3>
               <p className="mt-3 text-sm font-semibold text-neutral-900">{detailTicket?.device_label ?? '—'}</p>
               <p className="mt-1 text-sm leading-6 text-stone-600">{detailTicket?.complaint ?? 'Belum ada keluhan.'}</p>
             </section>

             <section className="rounded-lg border border-stone-200 p-4">
               <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Biaya</h3>
               <div className="mt-3 flex flex-col gap-2 text-sm">
                 <div className="flex justify-between gap-3">
                   <span className="text-stone-500">Estimasi Awal</span>
                   <span className="font-semibold text-neutral-900">
                     {detailTicket?.initial_estimate_cost != null
                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(detailTicket.initial_estimate_cost))

                       : 'Belum Ditentukan'}
                   </span>
                 </div>
                 <div className="flex justify-between gap-3">
                   <span className="text-stone-500">Biaya Final</span>
                   <span className="font-semibold text-neutral-900">
                     {detailTotal != null
                       ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(detailTotal))
                       : 'Belum Ditentukan'}
                   </span>
                 </div>
               </div>
             </section>


            <section className="rounded-lg border border-stone-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Tracking</h3>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-neutral-900">
                  {detailTicket?.tracking_code ?? detailTicket?.ticket_code}
                </span>
                <Link
                  to={`/tracking?resi=${encodeURIComponent(
                    detailTicket?.tracking_code ?? detailTicket?.ticket_code ?? ''
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Buka halaman tracking
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {detailLoading && <p className="text-xs text-stone-500">Memuat riwayat tracking...</p>}
                {detailTimeline.length > 0 ? (
                  detailTimeline.map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-xs">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-900">{entry.label}</span>
                          <span className="text-stone-400">
                            {entry.at
                              ? new Date(entry.at).toLocaleString('id-ID', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </span>
                        </div>
                        {entry.detail && <p className="mt-0.5 leading-5 text-stone-500">{entry.detail}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  !detailLoading && <p className="text-xs text-stone-500">Belum ada riwayat status atau penugasan.</p>
                )}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-lg border border-stone-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Teknisi</h3>
                <div className="mt-3 flex items-center gap-2">
                  <UserAvatar
                    seed={detailTicket?.technician_name ?? ''}
                    initials={detailTicket?.technician_initials ?? ''}
                    alt={`Avatar ${detailTicket?.technician_name ?? ''}`}
                    className="size-8"
                  />
                  <span className="text-sm font-semibold text-neutral-900">
                    {detailTicket?.technician_name ?? 'Belum ditugaskan'}
                  </span>
                </div>
                <span className="mt-2 block text-xs text-stone-500">
                  {detailTicket?.assigned_at
                    ? `Ditugaskan ${new Date(detailTicket.assigned_at).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}`
                    : 'Belum ada waktu penugasan'}
                </span>
              </section>

              <section className="rounded-lg border border-stone-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Biaya</h3>
                <p className="mt-3 text-base font-bold text-neutral-900">
                  {detailTotal == null
                    ? 'Belum ada biaya final'
                    : new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        maximumFractionDigits: 0,
                      }).format(detailTotal)}
                </p>
                <span className="mt-1 block text-xs text-stone-500">
                  {detailInvoice
                    ? `${detailInvoice.invoice_no} · ${detailInvoice.status}`
                    : 'Invoice belum dibuat'}
                </span>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(statusTicket)}
        onOpenChange={(open) => {
          if (!open) {
            setStatusTicket(null);
            setNextStatus('');
            setStatusNote('');
            setStatusError('');
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Ubah Status Tiket</SheetTitle>
            <SheetDescription>
              {statusTicket?.ticket_code} · {statusTicket?.customer_name ?? 'Pelanggan'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-stone-500">Status saat ini</span>
                <Badge variant="secondary">
                  {statusTicket ? DB_STATUS_MAP[statusTicket.current_status] ?? statusTicket.current_status : '—'}
                </Badge>
              </div>
            </div>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-neutral-900">Status baru</span>
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                disabled={statusMutation.isPending}
                className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:bg-stone-100"
              >
                {STATUS_DB_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-neutral-900">
                Catatan <span className="font-normal text-stone-400">(opsional)</span>
              </span>
              <textarea
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="Contoh: pelanggan menyetujui biaya tambahan."
                className="resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-stone-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>

            {statusError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {statusError}
              </p>
            )}

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusTicket(null)}
                disabled={statusMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!statusTicket || !nextStatus || nextStatus === statusTicket.current_status) return;
                  setStatusError('');
                  statusMutation.mutate({
                    ticketId: statusTicket.id,
                    toStatus: nextStatus,
                    note: statusNote.trim() || undefined,
                  });
                }}
                disabled={
                  !nextStatus || nextStatus === statusTicket?.current_status || statusMutation.isPending
                }
              >
                {statusMutation.isPending ? 'Menyimpan...' : 'Simpan status'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(assigningTicket)}
        onOpenChange={(open) => {
          if (!open) {
            setAssigningTicket(null);
            setSelectedTechnician('');
            setAssignReason('');
            setAssignError('');
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Ubah Teknisi</SheetTitle>
            <SheetDescription>
              {assigningTicket?.ticket_code} · {assigningTicket?.customer_name ?? 'Pelanggan'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-stone-500">Teknisi saat ini</span>
                <span className="font-semibold text-neutral-900">
                  {assigningTicket?.technician_name ?? 'Belum ditugaskan'}
                </span>
              </div>
              {assigningTicket?.assignment_type && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-stone-500">Metode penugasan</span>
                  <Badge variant={assigningTicket.assignment_type === 'AUTO' ? 'default' : 'secondary'}>
                    {assigningTicket.assignment_type === 'AUTO' ? 'Assigned by System' : 'Manual Override'}
                  </Badge>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-neutral-900">Teknisi pengganti</span>
              <select
                value={selectedTechnician}
                onChange={(event) => setSelectedTechnician(event.target.value)}
                disabled={assignmentOptions.length === 0 || assignMutation.isPending}
                className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:bg-stone-100"
              >
                <option value="">Pilih teknisi</option>
                {assignmentOptions.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name} · {technician.active_count} tiket aktif
                  </option>
                ))}
              </select>
              {assignmentOptions.length === 0 && (
                <span className="text-xs text-stone-500">
                  Tidak ada teknisi aktif lain yang bisa dipilih.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-neutral-900">
                Alasan override <span className="font-normal text-stone-400">(opsional)</span>
              </span>
              <textarea
                value={assignReason}
                onChange={(event) => setAssignReason(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="Contoh: teknisi spesialis iPhone / board repair."
                className="resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-stone-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
              <span className="text-right text-[10px] text-stone-400">{assignReason.length} / 500</span>
            </label>

            {assignError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {assignError}
              </p>
            )}

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssigningTicket(null)}
                disabled={assignMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!assigningTicket || !selectedTechnician) return;
                  setAssignError('');
                  assignMutation.mutate({
                    ticketId: assigningTicket.id,
                    technicianId: selectedTechnician,
                    note: assignReason.trim() || undefined,
                  });
                }}
                disabled={!selectedTechnician || assignMutation.isPending}
              >
                {assignMutation.isPending ? 'Menyimpan...' : 'Simpan penugasan'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
