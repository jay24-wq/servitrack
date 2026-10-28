import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarBlank,
  MagnifyingGlass,
  Package,
  SealCheck,
  Ticket,
  WarningCircle,
  ArrowRight,
  Clock,
} from '@phosphor-icons/react';

import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { getTechnicianDashboard } from '../../lib/api';
import { mapServiceTicketToQueueTicket } from '../../lib/mappers';
import { useAuthStore, useTicketStore } from '../../store';

const STATUS_TONE: Record<string, string> = {
  Antrian: 'bg-amber-50 text-amber-700 outline-amber-200',
  Pengecekan: 'bg-blue-50 text-sky-700 outline-blue-200',
  'Menunggu Part': 'bg-rose-50 text-rose-700 outline-rose-200',
  Pengerjaan: 'bg-sky-50 text-sky-700 outline-sky-200',
  'Quality Control': 'bg-indigo-50 text-indigo-700 outline-indigo-200',
  Selesai: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
};

function tanggalHariIni() {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export default function TechnicianDashboardPage() {
  const tickets = useTicketStore((s) => s.tickets);
  const setTickets = useTicketStore((s) => s.setTickets);
  const userName = useAuthStore((s) => s.user?.name) ?? '—';
  const [query, setQuery] = useState('');
  const [tanggal] = useState(tanggalHariIni);
  const [workload, setWorkload] = useState({ antrean: 0, prioritas: 0, menungguPart: 0, selesai: 0 });
  const [hasil, setHasil] = useState<typeof tickets>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getTechnicianDashboard(query.trim())
        .then((result) => {
          const mapped = result.tickets.map(mapServiceTicketToQueueTicket);
          setTickets(mapped);
          setHasil(mapped);
          setWorkload({
            antrean: result.stats.antrean,
            prioritas: result.stats.prioritas,
            menungguPart: result.stats.menunggu_part,
            selesai: result.stats.selesai,
          });
        })
        .catch(() => {
          setHasil([]);
          setWorkload({ antrean: 0, prioritas: 0, menungguPart: 0, selesai: 0 });
        });
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, setTickets]);

  const cards = [
    {
      label: 'Total antrean',
      value: workload.antrean,
      note: 'Tiket menunggu dikerjakan',
      icon: Ticket,
      tile: 'bg-blue-50 text-sky-600',
      badge: { text: 'Antrian', tone: 'bg-stone-100 text-stone-600 outline-black/10' },
    },
    {
      label: 'Prioritas / tenggat hari ini',
      value: workload.prioritas,
      note: 'Perlu penanganan lebih dulu',
      icon: WarningCircle,
      tile: 'bg-rose-50 text-rose-600',
      badge: { text: 'Urgent', tone: 'bg-rose-50 text-rose-700 outline-rose-200' },
    },
    {
      label: 'Menunggu part',
      value: workload.menungguPart,
      note: 'Tertahan menunggu suku cadang',
      icon: Package,
      tile: 'bg-amber-50 text-amber-600',
      badge: { text: 'Part hold', tone: 'bg-amber-50 text-amber-700 outline-amber-200' },
    },
    {
      label: 'Selesai hari ini',
      value: workload.selesai,
      note: 'Unit siap diserahkan',
      icon: SealCheck,
      tile: 'bg-emerald-50 text-emerald-600',
      badge: { text: 'Lunas', tone: 'bg-emerald-50 text-emerald-700 outline-emerald-200' },
    },
  ];

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">
            Selamat bertugas, {userName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Aktif On-Duty
            </Badge>
            <span className="text-xs font-medium text-stone-500">Shift Pagi · 08:30 – 17:30 WIB</span>
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <CalendarBlank weight="fill" className="size-3.5 text-stone-400" />
          <span className="text-xs font-medium tabular-nums text-zinc-900">{tanggal}</span>
        </span>
      </div>

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
                <span
                  className={cn(
                    'rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-tight outline outline-1',
                    card.badge.tone
                  )}
                >
                  {card.badge.text}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">
                  {card.label}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold leading-9 tabular-nums text-zinc-900">
                    {card.value}
                  </span>
                  <span className="text-xs font-medium leading-4 text-stone-600">{card.note}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-5 text-zinc-900">Quick Search</h2>
            <p className="text-xs leading-4 text-stone-600">
              Cari tiket berdasarkan kode tiket, serial number, atau tipe perangkat.
            </p>
          </div>
          <Link
            to="/technician/kanban"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-sky-600 transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Buka Kanban Board <ArrowRight weight="bold" className="size-3.5" />
          </Link>
        </div>

        <div className="relative mt-4">
          <MagnifyingGlass
            weight="bold"
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Cari tiket berdasarkan kode tiket, serial number, atau tipe perangkat"
            placeholder="Cari Kode Tiket / Serial Number / Tipe Perangkat..."
            className="h-11 rounded-lg border-stone-200 bg-stone-50 pl-10 pr-3 caret-sky-600 shadow-none placeholder:text-stone-400 focus-visible:border-sky-500"
          />
        </div>

        {query.trim() !== '' && (
          <div className="mt-4 flex flex-col divide-y divide-black/5 border-t border-black/5">
            {hasil.length > 0 ? (
              hasil.map((ticket) => (
                <Link
                  key={ticket.id}
                  to="/technician/kanban"
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500">
                    <Ticket weight="fill" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-sky-600">#{ticket.id}</span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-4 outline outline-1',
                          STATUS_TONE[ticket.status] ?? 'bg-stone-100 text-stone-600 outline-black/10'
                        )}
                      >
                        {ticket.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-zinc-900">
                      {ticket.device} <span className="font-normal text-stone-500">· {ticket.customer}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 text-[11px] text-stone-400 sm:flex">
                    <Clock className="size-3" /> {ticket.slaPrimary.replace('SLA: ', '')}
                  </span>
                  <ArrowRight weight="bold" className="size-4 shrink-0 text-stone-300" />
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-stone-500">
                Tidak ada tiket yang cocok dengan "{query.trim()}".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
