import { useMemo, useState } from 'react';
import {
  CalendarBlank,
  Camera,
  CaretDown,
  CheckCircle,
  ClipboardText,
  Clock,
  Eye,
  MagnifyingGlass,
  NotePencil,
  Package,
  SealCheck,
  ShieldCheck,
  TrendUp,
} from '@phosphor-icons/react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import { Separator } from '../../components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import {
  SERVICE_HISTORY,
  HISTORY_END_STATUSES,
  SUCCESS_STATUSES,
  completedAtOf,
  type HistoryEndStatus,
  type ServiceHistory,
} from '../../data/serviceHistory';

type RangeKey = 'today' | 'week' | 'month' | 'custom';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: 'Minggu ini' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_TONE: Record<HistoryEndStatus, string> = {
  Selesai: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  'Siap Diambil': 'bg-sky-50 text-sky-700 outline-sky-200',
  'Batal / Ditolak': 'bg-rose-50 text-rose-700 outline-rose-200',
  Garansi: 'bg-amber-50 text-amber-700 outline-amber-200',
};

function fmtDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function fmtDays(entry: ServiceHistory) {
  if (entry.daysAgo === 0) return 'Hari ini';
  if (entry.daysAgo === 1) return 'Kemarin';
  return `${entry.daysAgo} hari lalu`;
}

function startOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function TechnicianHistoryPage() {
  const [now] = useState(() => new Date());

  const [range, setRange] = useState<RangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [status, setStatus] = useState<HistoryEndStatus | 'Semua'>('Semua');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<ServiceHistory | null>(null);

  // ---- KPI (keseluruhan, personal) ----
  const kpi = useMemo(() => {
    const total = SERVICE_HISTORY.length;
    const success = SERVICE_HISTORY.filter((e) => SUCCESS_STATUSES.includes(e.endStatus));
    const successRate = total > 0 ? Math.round((success.length / total) * 100) : 0;
    const avgMinutes = success.length > 0 ? Math.round(success.reduce((s, e) => s + e.repairMinutes, 0) / success.length) : 0;
    const garansi = SERVICE_HISTORY.filter((e) => e.endStatus === 'Garansi').length;
    return { total, done: success.length, successRate, avgHours: (avgMinutes / 60).toFixed(1), garansi };
  }, []);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const nowDate = now;
    const todayStart = startOfToday(nowDate);
    const weekAgo = new Date(nowDate.getTime() - 7 * 86400000);
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const to = customTo ? new Date(`${customTo}T23:59:59`) : null;

    return SERVICE_HISTORY.filter((entry) => {
      const date = completedAtOf(entry, nowDate);

      let inRange = true;
      if (range === 'today') inRange = date >= todayStart;
      else if (range === 'week') inRange = date >= weekAgo;
      else if (range === 'month') inRange = date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear();
      else {
        if (from && date < from) inRange = false;
        if (to && date > to) inRange = false;
      }
      if (!inRange) return false;

      if (status !== 'Semua' && entry.endStatus !== status) return false;

      if (keyword) {
        const haystack = `${entry.id} ${entry.customer} ${entry.serial} ${entry.device}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    }).sort((a, b) => completedAtOf(b, nowDate).getTime() - completedAtOf(a, nowDate).getTime());
  }, [range, customFrom, customTo, status, query, now]);

  const activeFilter = [status !== 'Semua' ? `Status: ${status}` : null, RANGES.find((r) => r.key === range)?.label].filter(Boolean);

  const cards = [
    { label: 'Total tiket selesai', value: kpi.done, note: 'Perangkat berhasil diperbaiki', icon: SealCheck, tile: 'bg-emerald-50 text-emerald-600', badge: 'Kumulatif', badgeTone: 'bg-emerald-50 text-emerald-700 outline-emerald-200' },
    { label: 'Tingkat keberhasilan', value: `${kpi.successRate}%`, note: 'Sukses vs batal/ditolak', icon: TrendUp, tile: 'bg-sky-50 text-sky-600', badge: `${kpi.done}/${kpi.total}`, badgeTone: 'bg-sky-50 text-sky-700 outline-sky-200' },
    { label: 'Rata-rata waktu', value: `${kpi.avgHours} jam`, note: 'Pengerjaan → selesai', icon: Clock, tile: 'bg-indigo-50 text-indigo-600', badge: 'Per unit', badgeTone: 'bg-indigo-50 text-indigo-700 outline-indigo-200' },
    { label: 'Klaim garansi / retur', value: kpi.garansi, note: 'Untuk evaluasi kualitas', icon: ShieldCheck, tile: 'bg-amber-50 text-amber-600', badge: 'Retur', badgeTone: 'bg-amber-50 text-amber-700 outline-amber-200' },
  ];

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Riwayat Servis Saya</h1>
        <p className="mt-0.5 text-sm leading-5 text-neutral-500">
          Ringkasan performa dan catatan lengkap tiket yang pernah Anda tangani.
        </p>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const CardIcon = card.icon;
          return (
            <div
              key={card.label}
              className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn('flex size-10 items-center justify-center rounded-lg', card.tile)}>
                  <CardIcon weight="fill" className="size-5" />
                </span>
                <span className={cn('rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase leading-4 outline outline-1', card.badgeTone)}>
                  {card.badge}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">{card.label}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold leading-9 tabular-nums text-zinc-900">{card.value}</span>
                  <span className="text-xs font-medium leading-4 text-stone-600">{card.note}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTERS */}
      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* time segmented */}
          <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-stone-100 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                  range === r.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-stone-600 hover:text-zinc-900'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Tanggal mulai"
                className="h-9 rounded-lg border border-black/10 bg-stone-100 px-2.5 text-xs text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
              />
              <span className="text-xs text-stone-400">s/d</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Tanggal akhir"
                className="h-9 rounded-lg border border-black/10 bg-stone-100 px-2.5 text-xs text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          )}

          {/* status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5 text-xs font-normal text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {status === 'Semua' ? 'Semua status akhir' : status}
                <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-stone-400">Status akhir</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setStatus('Semua')}>
                <span className={cn('flex-1', status === 'Semua' && 'font-bold text-sky-700')}>Semua status akhir</span>
              </DropdownMenuItem>
              {HISTORY_END_STATUSES.map((item) => (
                <DropdownMenuItem key={item} onSelect={() => setStatus(item)}>
                  <span className={cn('flex-1', status === item && 'font-bold text-sky-700')}>{item}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* search */}
          <div className="relative w-full lg:ml-auto lg:max-w-xs">
            <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari riwayat berdasarkan kode tiket, nama pelanggan, atau serial number"
              placeholder="Cari kode tiket / pelanggan / S/N..."
              className="h-auto rounded-lg border-black/10 bg-stone-100 py-2 pl-9 pr-3 text-xs text-zinc-900 caret-sky-600 shadow-none placeholder:text-neutral-500 focus-visible:border-sky-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 text-xs leading-4">
          <span className="text-neutral-500">Filter aktif:</span>
          <span className="font-bold text-zinc-900">{activeFilter.join(' · ')}</span>
          <span className="text-stone-400">·</span>
          <span className="text-neutral-500">
            Menampilkan <span className="font-bold text-zinc-900">{rows.length}</span> tiket
          </span>
        </div>
      </div>

      {/* TABLE */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-black/10 bg-white">
        <div className="ledger-scroll overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <caption className="sr-only">Riwayat servis teknisi beserta sparepart dan catatan final</caption>
            <thead>
              <tr className="border-b border-black/10 bg-stone-50">
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Tanggal selesai</th>
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Kode &amp; perangkat</th>
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Kerusakan / keluhan</th>
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Suku cadang</th>
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Catatan final diagnosis</th>
                <th scope="col" className="px-4 py-4 text-right text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id} className="border-t border-black/5 align-top transition-colors hover:bg-sky-50/40">
                  <td className="px-4 py-4">
                    <span className="block text-xs font-semibold text-zinc-900">{fmtDate(completedAtOf(entry, now))}</span>
                    <span className="mt-0.5 block text-[11px] text-stone-400">{fmtDays(entry)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="block font-mono text-xs font-semibold text-sky-600">{entry.id}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-zinc-900">{entry.device}</span>
                    <span className="block font-mono text-[10px] text-stone-400">S/N: {entry.serial}</span>
                    <span
                      className={cn(
                        'mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold outline outline-1',
                        STATUS_TONE[entry.endStatus]
                      )}
                    >
                      {entry.endStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-stone-700">{entry.complaint}</td>
                  <td className="px-4 py-4">
                    {entry.parts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.parts.map((part, idx) => (
                          <span
                            key={`${part.name}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700 outline outline-1 outline-black/5"
                          >
                            <Package weight="fill" className="size-2.5 text-stone-400" />
                            {part.name}
                            {part.qty > 1 ? ` ×${part.qty}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-stone-400">Tanpa suku cadang</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-stone-600">{entry.finalNote}</td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetail(entry)}
                      className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700"
                    >
                      <Eye weight="bold" className="size-3.5 text-neutral-500" /> Lihat detail
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <span className="block text-sm font-semibold text-neutral-900">Tidak ada riwayat pada filter ini</span>
                    <span className="mt-1 block text-xs text-neutral-500">
                      Coba ubah rentang waktu, status akhir, atau kata kunci pencarian.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HistoryDetailSheet entry={detail} onOpenChange={(open) => !open && setDetail(null)} now={now} />
    </div>
  );
}

interface DetailProps {
  entry: ServiceHistory | null;
  onOpenChange: (open: boolean) => void;
  now: Date;
}

function HistoryDetailSheet({ entry, onOpenChange, now }: DetailProps) {
  if (!entry) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  const done = completedAtOf(entry, now);
  const start = new Date(done.getTime() - entry.repairMinutes * 60000);
  const events = [
    { status: 'Check-in unit', at: start },
    { status: 'Pengecekan', at: new Date(start.getTime() + 15 * 60000) },
    { status: 'Pengerjaan', at: new Date(start.getTime() + 30 * 60000) },
    { status: 'Quality Check', at: new Date(done.getTime() - 15 * 60000) },
    { status: entry.endStatus, at: done },
  ];

  const photos: { label: string; kind: 'Check-in' | 'Progress' | 'Final' }[] = [
    { label: 'Check-in', kind: 'Check-in' },
    { label: 'Progress', kind: 'Progress' },
    { label: 'Final', kind: 'Final' },
  ];

  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-black/10 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold outline outline-1', STATUS_TONE[entry.endStatus])}>
              {entry.endStatus}
            </span>
            <span className="font-mono text-xs font-bold text-sky-600">{entry.id}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-zinc-900">{entry.device}</SheetTitle>
          <SheetDescription className="text-sm text-stone-500">
            {entry.customer} · S/N: {entry.serial} · Selesai {fmtDate(done)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-6">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <NotePencil weight="fill" className="size-4 text-sky-600" /> Keluhan Awal
            </h4>
            <p className="mt-2 rounded-xl border border-black/10 bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
              {entry.complaint}
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <CheckCircle weight="fill" className="size-4 text-sky-600" /> Final Diagnosis
            </h4>
            <p className="mt-2 rounded-xl border border-black/10 bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
              {entry.finalNote}
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <Package weight="fill" className="size-4 text-sky-600" /> Suku Cadang Terpasang
            </h4>
            {entry.parts.length > 0 ? (
              <ul className="mt-2 flex flex-col divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white">
                {entry.parts.map((part, idx) => (
                  <li key={`${part.name}-${idx}`} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-medium text-zinc-900">{part.name}</span>
                    <span className="text-xs font-semibold tabular-nums text-stone-500">{part.qty}×</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                Tidak ada suku cadang yang dipasang.
              </p>
            )}
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <Camera weight="fill" className="size-4 text-sky-600" /> Foto Bukti
            </h4>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.label}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border',
                    photo.kind === 'Final'
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-600'
                      : 'border-black/10 bg-stone-50 text-stone-400'
                  )}
                >
                  <Camera weight={photo.kind === 'Final' ? 'fill' : 'regular'} className="size-5" />
                  <span className="text-[10px] font-semibold">{photo.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-stone-400">
              Bukti foto check-in, progress, dan hasil akhir tersimpan pada arsip tiket.
            </p>
          </div>

          <Separator className="bg-black/10" />

          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <ClipboardText weight="fill" className="size-4 text-sky-600" /> Kronologi Status
            </h4>
            <ol className="mt-3 flex flex-col">
              {events.map((event, idx) => {
                const isLast = idx === events.length - 1;
                return (
                  <li key={event.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('flex size-5 items-center justify-center rounded-full', isLast ? 'bg-sky-600 text-white' : 'bg-stone-200 text-stone-500')}>
                        <CheckCircle weight="fill" className="size-3.5" />
                      </span>
                      {!isLast && <span className="my-0.5 w-px flex-1 bg-stone-200" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-semibold text-zinc-900">{event.status}</p>
                      <p className="text-[11px] text-stone-400">{fmtTime(event.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-stone-50 p-3 text-[11px] text-stone-500">
            <CalendarBlank weight="fill" className="size-3.5" />
            Total durasi pengerjaan: {Math.floor(entry.repairMinutes / 60)} jam {entry.repairMinutes % 60} menit
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
