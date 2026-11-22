import { Cube, Ticket, MagnifyingGlass, Info, Copy, Circuitry, HourglassMedium, Microscope, Truck, ChatText, Laptop, ShieldCheck, Wrench, CheckCircle, Receipt, CaretDown, CaretUp } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTicketTracking } from '../../hooks/useTicketTracking';
import { cn } from '../../lib/utils';
import type { TrackTimelineEvent } from '../../lib/api';
import { getDeviceDisplayName } from '../../lib/mappers';
import {
  groupTrackingActivities,
  trackingActorLabel,
  trackingCompleted,
  trackingCurrentStage,
  trackingEventLabel,
  trackingProgressStages,
  TRACKING_STAGE_TITLES,
  type TrackingStage,
} from '../../lib/tracking-activity';

type PhaseConfig = { key: TrackingStage; title: string };

const PHASES: Record<TrackingStage, PhaseConfig> = {
  booking: { key: 'booking', title: TRACKING_STAGE_TITLES.booking },
  pickup: { key: 'pickup', title: TRACKING_STAGE_TITLES.pickup },
  diagnosa: { key: 'diagnosa', title: TRACKING_STAGE_TITLES.diagnosa },
  perbaikan: { key: 'perbaikan', title: TRACKING_STAGE_TITLES.perbaikan },
  pembayaran: { key: 'pembayaran', title: TRACKING_STAGE_TITLES.pembayaran },
  delivery: { key: 'delivery', title: TRACKING_STAGE_TITLES.delivery },
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function serviceMethodLabel(method: string) {
  if (method === 'pickup_delivery') return 'Jemput dan antar';
  if (method === 'pickup_only') return 'Jemput oleh kurir';
  if (method === 'dropoff') return 'Antar ke cabang';
  return 'Servis';
}

type PhaseState = 'done' | 'current' | 'upcoming';

const PHASE_ICON: Record<TrackingStage, React.ReactNode> = {
  booking: <Cube size={26} weight="fill" />,
  pickup: <Truck size={26} weight="fill" />,
  diagnosa: <MagnifyingGlass size={26} weight="bold" />,
  perbaikan: <Wrench size={26} weight="fill" />,
  pembayaran: <Receipt size={26} weight="fill" />,
  delivery: <CheckCircle size={26} weight="fill" />,
};

function formatClock(value: string | null | undefined) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';
  } catch {
    return '';
  }
}

/** Baris label-nilai. Nilai panjang (no. seri, nama) turun baris dan rata kanan, tidak menabrak label. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 text-xs">
      <span className="text-stone-500 shrink-0">{label}</span>
      <span className="text-neutral-900 text-right break-words min-w-0">{children}</span>
    </div>
  );
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
      <div className="flex flex-col items-center gap-1 text-center">
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
  serviceMethod,
}: {
  timeline: TrackTimelineEvent[];
  currentStatus: string;
  serviceMethod: string;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const groups = groupTrackingActivities(timeline, serviceMethod);
  const activities = groups.flatMap((group) => group.activities);
  const phaseOrder = trackingProgressStages(serviceMethod, timeline).map((stage) => PHASES[stage]);
  const currentStage = trackingCurrentStage(serviceMethod, currentStatus, timeline);
  const currentIdx = Math.max(0, phaseOrder.findIndex((phase) => phase.key === currentStage));
  const completed = trackingCompleted(timeline, serviceMethod);

  const getPhaseState = (phase: PhaseConfig): PhaseState => {
    const idx = phaseOrder.findIndex((p) => p.key === phase.key);
    if (completed) return 'done';
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'current';
    return 'upcoming';
  };

  const getPhaseDoneTime = (phase: PhaseConfig) => {
    const phaseEvents = activities.filter((event) => event.stage === phase.key);
    const last = phaseEvents[phaseEvents.length - 1];
    return last ? formatClock(last.createdAt) : undefined;
  };

  const progress = completed ? 100 : Math.round((currentIdx / Math.max(phaseOrder.length, 1)) * 100);
  const lineInset = `${50 / Math.max(phaseOrder.length, 1)}%`;
  const isLastActivity = (stageIndex: number, activityIndex: number) =>
    stageIndex === groups.length - 1 && activityIndex === groups[stageIndex].activities.length - 1;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="relative py-2">
        {/* Horizontal phase stepper (tablet & desktop) */}
        <div className="hidden sm:block absolute top-9 h-2 rounded-full bg-stone-200" style={{ left: lineInset, right: lineInset }}>
          <div
            className="h-full rounded-full bg-sky-600 transition-all duration-500 ease-out"
            style={{ width: `${completed ? 100 : Math.min(100, (currentIdx / Math.max(phaseOrder.length - 1, 1)) * 100)}%` }}
          />
        </div>
        <div className="relative hidden gap-2 sm:grid md:gap-6" style={{ gridTemplateColumns: `repeat(${phaseOrder.length}, minmax(0, 1fr))` }}>
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

        {/* Mobile: progress ringkas + vertical stepper */}
        <div className="sm:hidden flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-stone-500">Progres servis</span>
              <span className="font-bold text-sky-700">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col">
            {phaseOrder.map((phase, idx) => {
              const state = getPhaseState(phase);
              return (
                <div key={phase.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-10 h-10 shrink-0 rounded-full flex items-center justify-center',
                        state === 'done' && 'bg-emerald-600 text-white',
                        state === 'current' && 'bg-sky-600 text-white ring-4 ring-sky-100',
                        state === 'upcoming' && 'bg-stone-100 text-neutral-500 outline outline-2 outline-offset-[-2px] outline-neutral-500/30'
                      )}
                    >
                      {state === 'done' ? <CheckCircle size={20} weight="fill" /> : PHASE_ICON[phase.key]}
                    </div>
                    {idx < phaseOrder.length - 1 && (
                      <div className={cn('w-0.5 flex-1 min-h-6 my-1 rounded-full', state === 'done' ? 'bg-emerald-500' : 'bg-stone-200')} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1 pb-4">
                    <div className={cn('text-sm font-bold', state === 'current' ? 'text-sky-700' : 'text-neutral-900')}>{phase.title}</div>
                    <div className="mt-1">
                      <PhaseBadge state={state} time={state === 'done' ? getPhaseDoneTime(phase) : undefined} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Riwayat dikelompokkan berdasarkan tahap servis. */}
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
          <div className="mt-3 p-3 sm:p-4 bg-white rounded-lg border border-stone-200">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-stone-200" />
              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <p className="text-stone-500 text-sm pl-8">Belum ada riwayat aktivitas.</p>
                ) : (
                  <div className="space-y-6">
                    {groups.map((group, groupIndex) => (
                      <section key={group.stage} aria-labelledby={`tracking-stage-${group.stage}`}>
                        <h3 id={`tracking-stage-${group.stage}`} className="mb-3 pl-8 text-xs font-bold uppercase tracking-wide text-stone-500">{group.title}</h3>
                        <div className="space-y-3">
                          {group.activities.map((event, activityIndex) => {
                            const isLast = isLastActivity(groupIndex, activityIndex);
                            const actor = trackingActorLabel(event);
                            return (
                              <div key={`${event.status}-${event.createdAt}-${activityIndex}`} className="relative flex gap-3">
                                <div className={cn('relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full', isLast ? 'bg-sky-600' : 'bg-emerald-600')}>
                                  {isLast ? <span className="text-xs leading-none text-white">→</span> : <CheckCircle size={14} weight="fill" className="text-white" />}
                                </div>
                                <div className="min-w-0 flex-1 pb-2">
                                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
                                    <div className="break-words text-sm font-medium text-neutral-900">{trackingEventLabel(event)}</div>
                                    <span className="text-xs text-stone-500">{formatDateTime(event.createdAt)}</span>
                                  </div>
                                  {actor && <div className="mt-1 break-words text-xs text-stone-600">{actor}</div>}
                                  {event.note && <div className="mt-1 break-words text-xs text-stone-600">Alasan umum: {event.note}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
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
        <main className="w-full min-h-screen pb-12 flex flex-col items-center pt-28 sm:pt-32 px-4">

          <div className="w-full max-w-4xl flex flex-col items-center text-center page-enter">

            {/* Icon dengan animasi */}
            <div className="relative mb-6 sm:mb-8">
              <div className="absolute inset-0 bg-sky-200/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-sky-100 to-sky-50 rounded-3xl flex justify-center items-center shadow-lg border border-sky-100 float-soft">
                <Cube className="w-12 h-12 sm:w-16 sm:h-16 text-sky-600" weight="duotone" />
              </div>
            </div>

            <div className="max-w-2xl mb-8 sm:mb-10 reveal-up">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-900 mb-3 sm:mb-4 leading-tight">
                Lacak Perbaikan Perangkat<br className="hidden sm:block"/> Secara Real-Time
              </h1>
              <p className="text-stone-600 text-base sm:text-lg leading-relaxed mb-5 sm:mb-6">
                Pantau tahapan servis dan perjalanan perangkat dalam satu halaman pelacakan.
              </p>

              {/* Features badges */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                <div className="px-3 sm:px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium text-stone-700">Pembaruan Langsung</span>
                </div>
                <div className="px-3 sm:px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <ShieldCheck size={16} className="text-sky-600" weight="fill" />
                  <span className="text-xs sm:text-sm font-medium text-stone-700">Riwayat Aktivitas</span>
                </div>
                <div className="px-3 sm:px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm flex items-center gap-2">
                  <Wrench size={16} className="text-amber-600" weight="fill" />
                  <span className="text-xs sm:text-sm font-medium text-stone-700">Petugas Servis</span>
                </div>
              </div>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-6 sm:mb-8 reveal-up">
              <div className="p-2 bg-white rounded-2xl shadow-xl border border-stone-200 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <input
                    type="text"
                    value={inputResi}
                    onChange={(e) => setInputResi(e.target.value)}
                    placeholder="Nomor Resi (contoh: SRV5839472610)"
                    required
                    className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-stone-50 border-0 rounded-xl text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 transition"
                  />
                </div>
                <button type="submit" className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-sky-600 hover:bg-sky-700 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shadow-lg hover:shadow-xl transition">
                  <MagnifyingGlass size={18} weight="bold" /> Lacak Sekarang
                </button>
              </div>
            </form>

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 bg-sky-50/50 border border-sky-100 rounded-xl w-full max-w-md text-left reveal-up">
              <Info size={20} className="text-sky-600 shrink-0 mt-0.5" weight="fill" />
              <div className="text-sm text-stone-600 leading-relaxed">
                Nomor resi diberikan langsung setelah booking dan dapat ditemukan di <span className="font-semibold text-sky-700">WhatsApp</span> atau <span className="font-semibold text-sky-700">email</span> Anda.
              </div>
            </div>

            {/* Bottom decoration */}
            <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-3xl reveal-up">
              {[
                { icon: <Microscope size={24} weight="duotone" />, text: 'Live Mikroskop 45x' },
                { icon: <ShieldCheck size={24} weight="fill" />, text: 'Garansi 90 Hari' },
                { icon: <Truck size={24} weight="duotone" />, text: 'Track Kurir GPS' },
                { icon: <ChatText size={24} weight="fill" />, text: 'Chat Real-time' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 sm:p-4 bg-white/60 backdrop-blur rounded-xl border border-stone-100 flex flex-col items-center gap-2 hover:bg-white hover:shadow-md transition">
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
        <main className="w-full bg-white min-h-screen pb-12 flex flex-col items-center pt-28 sm:pt-32 px-4">
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
        <main className="w-full bg-white min-h-screen pb-12 flex flex-col items-center pt-28 sm:pt-32 px-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={32} className="text-red-600" weight="fill" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Tiket Tidak Ditemukan</h1>
            <p className="text-stone-600 mb-6 break-words">Nomor resi {resi} tidak ditemukan atau tidak valid.</p>
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
          <div className="w-full max-w-7xl px-4 md:px-8 py-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">

            <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
              <a href="/" className="text-stone-500 hover:text-stone-800 transition">Beranda</a>
              <span className="text-stone-300">/</span>
                <span className="text-stone-500">Pelacakan</span>
              <span className="text-stone-300">/</span>
              <div className="px-2.5 py-0.5 bg-sky-50 border border-sky-100 rounded-md flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 shrink-0 bg-sky-600 rounded-full"></span>
                <span className="text-sky-700 font-bold uppercase break-all">{resi}</span>
              </div>
            </div>

            {/* Mobile: dua tombol sama lebar. Desktop: rata kanan seperti semula */}
            <div className="w-full md:w-auto grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 md:gap-3">
              <button onClick={handleCopy} className="px-3 py-2 md:py-1 bg-white border border-stone-200 rounded-md text-stone-600 text-[11px] font-medium hover:bg-stone-50 flex items-center justify-center gap-1.5">
                <Copy size={14} /> Salin Tautan
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-7xl px-4 md:px-8 pt-4 sm:pt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Phase-based Tracking */}
          <div className="lg:col-span-3 bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-stone-200 flex flex-col gap-5 sm:gap-6 reveal-up">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 md:gap-4 pb-4 border-b border-stone-100">
              <div className="min-w-0">
                <h2 className="text-neutral-900 text-base sm:text-lg font-bold flex items-start sm:items-center gap-2">
                  <div className="w-6 h-6 shrink-0 bg-sky-100 text-sky-600 rounded-full flex justify-center items-center text-xs"><Circuitry size={14} weight="bold" /></div>
                  <span className="leading-snug">Status Pengerjaan & Alur Telemetri Unit</span>
                </h2>
                <p className="text-stone-500 text-xs mt-1 break-words">
                  {ticket.currentStatusTitle || trackingEventLabel({ status: currentStatus })} • {ticket.trackingCode}
                </p>
              </div>
              <div className="w-full md:w-auto px-3 sm:px-4 py-2 bg-stone-50 rounded-lg border border-stone-100 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <HourglassMedium size={16} className="text-emerald-600 shrink-0" weight="fill" />
                <span className="text-stone-500 text-xs">Estimasi Selesai:</span>
                <span className="text-neutral-900 text-xs font-bold">{ticket.estimatedDoneAt ? formatDateTime(ticket.estimatedDoneAt) : 'Menunggu estimasi teknisi'}</span>
              </div>
            </div>

            {/* Phase-based Tracking Component */}
            <PhaseBasedTracking
              timeline={timeline}
              currentStatus={currentStatus}
              serviceMethod={ticket.serviceMethod}
            />
          </div>

          {/* Device & service info */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 reveal-up">
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Laptop className="text-sky-700" size={18} /> Detail Perangkat
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 bg-stone-100 rounded-lg flex items-center justify-center">
                    <Laptop size={20} className="text-stone-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 break-words">{getDeviceDisplayName(ticket.device?.model)}</p>
                    <p className="text-xs text-stone-500 capitalize">{ticket.device?.category}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <InfoRow label="Cabang">{ticket.branchName}</InfoRow>
                <InfoRow label="Metode Servis">{serviceMethodLabel(ticket.serviceMethod)}</InfoRow>
                  <InfoRow label="Dibuat">{formatDateTime(ticket.createdAt)}</InfoRow>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Receipt className="text-sky-700" size={18} /> Informasi Servis
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-4 text-xs">
                  <span className="text-stone-500 shrink-0">Status Saat Ini</span>
                  <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[10px] font-semibold text-right">
                    {ticket.currentStatusTitle || trackingEventLabel({ status: currentStatus })}
                  </span>
                </div>
                <InfoRow label="Nomor Resi"><span className="font-mono font-semibold">{ticket.trackingCode}</span></InfoRow>
                {ticket.completedAt && (
                  <InfoRow label="Selesai Pada">{formatDateTime(ticket.completedAt)}</InfoRow>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
