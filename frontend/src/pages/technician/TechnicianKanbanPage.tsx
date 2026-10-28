import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  WarningCircle,
} from '@phosphor-icons/react';

import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { useTicketStore, FLOW_STAGES, type QueueStatus } from '../../store';
import { getTechnicianDashboard, updateTicketStatus } from '../../lib/api';
import { mapServiceTicketToQueueTicket } from '../../lib/mappers';
import TicketDetailSheet from './TicketDetailSheet';

const STATUS_ACCENT: Record<QueueStatus, string> = {
  Antrian: 'bg-amber-500',
  Pengecekan: 'bg-sky-500',
  'Menunggu Part': 'bg-rose-500',
  Pengerjaan: 'bg-sky-600',
  'Quality Control': 'bg-indigo-500',
  Selesai: 'bg-emerald-500',
};

export default function TechnicianKanbanPage() {
  const tickets = useTicketStore((s) => s.tickets);
  const setTickets = useTicketStore((s) => s.setTickets);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const [query, setQuery] = useState('');
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<QueueStatus | null>(null);

  const filtered = tickets;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getTechnicianDashboard(query.trim())
        .then((result) => setTickets(result.tickets.map(mapServiceTicketToQueueTicket)))
        .catch(() => setTickets([]));
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, setTickets]);

  const handleDrop = async (status: QueueStatus, event: React.DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (id) {
      const dbStatus = status === 'Pengecekan' ? 'pengecekan' : status === 'Menunggu Part' ? 'menunggu_part' : status === 'Quality Control' ? 'quality_check' : status.toLowerCase();
      try {
        await updateTicketStatus(id, dbStatus);
        updateTicket(id, { status });
      } catch {
        // Keep the card in its current column when the database rejects the transition.
      }
    }
    setDragOver(null);
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Kanban Board Pengerjaan</h1>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Tarik kartu antar kolom atau klik kartu untuk membuka detail &amp; memproses tiket.
          </p>
        </div>
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari tiket berdasarkan kode tiket, serial number, atau tipe perangkat"
            placeholder="Cari kode tiket / serial / perangkat..."
            className="h-10 rounded-lg border-black/10 bg-stone-100 pl-9 pr-3 text-xs text-zinc-900 caret-sky-600 shadow-none placeholder:text-neutral-500 focus-visible:border-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-6">
        {FLOW_STAGES.map((status) => {
          const columnTickets = filtered.filter((t) => t.status === status);
          const isOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => handleDrop(status, e)}
              className={cn(
                'flex min-h-[140px] min-w-0 flex-col rounded-xl border bg-stone-100/70 p-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] transition-colors',
                isOver ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-300' : 'border-black/10'
              )}
            >
              <div className="flex items-center justify-between border-b border-black/10 px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STATUS_ACCENT[status])} aria-hidden="true" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-stone-600">{status}</h3>
                </div>
                <span className="rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-stone-500 outline outline-1 outline-black/10">
                  {columnTickets.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 pt-3">
                {columnTickets.map((ticket) => {
                  const urgent = ticket.slaTone.includes('red');
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', ticket.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => setOpenTicketId(ticket.id)}
                      className="group cursor-grab text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:cursor-grabbing"
                    >
                      <div className="rounded-xl border border-black/10 bg-white p-3.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] transition-all group-hover:border-sky-400">
                        <div className="flex items-center gap-2">
                          <span className="rounded-sm bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-600 outline outline-1 outline-sky-100">
                            #{ticket.id}
                          </span>
                        </div>

                        <h4 className="mt-2 line-clamp-1 text-xs font-bold text-zinc-900 transition-colors group-hover:text-sky-700">
                          {ticket.device}
                        </h4>
                        <p className="mt-0.5 text-[11px] text-stone-500">{ticket.customer}</p>

                        {(ticket.partsUsed?.length || ticket.quotation) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {ticket.partsUsed && ticket.partsUsed.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-600">
                                <Package weight="fill" className="size-2.5" /> {ticket.partsUsed.length} part
                              </span>
                            )}
                            {ticket.quotation && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 outline outline-1 outline-amber-200">
                                <PaperPlaneTilt weight="fill" className="size-2.5" /> Quotation
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5">
                          <span className="flex items-center gap-1 text-[10px] text-stone-400">
                            {urgent ? <WarningCircle weight="fill" className="size-3" /> : <Clock className="size-3" />}
                            {ticket.slaPrimary.replace('SLA: ', '')}
                          </span>
                          <ArrowRight
                            weight="bold"
                            className="size-3 text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-sky-500"
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}

                {columnTickets.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-stone-300 px-3 py-7 text-center">
                    <span className="text-[10px] text-stone-400">Tidak ada tiket</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TicketDetailSheet
        ticketId={openTicketId}
        open={openTicketId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenTicketId(null);
        }}
      />
    </div>
  );
}
