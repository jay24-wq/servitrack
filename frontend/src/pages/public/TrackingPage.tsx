import { Cube, Ticket, MagnifyingGlass, Info, Copy, FilePdf, Circuitry, HourglassMedium, Microscope, Truck, ChatText, Laptop, ShieldCheck, Wrench, CheckCircle, Receipt, CaretDown, CaretUp } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTicketTracking } from '../../hooks/useTicketTracking';
import { cn } from '../../lib/utils';
import { getTicketProgress } from '../../lib/ticket-progress';
import type { TrackTimelineEvent } from '../../lib/api';

const STATUS_LABEL: Record<string, string> = {
  booking_created: 'Booking Servis Berhasil Dibuat',
  BOOKING_CREATED: 'Booking Servis Berhasil Dibuat',
  pickup_requested: 'Permintaan Pickup Diterima',
  PICKUP_REQUESTED: 'Permintaan Pickup Diterima',
  pickup_scheduled: 'Pickup Dijadwalkan',
  PICKUP_SCHEDULED: 'Pickup Dijadwalkan',
  pickup_confirmed: 'Pickup Dikonfirmasi',
  PICKUP_CONFIRMED: 'Pickup Dikonfirmasi',
  unit_received: 'Unit Diterima Cabang',
  UNIT_RECEIVED: 'Unit Diterima Cabang',
  ticket_issued: 'Tiket Servis Diterbitkan',
  TICKET_ISSUED: 'Tiket Servis Diterbitkan',
  cancelled: 'Dibatalkan',
  CANCELLED: 'Dibatalkan',
  no_show: 'Tidak Hadir',
  NO_SHOW: 'Tidak Hadir',
  antrian: 'Antrian',
  ANTRIAN: 'Antrian',
  pengecekan: 'Pengecekan',
  PENGECEKAN: 'Pengecekan',
  menunggu_part: 'Menunggu Sparepart',
  MENUNGGU_PART: 'Menunggu Sparepart',
  pengerjaan: 'Pengerjaan',
  PENGERJAAN: 'Pengerjaan',
  quality_check: 'Quality Check',
  QUALITY_CHECK: 'Quality Check',
  selesai: 'Servis Selesai',
  SELESAI: 'Servis Selesai',
  siap_diambil: 'Siap Diambil',
  SIAP_DIAMBIL: 'Siap Diambil',
};

// Chunking: 4 customer-facing phases. Internal statuses map into these.
type PhaseKey = 'booking' | 'diagnosa' | 'perbaikan' | 'selesai';

type PhaseConfig = {
  key: PhaseKey;
  title: string;
  steps: string[];
};

const PHASE_STATUS_MAP: Record<string, PhaseKey> = {
  booked: 'booking',
  arrived: 'booking',
  ticket_created: 'booking',
  booking_created: 'booking',
  unit_received: 'booking',
  ticket_issued: 'booking',
  antrian: 'booking',
  pengecekan: 'diagnosa',
  menunggu_part: 'perbaikan',
  pengerjaan: 'perbaikan',
  quality_check: 'perbaikan',
  selesai: 'selesai',
  siap_diambil: 'selesai',
};

const WORKFLOW_PHASES: PhaseConfig[] = [
  {
    key: 'booking',
    title: 'Booking',
    steps: ['booked', 'arrived', 'ticket_created', 'booking_created', 'unit_received', 'ticket_issued', 'antrian'],
  },
  {
    key: 'diagnosa',
    title: 'Diagnosa',
    steps: ['pengecekan'],
  },
  {
    key: 'perbaikan',
    title: 'Perbaikan',
    steps: ['menunggu_part', 'pengerjaan', 'quality_check'],
  },
  {
    key: 'selesai',
    title: 'Selesai',
    steps: ['selesai', 'siap_diambil'],
  },
];

function getPhaseForStatus(status: string | null | undefined): PhaseKey | null {
  if (!status) return null;
  return PHASE_STATUS_MAP[status.toLowerCase()] ?? null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function formatRupiah(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function eventLabel(event: TrackTimelineEvent) {
  return event.title || STATUS_LABEL[event.status] || event.status;
}

type PhaseState = 'done' | 'current' | 'upcoming';

const PHASE_ICON: Record<PhaseKey, React.ReactNode> = {
  booking: <Cube size={26} weight="fill" />,
  diagnosa: <MagnifyingGlass size={26} weight="bold" />,
  perbaikan: <Wrench size={26} weight="fill" />,
  selesai: <CheckCircle size={26} weight="fill" />,
};

function formatClock(value: string | null | undefined) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';
  } catch {
    return '';
  }
}

function PhaseBadge({ state, time }: { state: PhaseState; time?: string }) {
  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold outline outline-1 outline-offset-[-1px] outline-emerald-200/60">
        <CheckCircle size={12} weight="fill" />
        {time ? `Selesai ${time}` : 'Selesai'}
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-600 text-xs font-semibold outline outline-1 outline-offset-[-1px] outline-sky-600/20">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
        Proses
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-black/5 text-neutral-500 text-xs font-medium">
      Akan Datang
    </span>
  );
}

function PhaseNode({ phase, state, time, compact }: { phase: PhaseConfig; state: PhaseState; time?: string; compact?: boolean }) {
  const circleSize = compact ? 'w-10 h-10' : 'w-14 h-14';
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div
        className={cn(
          circleSize,
          'relative rounded-full flex items-center justify-center shadow-[0px_0px_0px_4px_white]',
          state === 'done' && 'bg-emerald-600 text-white',
          state === 'current' && 'bg-sky-600 text-white ring-4 ring-sky-100',
          state === 'upcoming' && 'bg-stone-100 text-neutral-500 outline outline-2 outline-offset-[-2px] outline-neutral-500/30'
        )}
      >
        {state === 'done' ? <CheckCircle size={compact ? 20 : 26} weight="fill" /> : PHASE_ICON[phase.key]}
        {state === 'current' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 border-2 border-white" />
        )}
      </div>
      <div className="flex flex-col items-center gap-1">
        <PhaseBadge state={state} time={time} />
        <span
          className={cn(
            'text-sm text-center leading-4',
            state === 'current' ? 'font-bold text-sky-700' : 'font-bold text-neutral-900'
          )}
        >
          {phase.title}
        </span>
      </div>
    </div>
  );
}

function PhaseBasedTracking({
  timeline,
  currentStatus,
  ticket,
}: {
  timeline: TrackTimelineEvent[];
  currentStatus: string;
  ticket: any;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const currentPhase = getPhaseForStatus(currentStatus);
  const phaseOrder = WORKFLOW_PHASES;
  const currentIdx = currentPhase ? phaseOrder.findIndex((p) => p.key === currentPhase) : -1;

  const getPhaseState = (phase: PhaseConfig): PhaseState => {
    const idx = phaseOrder.findIndex((p) => p.key === phase.key);
    if (currentIdx === -1) return 'upcoming';
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'current';
    return 'upcoming';
  };

  const getPhaseDoneTime = (phase: PhaseConfig) => {
    const phaseEvents = timeline.filter((e) => getPhaseForStatus(e.status) === phase.key);
    const last = phaseEvents[phaseEvents.length - 1];
    return last ? formatClock(last.createdAt) : undefined;
  };

  const progress = getTicketProgress(currentStatus);

  return (
    <div className="flex flex-col gap-6">
      {/* Horizontal phase stepper (tablet & desktop) */}
      <div className="relative py-2">
        <div className="hidden sm:block absolute top-9 left-[12.5%] right-[12.5%] h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-800 via-blue-600 to-sky-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="hidden sm:grid grid-cols-4 gap-6 relative">
          {phaseOrder.map((phase) => {
            const state = getPhaseState(phase);
            return (
              <PhaseNode
                key={phase.key}
                phase={phase}
                state={state}
                time={state === 'done' ? getPhaseDoneTime(phase) : undefined}
              />
            );
          })}
        </div>

        {/* Vertical stepper (mobile) */}
        <div className="sm:hidden flex flex-col">
          {phaseOrder.map((phase, idx) => {
            const state = getPhaseState(phase);
            return (
              <div key={phase.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      state === 'done' && 'bg-emerald-600 text-white',
                      state === 'current' && 'bg-sky-600 text-white ring-4 ring-sky-100',
                      state === 'upcoming' && 'bg-stone-100 text-neutral-500 outline outline-2 outline-offset-[-2px] outline-neutral-500/30'
                    )}
                  >
                    {state === 'done' ? <CheckCircle size={20} weight="fill" /> : PHASE_ICON[phase.key]}
                  </div>
                  {idx < phaseOrder.length - 1 && (
                    <div className={cn('w-0.5 h-10 my-1 rounded-full', state === 'done' ? 'bg-emerald-500' : 'bg-stone-200')} />
                  )}
                </div>
                <div className="flex-1 pt-1 pb-4">
                  <div className="text-sm font-bold text-neutral-900">{phase.title}</div>
                  <div className="mt-1">
                    <PhaseBadge state={state} time={state === 'done' ? getPhaseDoneTime(phase) : undefined} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current phase detail (progressive disclosure: only active phase) */}
      {currentPhase && (
        <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
          <div className="text-xs text-stone-500 mb-1">Status Saat Ini</div>
          <div className="text-base font-bold text-sky-700">
            {STATUS_LABEL[currentStatus] || ticket.currentStatusTitle || currentStatus}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {ticket.technicianName && (
              <span className="text-stone-600">
                Teknisi: <span className="text-neutral-900 font-medium">{ticket.technicianName}</span>
              </span>
            )}
            <span className="text-stone-600">
              Estimasi:{' '}
              <span className="text-neutral-900 font-medium">
                {ticket.estimatedDoneAt ? formatDateTime(ticket.estimatedDoneAt) : 'Menunggu estimasi teknisi'}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Full history (progressive disclosure) */}
      <div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-50 flex items-center justify-between transition"
        >
          <span>Riwayat Aktivitas</span>
          {showHistory ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </button>

        {showHistory && (
          <div className="mt-3 p-4 bg-white rounded-lg border border-stone-200">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-stone-200" />
              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <p className="text-stone-500 text-sm pl-8">Belum ada riwayat aktivitas.</p>
                ) : (
                  timeline.map((event, idx) => {
                    const isLast = idx === timeline.length - 1;
                    return (
                      <div key={idx} className="relative flex gap-3">
                        <div
                          className={cn(
                            'relative z-10 w-6 h-6 rounded-full flex items-center justify-center',
                            isLast ? 'bg-sky-600' : 'bg-emerald-600'
                          )}
                        >
                          {isLast ? (
                            <span className="text-white text-xs leading-none">→</span>
                          ) : (
                            <CheckCircle size={14} weight="fill" className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="text-sm font-medium text-neutral-900">{eventLabel(event)}</div>
                            <span className="text-xs text-stone-500">{formatDateTime(event.createdAt)}</span>
                          </div>
                          {event.note && <div className="text-xs text-stone-600 mt-1">{event.note}</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [searchParams] = useSearchParams();
  const resi = searchParams.get('resi');
  const [inputResi, setInputResi] = useState('');
  const { data, isLoading, isError } = useTicketTracking(resi);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputResi) {
      window.location.href = `/tracking?resi=${inputResi}`;
    }
  };

  const handleCopy = () => {
    if (!resi) return;
    navigator.clipboard.writeText(`${window.location.origin}/tracking?resi=${resi}`).catch(() => {});
  };

  if (!resi) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-stone-50">
        <Navbar />
        <main className="w-full min-h-screen pb-12 flex flex-col items-center pt-32 px-4">
          
          <div className="w-full max-w-4xl flex flex-col items-center text-center page-enter">
            
            {/* Icon dengan animasi */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-sky-200/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-sky-100 to-sky-50 rounded-3xl flex justify-center items-center shadow-lg border border-sky-100 float-soft">
                <Cube size={64} className="text-sky-600" weight="duotone" />
              </div>
            </div>

            <div className="max-w-2xl mb-10 reveal-up">
              <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4 leading-tight">
                Lacak Perbaikan Perangkat<br className="hidden sm:block"/> Secara Real-Time
              </h1>
              <p className="text-stone-600 text-lg leading-relaxed mb-6">
                Pantau status pengerjaan, telemetri teknisi, dan rincian biaya transparan langsung dari dashboard live tracking.
              </p>
              
              {/* Features badges */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <div className="px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-stone-700">Live Telemetri</span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <ShieldCheck size={16} className="text-sky-600" weight="fill" />
                  <span className="text-sm font-medium text-stone-700">Audit Trail</span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <ChatText size={16} className="text-amber-600" weight="fill" />
                  <span className="text-sm font-medium text-stone-700">Chat Teknisi</span>
                </div>
              </div>
            </div>

            {/* Search Form dengan styling menarik */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8 reveal-up">
              <div className="p-2 bg-white rounded-2xl shadow-xl border border-stone-200 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <input 
                    type="text" 
                    value={inputResi}
                    onChange={(e) => setInputResi(e.target.value)}
                    placeholder="Nomor Resi (contoh: SRV5839472610)"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border-0 rounded-xl text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 transition"
                  />
                </div>
                <button type="submit" className="px-8 py-4 bg-sky-600 hover:bg-sky-700 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition">
                  <MagnifyingGlass size={18} weight="bold" /> Lacak Sekarang
                </button>
              </div>
            </form>
            
            {/* Info box */}
            <div className="flex items-start gap-3 p-4 bg-sky-50/50 border border-sky-100 rounded-xl max-w-md text-left reveal-up">
              <Info size={20} className="text-sky-600 shrink-0 mt-0.5" weight="fill" />
              <div className="text-sm text-stone-600 leading-relaxed">
                Nomor resi diberikan langsung setelah booking dan dapat ditemukan di <span className="font-semibold text-sky-700">WhatsApp</span> atau <span className="font-semibold text-sky-700">email</span> Anda.
              </div>
            </div>

            {/* Bottom decoration */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl reveal-up">
              {[
                { icon: <Microscope size={24} weight="duotone" />, text: 'Live Mikroskop 45x' },
                { icon: <ShieldCheck size={24} weight="fill" />, text: 'Garansi 90 Hari' },
                { icon: <Truck size={24} weight="duotone" />, text: 'Track Kurir GPS' },
                { icon: <ChatText size={24} weight="fill" />, text: 'Chat Real-time' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-white/60 backdrop-blur rounded-xl border border-stone-100 flex flex-col items-center gap-2 hover:bg-white hover:shadow-md transition">
                  <div className="text-sky-600">{item.icon}</div>
                  <span className="text-xs font-medium text-stone-700 text-center">{item.text}</span>
                </div>
              ))}
            </div>

          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="w-full bg-white min-h-screen pb-12 flex flex-col items-center pt-32 px-4">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-2 border-sky-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-stone-600">Memuat data pelacakan...</p>
          </div>
        </main>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="w-full bg-white min-h-screen pb-12 flex flex-col items-center pt-32 px-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={32} className="text-red-600" weight="fill" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Tiket Tidak Ditemukan</h1>
            <p className="text-stone-600 mb-6">Nomor resi {resi} tidak ditemukan atau tidak valid.</p>
            <a href="/tracking" className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 inline-flex items-center gap-2">
              <Ticket size={18} /> Lacak Tiket Lain
            </a>
          </div>
        </main>
      </div>
    );
  }

  const ticket = data;
  const currentStatus = ticket.currentStatus;
  const timeline = [...(ticket.timeline || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  // STATE 2: Hasil Tracking
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full bg-white min-h-screen pb-12 flex flex-col items-center pt-20">
        
        {/* Breadcrumb & Top Bar */}
        <div className="w-full bg-white border-b border-black/10 flex justify-center page-enter">
          <div className="w-full max-w-7xl px-4 md:px-8 py-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a href="/" className="text-stone-500 hover:text-stone-800 transition">Beranda</a>
              <span className="text-stone-300">/</span>
              <span className="text-stone-500">Live Tracking</span>
              <span className="text-stone-300">/</span>
              <div className="px-2.5 py-0.5 bg-sky-50 border border-sky-100 rounded-md flex items-center gap-1.5">
                <span className="w-2 h-2 bg-sky-600 rounded-full"></span>
                <span className="text-sky-700 font-bold uppercase">{resi}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button onClick={handleCopy} className="px-3 py-1 bg-white border border-stone-200 rounded-md text-stone-600 text-[11px] font-medium hover:bg-stone-50 flex items-center gap-1.5">
                <Copy size={14} /> Salin Tautan
              </button>
              <button onClick={() => window.print()} className="px-3 py-1 bg-white border border-stone-200 rounded-md text-stone-600 text-[11px] font-medium hover:bg-stone-50 flex items-center gap-1.5">
                <FilePdf size={14} /> Unduh Resi PDF
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-7xl px-4 md:px-8 pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
        {/* Phase-based Tracking */}
        <div className="lg:col-span-3 bg-white p-5 md:p-6 rounded-xl shadow-sm border border-stone-200 flex flex-col gap-6 reveal-up">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-stone-100">
            <div>
              <h2 className="text-neutral-900 text-lg font-bold flex items-center gap-2">
                <div className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex justify-center items-center text-xs"><Circuitry size={14} weight="bold" /></div>
                Status Pengerjaan & Alur Telemetri Unit
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {ticket.currentStatusTitle || STATUS_LABEL[currentStatus] || currentStatus} • {ticket.trackingCode}
              </p>
            </div>
            <div className="px-4 py-2 bg-stone-50 rounded-lg border border-stone-100 flex items-center gap-2">
              <HourglassMedium size={16} className="text-emerald-600" weight="fill" />
              <span className="text-stone-500 text-xs">Estimasi Selesai:</span>
              <span className="text-neutral-900 text-xs font-bold">{ticket.estimatedDoneAt ? formatDateTime(ticket.estimatedDoneAt) : 'Menunggu estimasi teknisi'}</span>
            </div>
          </div>

          {/* Phase-based Tracking Component */}
          <PhaseBasedTracking
            timeline={timeline}
            currentStatus={currentStatus}
            ticket={ticket}
          />
        </div>

          {/* Device & service info */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 reveal-up">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Laptop className="text-sky-700" size={18} /> Detail Perangkat
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                    <Laptop size={20} className="text-stone-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{ticket.device?.brand} {ticket.device?.model}</p>
                    <p className="text-xs text-stone-500 capitalize">{ticket.device?.category}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">No. Seri</span>
                    <span className="text-neutral-900 font-medium">{ticket.device?.serialNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Cabang</span>
                    <span className="text-neutral-900">{ticket.branchName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Metode Servis</span>
                    <span className="text-neutral-900 capitalize">{ticket.serviceMethod?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Pelanggan</span>
                    <span className="text-neutral-900">{ticket.customerName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Dibuat</span>
                    <span className="text-neutral-900">{formatDateTime(ticket.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Receipt className="text-sky-700" size={18} /> Informasi Servis
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Status Saat Ini</span>
                  <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[10px] font-semibold">
                    {STATUS_LABEL[currentStatus] || currentStatus}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Nomor Resi</span>
                  <span className="text-neutral-900 font-mono font-semibold">{ticket.trackingCode}</span>
                </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-stone-500">Estimasi Awal</span>
                   <span className="text-neutral-900 font-medium">{ticket.initialEstimateCost != null ? formatRupiah(ticket.initialEstimateCost) : 'Belum Ditentukan'}</span>
                 </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-stone-500">Biaya Final</span>
                   <span className="text-neutral-900 font-medium">{ticket.finalCost != null ? formatRupiah(ticket.finalCost) : 'Belum Ditentukan'}</span>
                 </div>

                {ticket.completedAt && (
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Selesai Pada</span>
                    <span className="text-neutral-900">{formatDateTime(ticket.completedAt)}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-stone-100">
                  <p className="text-xs text-stone-500 mb-1">Keluhan</p>
                  <p className="text-xs text-neutral-900 leading-relaxed">{ticket.complaint}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
