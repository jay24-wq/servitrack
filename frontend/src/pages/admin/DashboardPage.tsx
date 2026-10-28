import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../lib/api';
import {
  CalendarBlank,
  ArrowsClockwise,
  Ticket,
  Package,
  SealCheck,
  ChartLineUp,
  CaretDown,
  ArrowRight,
  TrendUp,
  WarningCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { CartesianGrid, Dot, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '../../components/ui/button';
import { UserAvatar } from '../../components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { initialsOf } from '../../lib/avatar';

const WEEK = [
  { day: 'Sun', masuk: 4, selesai: 3 },
  { day: 'Mon', masuk: 12, selesai: 10 },
  { day: 'Tue', masuk: 9, selesai: 8 },
  { day: 'Wed', masuk: 15, selesai: 13 },
  { day: 'Thu', masuk: 11, selesai: 10 },
  { day: 'Fri', masuk: 18, selesai: 15 },
  { day: 'Sat', masuk: 22, selesai: 18 },
];

const MONTH = Array.from({ length: 30 }, (_, i) => {
  const base = WEEK[i % 7].masuk;
  const wobble = ((i * 7) % 5) - 2;
  const masuk = Math.max(0, base + wobble);
  return { day: `H${i + 1}`, masuk, selesai: Math.max(0, masuk - 2) };
});

const LOG = [
  {
    id: '#SRV4829103756',
    chip: 'Diagnosa',
    chipTone: 'bg-blue-50 text-sky-600 outline-blue-200',
    time: '15 menit lalu',
    title: 'Pengecekan IC Power & Jalur VCore',
    device: 'ASUS ROG Zephyrus',
    actorInitials: 'PS',
    actorTone: 'bg-blue-600',
    actor: 'Teknisi Panendra Soma',
  },
  {
    id: '#SRV7312049865',
    chip: 'Otorisasi',
    chipTone: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
    time: '1 jam lalu',
    title: 'Penggantian Part disetujui pelanggan via WA',
    device: 'ASUS ZenBook 14',
    actorInitials: 'WA',
    actorTone: 'bg-emerald-600',
    actor: 'Konfirmasi pelanggan',
  },
  {
    id: '#SRV6550183927',
    chip: 'QC Passed',
    chipTone: 'bg-indigo-50 text-indigo-700 outline-indigo-200',
    time: '1 hari lalu',
    title: 'Inspeksi lolos & masuk rak siap ambil',
    device: 'ASUS VivoBook Pro',
    actorInitials: 'GM',
    actorTone: 'bg-stone-800',
    actor: 'QC Gilang M.',
  },
];

const BENCH = [
  { name: 'Panendra Soma', status: 'bg-emerald-500' },
  { name: 'Andhika Rai', status: 'bg-emerald-500' },
  { name: 'Reza Pratama', status: 'bg-amber-400' },
];



function tanggalHariIni() {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

interface SeriesDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number;
  dataLength?: number;
  stroke?: string;
  [key: string]: unknown;
}

function SeriesDot({ cx, cy, index, dataLength = 7, stroke, ...rest }: SeriesDotProps) {
  const isLast = index === dataLength - 1;
  return (
    <Dot
      {...rest}
      cx={cx}
      cy={cy}
      r={isLast ? 4.5 : 2.75}
      fill={isLast ? stroke : '#ffffff'}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

function angka(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export default function DashboardPage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [synced, setSynced] = useState(false);
  const [tanggal] = useState(tanggalHariIni);

  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

  const ticketNew = dashboard?.ticketNew ?? 0;
  const waitingParts = dashboard?.waitingParts ?? 0;
  const completedToday = dashboard?.completedToday ?? 0;
  const revenueMtd = dashboard?.revenueMtd ?? 0;
  const recentLogs = dashboard?.recentLogs ?? LOG;
  const bench = dashboard?.bench ?? BENCH;
  const lowStock = dashboard?.lowStock;
  const activeTechnicians = dashboard?.activeTechnicians ?? 0;
  const totalActiveTickets = dashboard?.totalActiveTickets ?? 0;


  const ranges = [
    { key: '7d' as const, label: '7 hari terakhir', data: dashboard?.trend7 ?? WEEK },
    { key: '30d' as const, label: '30 hari terakhir', data: dashboard?.trend30 ?? MONTH },
  ];
  const active = ranges.find((item) => item.key === range) ?? ranges[0];

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Ringkasan Dashboard</h1>
          <p className="mt-1 text-xs leading-4 text-stone-600">
            Selamat datang kembali. Berikut adalah ikhtisar real-time aktivitas bengkel hari ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <CalendarBlank weight="fill" className="size-3.5 text-stone-400" />
            <span className="text-xs font-medium tabular-nums text-zinc-900">{tanggal}</span>
          </span>
          <button
            type="button"
            onClick={() => setSynced((value) => !value)}
            aria-pressed={synced}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
              synced
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-blue-200 bg-indigo-50 text-sky-600 hover:bg-sky-100'
            )}
          >
            {synced ? (
              <SealCheck weight="fill" className="size-3.5" />
            ) : (
              <ArrowsClockwise weight="bold" className="size-3.5" />
            )}
            <span className="text-xs font-medium">{synced ? 'Data tersinkron' : 'Sinkron Data'}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-sky-600">
              <Ticket weight="fill" className="size-5" />
            </span>
            <span className="rounded-sm bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-tight text-rose-700 outline outline-1 outline-rose-200">
              Perlu tindakan
            </span>
          </div>
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">Tiket baru</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold leading-9 tabular-nums text-zinc-900">{ticketNew}</span>
              <span className="text-xs font-medium text-stone-600">Tiket unassigned</span>
            </p>
          </div>
          <div className="mt-4 border-t border-black/10 pt-3">
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full w-24 rounded-full bg-sky-600" />
            </span>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs leading-4 text-stone-400">Batas respon: &lt; 30 mnt</span>
              <Button variant="ghost" size="sm" className="h-auto gap-1.5 px-2 py-1 text-xs text-sky-600" asChild>
                <Link to="/queue?status=Antrian">
                  Alokasi sekarang <ArrowRight weight="bold" className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Package weight="fill" className="size-5" />
            </span>
            <span className="rounded-sm bg-stone-100 px-2 py-0.5 text-[10px] font-medium leading-4 text-stone-600 outline outline-1 outline-black/10">
              Logistik
            </span>
          </div>
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">Menunggu part</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold leading-9 tabular-nums text-zinc-900">{waitingParts}</span>
              <span className="text-xs font-medium text-stone-600">Tiket tertunda</span>
            </p>
          </div>
          <div className="mt-4 border-t border-black/10 pt-3">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" /> 0 approval WA
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" /> 0 indent part
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <SealCheck weight="fill" className="size-5" />
            </span>
            <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-[10px] font-medium leading-4 text-emerald-700 outline outline-1 outline-emerald-200">
              QC passed
            </span>
          </div>
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">Selesai hari ini</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold leading-9 tabular-nums text-zinc-900">{completedToday}</span>
              <span className="text-xs font-medium text-emerald-700">Perangkat siap diambil</span>
            </p>
          </div>
          <div className="mt-4 border-t border-black/10 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-normal leading-4 text-stone-600">
                6 sudah terkirim notifikasi WA
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-[10px] font-semibold uppercase leading-4 text-emerald-700"
                asChild
              >
                <Link to="/queue?status=Selesai">
                  Kirim reminder <ArrowRight weight="bold" className="size-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ChartLineUp weight="fill" className="size-5" />
            </span>
            <span className="rounded-sm bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-indigo-700 outline outline-1 outline-indigo-200">
              Target 84%
            </span>
          </div>
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">
              Pendapatan servis MTD
            </p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-xs font-normal text-stone-600">Rp</span>
              <span className="text-2xl font-semibold leading-8 tabular-nums text-zinc-900">
                {angka(revenueMtd)}
              </span>
            </p>
          </div>
          <div className="mt-4 border-t border-black/10 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-normal leading-4 text-stone-600">
                +14,2% dibanding pekan lalu
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendUp weight="bold" className="size-3.5" /> Sehat
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="rounded-xl border border-black/10 bg-white p-6 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-5 text-zinc-900">Tren Perbaikan</h2>
                <p className="text-xs leading-4 text-stone-600">
                  Volume unit masuk dan selesai {active.label}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {active.label.charAt(0).toUpperCase() + active.label.slice(1)}
                    <CaretDown weight="bold" className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {ranges.map((item) => (
                    <DropdownMenuItem key={item.key} onSelect={() => setRange(item.key)}>
                      <span className={cn('flex-1', item.key === range && 'font-bold text-sky-700')}>
                        {item.label.charAt(0).toUpperCase() + item.label.slice(1)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="h-44 w-full sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={active.data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e7e5e4" strokeDasharray="4 6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={{ stroke: '#e7e5e4' }}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#78716c', fontWeight: 600 }}
                    tickFormatter={(value: string) => value.toUpperCase()}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    width={34}
                    tickCount={5}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: '#bae6fd', strokeWidth: 1 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e7e5e4',
                      boxShadow: '0 8px 20px -12px rgba(28,25,23,0.35)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                    labelFormatter={(value) => String(value).toUpperCase()}
                  />
                  <Line
                    type="monotone"
                    dataKey="masuk"
                    name="Unit masuk"
                    stroke="#0284c7"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={<SeriesDot dataLength={active.data.length} />}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="selesai"
                    name="Unit selesai"
                    stroke="#a8a29e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                    dot={<SeriesDot dataLength={active.data.length} />}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-stone-600">
                  <span className="size-2.5 rounded-sm bg-sky-600" /> Unit masuk
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-stone-600">
                  <span className="size-2.5 rounded-sm bg-stone-300" /> Unit selesai
                </span>
              </div>
              <span className="text-xs font-normal tabular-nums text-stone-600">
                Rata-rata turnaround: <span className="text-zinc-900">2,4 hari</span>
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold leading-5 text-zinc-900">Log Aktivitas Terbaru</h2>
                <span className="relative flex size-2 items-center justify-center" aria-hidden="true">
                  <span className="absolute size-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="size-2 rounded-full bg-emerald-500" />
                </span>
              </div>
              <span className="text-xs font-normal text-stone-400">Real-time feed</span>
            </div>

            <ul className="flex flex-col">
              {recentLogs.map((entry: any, index: number) => (
                <li
                  key={entry.id}
                  className={cn('flex flex-col gap-1.5 px-2 py-3', index > 0 && 'border-t border-black/10')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-sm px-2 py-0.5 text-[10px] font-semibold leading-4 outline outline-1',
                          entry.chipTone
                        )}
                      >
                        {entry.chip}
                      </span>
                      <span className="font-mono text-xs font-semibold text-sky-600">{entry.id}</span>
                    </div>
                    <span className="shrink-0 text-[10px] font-normal text-stone-400">{entry.time}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 pl-0.5">
                    <p className="text-xs font-medium leading-5 text-zinc-900">
                      {entry.title} <span className="font-normal text-stone-600">({entry.device})</span>
                    </p>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded-full pb-0.5 pt-[0.25px] text-[9px] font-semibold leading-3 text-white',
                          entry.actorTone
                        )}
                      >
                        {entry.actorInitials}
                      </span>
                      <span className="text-xs font-normal text-stone-600">{entry.actor}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2 border-t border-black/10 pt-3">
              <Link
                to="/reports?tab=audit"
                className="block rounded-lg bg-stone-100 px-3 py-2 text-center text-xs font-medium text-zinc-900 outline outline-1 outline-black/10 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Buka log audit lengkap (48 aktivitas)
              </Link>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <div className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 outline outline-1 outline-rose-200">
                <WarningCircle weight="fill" className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold leading-5 text-zinc-900">Stok Hampir Habis</h2>
                  <span className="rounded-sm bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                    Prioritas tinggi
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  1 komponen kritis perlu segera restock untuk menghindari delay pengerjaan.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5">
                   <span className="text-xs font-semibold text-zinc-900">{lowStock?.name ?? '-'}</span>
                   <span className="text-stone-400">|</span>
                   <span className="text-xs font-medium text-rose-600">Sisa: {lowStock?.remaining ?? 0} unit</span>
                   <span className="text-stone-400">|</span>
                   <span className="text-xs font-normal text-stone-600">Min: {lowStock?.min ?? 0} unit</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
              <span className="text-xs font-normal text-stone-400">
                Distributor: Jaya Micro Jakarta (ready stock)
              </span>
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-black" asChild>
                <Link to="/inventory?status=Menipis">Pesan sekarang</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-5 text-zinc-900">Kapasitas Teknisi</h2>
                <p className="mt-0.5 text-xs leading-4 text-stone-600">
                  {activeTechnicians} teknisi aktif ({totalActiveTickets} tiket aktif)
                </p>
              </div>
              <span className="rounded-sm bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 outline outline-1 outline-emerald-200">
                85% bench load
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex -space-x-2">
                {bench.map((person: any) => (
                  <span key={person.name} className="relative">
                    <UserAvatar
                      seed={person.name}
                      initials={initialsOf(person.name)}
                      alt={`Avatar ${person.name}`}
                      className="size-10 ring-2 ring-white"
                    />
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 size-3 rounded-full border-2 border-white',
                        person.status
                      )}
                      aria-hidden="true"
                    />
                  </span>
                ))}
                <span
                  className="flex size-10 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-400 ring-2 ring-white"
                  aria-label="1 teknisi lain di luar shift"
                >
                  +1
                </span>
              </div>

              <div className="min-w-0 border-l border-black/10 pl-3">
                <span className="inline-flex items-center gap-2">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    <span className="size-2.5 rounded-full bg-amber-400" />
                  </span>
                  <span className="text-xs font-medium text-stone-600">Bench utilization optimal</span>
                </span>
                <p className="text-[10px] font-normal leading-4 text-stone-400">
                  Estimasi beban hari ini: 11 tiket terselesaikan
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
              <span className="text-xs font-normal text-stone-400">Shift: Pagi (08:30 – 17:30)</span>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <UsersThree weight="fill" className="size-4" /> Kelola penugasan bench
                <ArrowRight weight="bold" className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
