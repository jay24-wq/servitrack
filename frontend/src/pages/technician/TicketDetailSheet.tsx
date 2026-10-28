import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUUpLeft,
  Camera,
  Check,
  CheckCircle,
  Clock,
  Eye,
  EyeSlash,
  NotePencil,
  Package,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  Trash,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react';

import { Button } from '../../components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Separator } from '../../components/ui/separator';
import { cn } from '../../lib/utils';
import { useAuthStore, useTicketStore, FLOW_STAGES, type PartUsage, type QueueStatus, type QueueTicket } from '../../store';
import { PARTS, angka, stockLevel } from '../../data/parts';

interface TicketDetailSheetProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONE: Record<QueueStatus, string> = {
  Antrian: 'bg-amber-50 text-amber-700 outline-amber-200',
  Pengecekan: 'bg-blue-50 text-sky-700 outline-blue-200',
  'Menunggu Part': 'bg-rose-50 text-rose-700 outline-rose-200',
  Pengerjaan: 'bg-sky-50 text-sky-700 outline-sky-200',
  'Quality Control': 'bg-indigo-50 text-indigo-700 outline-indigo-200',
  Selesai: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
};

function sekarang() {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

export default function TicketDetailSheet({ ticketId, open, onOpenChange }: TicketDetailSheetProps) {
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.id === ticketId) ?? null);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const technician = useAuthStore((s) => s.user?.name) ?? '—';

  const [showPin, setShowPin] = useState(false);
  const [extraDamage, setExtraDamage] = useState(false);
  const [extraPartId, setExtraPartId] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [etaDays, setEtaDays] = useState(3);
  const [workNote, setWorkNote] = useState('');
  const [workPartId, setWorkPartId] = useState('');
  const [workPartQty, setWorkPartQty] = useState(1);

  const initials = useMemo(
    () =>
      technician
        .split(' ')
        .slice(0, 2)
        .map((p) => p.charAt(0))
        .join('')
        .toUpperCase(),
    [technician]
  );

  const selectedPart = PARTS.find((p) => p.id === partId) ?? null;
  const selectedExtraPart = PARTS.find((p) => p.id === extraPartId) ?? null;
  const selectedWorkPart = PARTS.find((p) => p.id === workPartId) ?? null;
  const currentIndex = ticket ? FLOW_STAGES.indexOf(ticket.status) : -1;

  if (!ticket) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  const assignedTech = ticket.technician || technician;
  const techPatch: Partial<QueueTicket> = ticket.technician
    ? {}
    : { technician: technician, technicianInitials: initials };

  const moveTo = (status: QueueStatus, patch: Partial<QueueTicket> = {}) =>
    updateTicket(ticket.id, { status, ...techPatch, ...patch });

  const addExtraPart = () => {
    if (!selectedExtraPart) return;
    const item: PartUsage = {
      id: selectedExtraPart.id,
      name: selectedExtraPart.name,
      qty: 1,
      price: selectedExtraPart.price,
    };
    updateTicket(ticket.id, {
      extraDamage: true,
      quotation: {
        type: 'EXTRA_DAMAGE',
        status: 'PENDING',
        message: extraNote.trim() || 'Ditemukan komponen tambahan yang ikut rusak (menjalar).',
        items: [...(ticket.quotation?.items ?? []), item],
        createdAt: sekarang(),
      },
    });
    setExtraPartId('');
    setExtraNote('');
  };

  const recordPartAndWork = () => {
    if (!selectedPart) return;
    const used: PartUsage = { id: selectedPart.id, name: selectedPart.name, qty, price: selectedPart.price };
    moveTo('Pengerjaan', {
      partsUsed: [...(ticket.partsUsed ?? []), used],
    });
  };

  const outOfStockToWaiting = () => {
    const item: PartUsage | null = selectedPart
      ? { id: selectedPart.id, name: selectedPart.name, qty, price: selectedPart.price }
      : null;
    moveTo('Menunggu Part', {
      partEtaDays: etaDays,
      quotation: {
        type: 'PART_OUT_OF_STOCK',
        status: 'PENDING',
        message: 'Sparepart yang dibutuhkan kosong. Admin akan melakukan pembelian.',
        items: item ? [...(ticket.quotation?.items ?? []), item] : ticket.quotation?.items ?? [],
        etaDays,
        createdAt: sekarang(),
      },
    });
  };

  const saveWorkNote = () => {
    if (!workNote.trim()) return;
    updateTicket(ticket.id, {
      notes: [...(ticket.notes ?? []), { at: sekarang(), note: workNote.trim() }],
    });
    setWorkNote('');
  };

  const addWorkPart = () => {
    if (!selectedWorkPart) return;
    const amount = Math.max(1, workPartQty);
    const current = ticket.partsUsed ?? [];
    const existingIndex = current.findIndex((item) => item.id === selectedWorkPart.id);
    const next: PartUsage[] =
      existingIndex >= 0
        ? current.map((item, idx) => (idx === existingIndex ? { ...item, qty: item.qty + amount } : item))
        : [...current, { id: selectedWorkPart.id, name: selectedWorkPart.name, qty: amount, price: selectedWorkPart.price }];
    updateTicket(ticket.id, { partsUsed: next });
    setWorkPartId('');
    setWorkPartQty(1);
  };

  const removeWorkPart = (index: number) => {
    updateTicket(ticket.id, { partsUsed: (ticket.partsUsed ?? []).filter((_, i) => i !== index) });
  };

  const workPartsTotal = (ticket.partsUsed ?? []).reduce((sum, item) => sum + item.price * item.qty, 0);

  const partAvailable = selectedPart ? selectedPart.stock > 0 && selectedPart.stock >= qty : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-black/10 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-bold outline outline-1',
                STATUS_TONE[ticket.status]
              )}
            >
              {ticket.status}
            </span>
            <span className="font-mono text-xs font-bold text-sky-600">#{ticket.id}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-zinc-900">{ticket.device}</SheetTitle>
          <SheetDescription className="text-sm text-stone-500">
            {ticket.customer} · {ticket.phone} · {ticket.handover}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-6">
          {/* STEPPER */}
          <div className="ledger-scroll overflow-x-auto pb-1">
            <ol className="flex min-w-max items-center gap-1.5">
              {FLOW_STAGES.map((stage, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={stage} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        done
                          ? 'bg-sky-600 text-white'
                          : active
                            ? 'bg-sky-50 text-sky-700 outline outline-1 outline-sky-300'
                            : 'bg-stone-100 text-stone-400'
                      )}
                    >
                      {done ? <Check weight="bold" size={12} /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        active ? 'text-zinc-900' : done ? 'text-stone-600' : 'text-stone-400'
                      )}
                    >
                      {stage}
                    </span>
                    {i < FLOW_STAGES.length - 1 && <span className="h-px w-4 bg-stone-200" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* SLA + PIN */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Target SLA</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-rose-600">
                <Clock weight="bold" className="size-4" /> {ticket.slaPrimary}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">{ticket.slaSecondary}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">PIN / Password unit</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-mono text-sm font-bold text-zinc-900">{showPin ? '882931' : '••••••'}</p>
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  className="flex size-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-black/5 hover:text-zinc-900"
                >
                  {showPin ? <EyeSlash weight="bold" className="size-4" /> : <Eye weight="bold" className="size-4" />}
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-500">Teknisi: {assignedTech}</p>
            </div>
          </div>

          {/* KELUHAN & DIAGNOSA */}
          <section className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <NotePencil weight="fill" className="size-4 text-sky-600" /> Keluhan &amp; Diagnosa Awal
            </h4>
            <p className="rounded-xl border border-black/10 bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
              {ticket.diagnosis}
            </p>
          </section>

          <Separator className="bg-black/10" />

          {/* ACTION PANEL */}
          <section className="flex flex-col gap-4">
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <Wrench weight="fill" className="size-4 text-sky-600" /> Tindakan
            </h4>

            {/* ANTRIAN */}
            {ticket.status === 'Antrian' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs leading-relaxed text-stone-600">
                  Unit berada di antrean. Mulai pengecekan untuk memverifikasi keluhan pelanggan sesuai diagnosa awal.
                </p>
                <Button
                  onClick={() => moveTo('Pengecekan')}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <ArrowRight weight="bold" className="size-4" /> Pindahkan ke Pengecekan
                </Button>
              </div>
            )}

            {/* PENGECEKAN */}
            {ticket.status === 'Pengecekan' && (
              <div className="flex flex-col gap-4">
                {/* Kerusakan tambahan */}
                <div
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    extraDamage ? 'border-rose-200 bg-rose-50/50' : 'border-black/10 bg-white'
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={extraDamage}
                      onChange={(e) => setExtraDamage(e.target.checked)}
                      className="mt-0.5 size-4 accent-rose-600"
                    />
                    <span>
                      <span className="block text-xs font-bold text-zinc-900">
                        Terdapat kerusakan tambahan (menjalar)
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-600">
                        Komponen lain ikut rusak di luar keluhan pelanggan. Ajukan quotation untuk persetujuan biaya tambahan.
                      </span>
                    </span>
                  </label>

                  {extraDamage && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-rose-200/70 pt-3">
                      {ticket.quotation?.type === 'EXTRA_DAMAGE' && ticket.quotation.items.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                            <Clock weight="bold" className="size-3.5" /> Menunggu persetujuan pelanggan
                          </p>
                          <ul className="mt-1.5 flex flex-col gap-1">
                            {ticket.quotation.items.map((item, idx) => (
                              <li key={`${item.id}-${idx}`} className="flex justify-between text-[11px] text-amber-900">
                                <span>{item.name}</span>
                                <span className="font-semibold tabular-nums">Rp {angka(item.price)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-stone-600">Komponen tambahan yang rusak</span>
                            <select
                              value={extraPartId}
                              onChange={(e) => setExtraPartId(e.target.value)}
                              className="h-10 rounded-lg border border-black/10 bg-white px-3 text-xs text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                            >
                              <option value="">Pilih komponen...</option>
                              {PARTS.map((part) => (
                                <option key={part.id} value={part.id}>
                                  {part.name} · Rp {angka(part.price)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <textarea
                            value={extraNote}
                            onChange={(e) => setExtraNote(e.target.value.slice(0, 200))}
                            rows={2}
                            placeholder="Catatan kerusakan tambahan untuk pelanggan..."
                            className="w-full resize-none rounded-lg border border-black/10 bg-white p-3 text-xs text-zinc-900 outline-none placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                          />
                          <Button
                            onClick={addExtraPart}
                            disabled={!selectedExtraPart}
                            variant="outline"
                            className="h-10 w-full gap-2 text-xs font-bold text-amber-800 disabled:opacity-50"
                          >
                            <PaperPlaneTilt weight="bold" className="size-4" /> Kirim quotation kerusakan tambahan
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Ketersediaan sparepart */}
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs font-bold text-zinc-900">Kesesuaian keluhan &amp; ketersediaan sparepart</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                    Jika masalah sesuai keluhan, cek ketersediaan sparepart sebelum pengerjaan.
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Sparepart yang akan diganti</span>
                      <select
                        value={partId}
                        onChange={(e) => setPartId(e.target.value)}
                        className="h-10 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="">Pilih sparepart...</option>
                        {PARTS.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name} ({stockLevel(part)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Qty</span>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="h-10 w-20 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium tabular-nums text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </label>
                  </div>

                  {selectedPart && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          partAvailable
                            ? 'bg-emerald-50 text-emerald-700 outline outline-1 outline-emerald-200'
                            : 'bg-rose-50 text-rose-700 outline outline-1 outline-rose-200'
                        )}
                      >
                        {partAvailable ? <CheckCircle weight="fill" className="size-3.5" /> : <WarningCircle weight="fill" className="size-3.5" />}
                        Stok {stockLevel(selectedPart)} · {selectedPart.stock} {selectedPart.unit} di {selectedPart.bin}
                      </span>
                      <span className="text-[11px] text-stone-500">Harga Rp {angka(selectedPart.price)}</span>
                    </div>
                  )}

                  {/* Primary contextual action */}
                  <div className="mt-3">
                    {selectedPart && partAvailable ? (
                      <Button
                        onClick={recordPartAndWork}
                        className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                      >
                        <Package weight="bold" className="size-4" /> Catat sparepart &amp; ke Pengerjaan
                      </Button>
                    ) : selectedPart ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
                          <WarningCircle weight="fill" className="size-3.5" /> Sparepart kosong. Admin akan melakukan pembelian.
                        </p>
                        <label className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-stone-600">Estimasi kedatangan</span>
                          <input
                            type="number"
                            min={1}
                            value={etaDays}
                            onChange={(e) => setEtaDays(Math.max(1, Number(e.target.value) || 1))}
                            className="h-9 w-16 rounded-lg border border-black/10 bg-white px-2 text-xs font-medium tabular-nums text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          />
                          <span className="text-[11px] text-stone-600">hari kerja</span>
                        </label>
                        <Button
                          onClick={outOfStockToWaiting}
                          className="h-11 w-full gap-2 bg-rose-600 text-sm font-bold text-white hover:bg-rose-700"
                        >
                          <PaperPlaneTilt weight="bold" className="size-4" /> Kirim quotation &amp; ke Menunggu Part
                        </Button>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                        Pilih sparepart untuk mencatat pemakaian atau mengajukan pembelian.
                      </p>
                    )}
                  </div>

                  {/* Quick routes */}
                  <div className="mt-3 flex flex-col gap-2 border-t border-black/5 pt-3 sm:flex-row">
                    <Button
                      onClick={() => moveTo('Menunggu Part', { partEtaDays: etaDays })}
                      variant="outline"
                      className="h-10 flex-1 gap-2 text-xs font-bold text-stone-700"
                    >
                      <Clock weight="bold" className="size-4" /> Ke Menunggu Part
                    </Button>
                    <Button
                      onClick={() => moveTo('Pengerjaan')}
                      variant="outline"
                      className="h-10 flex-1 gap-2 text-xs font-bold text-stone-700"
                    >
                      <ArrowRight weight="bold" className="size-4" /> Langsung ke Pengerjaan
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* MENUNGGU PART */}
            {ticket.status === 'Menunggu Part' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Clock weight="fill" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-800">
                      Menunggu sparepart{ticket.partEtaDays ? ` · estimasi ${ticket.partEtaDays} hari kerja` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
                      {ticket.quotation?.message ??
                        'SLA dijeda sementara sampai sparepart tersedia. Pelanggan telah diberi estimasi kedatangan.'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  Setelah sparepart tiba, lanjutkan ke pengerjaan.
                </p>
                <Button
                  onClick={() => moveTo('Pengerjaan')}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <Package weight="bold" className="size-4" /> Sparepart tiba → Mulai Pengerjaan
                </Button>
              </div>
            )}

            {/* PENGERJAAN */}
            {ticket.status === 'Pengerjaan' && (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900">Sparepart yang digunakan</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                        Tambahkan satu atau lebih sparepart yang dipasang pada unit ini.
                      </p>
                    </div>
                    {ticket.partsUsed && ticket.partsUsed.length > 0 && (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                        {ticket.partsUsed.length} item
                      </span>
                    )}
                  </div>

                  {ticket.partsUsed && ticket.partsUsed.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {ticket.partsUsed.map((item, idx) => (
                        <li
                          key={`${item.id}-${idx}`}
                          className="flex items-center gap-3 rounded-lg border border-black/10 bg-stone-50 p-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-zinc-900">{item.name}</span>
                            <span className="block font-mono text-[10px] text-stone-400">
                              {item.id} · {item.qty}× · Rp {angka(item.price)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-900">
                            Rp {angka(item.price * item.qty)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus ${item.name}`}
                            onClick={() => removeWorkPart(idx)}
                            className="size-7 shrink-0 rounded-sm text-neutral-400 hover:bg-black/5 hover:text-rose-600"
                          >
                            <Trash weight="bold" className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                      Belum ada sparepart dicatat. Tambahkan di bawah.
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-black/5 pt-3 sm:grid-cols-[1fr_auto_auto]">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Tambah sparepart</span>
                      <select
                        value={workPartId}
                        onChange={(e) => setWorkPartId(e.target.value)}
                        className="h-10 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="">Pilih sparepart...</option>
                        {PARTS.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name} ({stockLevel(part)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Qty</span>
                      <input
                        type="number"
                        min={1}
                        value={workPartQty}
                        onChange={(e) => setWorkPartQty(Math.max(1, Number(e.target.value) || 1))}
                        className="h-10 w-20 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium tabular-nums text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        onClick={addWorkPart}
                        disabled={!selectedWorkPart}
                        className="h-10 w-full gap-2 bg-sky-600 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50 sm:w-auto"
                      >
                        <Plus weight="bold" className="size-4" /> Tambah
                      </Button>
                    </div>
                  </div>

                  {selectedWorkPart && (
                    <p className="mt-2 text-[11px] text-stone-500">
                      Stok {stockLevel(selectedWorkPart)} · {selectedWorkPart.stock} {selectedWorkPart.unit} di {selectedWorkPart.bin}
                    </p>
                  )}

                  {ticket.partsUsed && ticket.partsUsed.length > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
                      <span className="text-[11px] font-semibold text-stone-600">Total nilai sparepart</span>
                      <span className="text-xs font-bold tabular-nums text-zinc-900">Rp {angka(workPartsTotal)}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs font-bold text-zinc-900">Catatan teknisi pengerjaan</p>
                  <textarea
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value.slice(0, 400))}
                    rows={3}
                    placeholder="Tulis hasil pengerjaan: komponen yang diganti, hasil uji, catatan penting..."
                    className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-stone-50 p-3 text-xs text-zinc-900 outline-none placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      onClick={saveWorkNote}
                      disabled={!workNote.trim()}
                      variant="outline"
                      className="h-9 gap-2 text-xs font-bold text-stone-700 disabled:opacity-50"
                    >
                      <Plus weight="bold" className="size-3.5" /> Simpan catatan
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => moveTo('Quality Control')}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <ShieldCheck weight="bold" className="size-4" /> Pindahkan ke Quality Check
                </Button>
              </div>
            )}

            {/* QUALITY CONTROL */}
            {ticket.status === 'Quality Control' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs font-bold text-zinc-900">Hasil pengujian fungsi perangkat</p>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  Uji apakah perangkat berjalan normal. Jika masih bermasalah, kembalikan ke pengerjaan.
                </p>
                <div className="mt-1 flex flex-col gap-2">
                  <Button
                    onClick={() => moveTo('Selesai')}
                    className="h-11 w-full gap-2 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle weight="bold" className="size-4" /> Berjalan normal → Selesai
                  </Button>
                  <Button
                    onClick={() => moveTo('Pengerjaan')}
                    variant="outline"
                    className="h-11 w-full gap-2 text-sm font-bold text-rose-700"
                  >
                    <ArrowUUpLeft weight="bold" className="size-4" /> Masih bermasalah → Kembali ke Pengerjaan
                  </Button>
                </div>
              </div>
            )}

            {/* SELESAI */}
            {ticket.status === 'Selesai' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">Pengerjaan selesai</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-900/80">
                    {ticket.slaTertiary ?? 'Unit lolos quality check dan siap diserahkan ke pelanggan.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* PARTS USED (ringkasan — disembunyikan saat Pengerjaan karena sudah dikelola di panel tindakan) */}
          {ticket.status !== 'Pengerjaan' && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <Package weight="fill" className="size-4 text-sky-600" /> Sparepart Terpakai
              </h4>
              {ticket.partsUsed && ticket.partsUsed.length > 0 ? (
                <ul className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white">
                  {ticket.partsUsed.map((item, idx) => (
                    <li key={`${item.id}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-zinc-900">{item.name}</span>
                        <span className="block font-mono text-[10px] text-stone-400">
                          {item.id} · {item.qty}×
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-900">
                        Rp {angka(item.price * item.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                  Belum ada sparepart yang dicatat.
                </p>
              )}
            </section>
          )}

          {/* QUOTATION (OUT OF STOCK) */}
          {ticket.quotation?.type === 'PART_OUT_OF_STOCK' && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <PaperPlaneTilt weight="fill" className="size-4 text-sky-600" /> Quotation Pembelian Sparepart
              </h4>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">{ticket.quotation.message}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {ticket.quotation.status === 'PENDING' ? 'Menunggu approval' : ticket.quotation.status}
                  </span>
                </div>
                {ticket.quotation.etaDays && (
                  <p className="mt-1.5 text-[11px] text-amber-900/80">
                    Estimasi kedatangan: {ticket.quotation.etaDays} hari kerja · dikirim {ticket.quotation.createdAt}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* NOTES */}
          {ticket.notes && ticket.notes.length > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <NotePencil weight="fill" className="size-4 text-sky-600" /> Riwayat Catatan Teknisi
              </h4>
              <ol className="flex flex-col gap-2">
                {ticket.notes.map((entry, idx) => (
                  <li key={idx} className="rounded-xl border border-black/10 bg-white p-3">
                    <span className="block text-[10px] font-semibold text-stone-400">{entry.at}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-700">{entry.note}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* PHOTOS */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <Camera weight="fill" className="size-4 text-sky-600" /> Foto Bukti &amp; Progress
              </h4>
              <Button variant="outline" size="sm" className="h-auto gap-1.5 px-2.5 py-1 text-[11px] font-medium text-stone-700">
                <Plus weight="bold" className="size-3.5 text-neutral-500" /> Upload foto
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Check-in', 'Progress', 'Final QC'].map((label) => (
                <div
                  key={label}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-400"
                >
                  <Camera className="size-5" />
                  <span className="text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {ticket.status === 'Selesai' && (
            <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-stone-50 p-3 text-[11px] text-stone-500">
              <Trash weight="bold" className="size-3.5" /> Data tersimpan permanen untuk audit &amp; garansi.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
