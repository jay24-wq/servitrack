import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, CalendarDots, CaretLeft, CaretRight, PencilSimple, Plus, Storefront, Trash, X } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  createBookingCalendarException,
  deleteBookingCalendarException,
  getBookingCalendarExceptions,
  updateBookingCalendarException,
  type BookingCalendarException,
} from '../../lib/api';

type Draft = { slot_date: string; status: 'closed' | 'limited'; capacity_override: string; title: string; notes: string };
const emptyDraft: Draft = { slot_date: '', status: 'closed', capacity_override: '', title: '', notes: '' };

function exceptionCategory(title: string) {
  const value = title.toLowerCase();
  if (/nyepi|galungan|kuningan|idul|wafat|natal|waisak|imlek|keagamaan|raya/.test(value)) return { label: 'RELIGIOUS', style: 'bg-purple-50 text-purple-700 outline-purple-200/60' };
  if (/nasional|kemerdekaan|pancasila|buruh|tahun baru|libur nasional/.test(value)) return { label: 'NATIONAL', style: 'bg-blue-50 text-blue-700 outline-blue-200/60' };
  return { label: 'INTERNAL', style: 'bg-stone-100 text-stone-700 outline-stone-200/80' };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function BookingCalendarPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<BookingCalendarException | null>(null);
  const queryClient = useQueryClient();
  const { data: exceptions = [], isLoading, isError } = useQuery({ queryKey: ['booking-calendar', month], queryFn: () => getBookingCalendarExceptions(month) });
  const save = useMutation({
    mutationFn: async () => {
      const input = { slot_date: draft.slot_date, status: draft.status, capacity_override: draft.status === 'limited' && draft.capacity_override ? Number(draft.capacity_override) : null, title: draft.title.trim(), notes: draft.notes.trim() || null };
      return editing ? updateBookingCalendarException(editing.id, input) : createBookingCalendarException(input);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-calendar'] }); setDraft(emptyDraft); setEditing(null); },
  });
  const remove = useMutation({ mutationFn: deleteBookingCalendarException, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking-calendar'] }) });

  const shiftMonth = (offset: number) => {
    const [year, monthNumber] = month.split('-').map(Number);
    setMonth(monthKey(new Date(year, monthNumber - 1 + offset, 1)));
  };
  const startEdit = (exception: BookingCalendarException) => {
    setEditing(exception);
    setDraft({ slot_date: exception.slot_date.slice(0, 10), status: exception.status, capacity_override: exception.capacity_override?.toString() ?? '', title: exception.title, notes: exception.notes ?? '' });
  };
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const closedCount = exceptions.filter((exception) => exception.status === 'closed').length;
  const limitedCount = exceptions.filter((exception) => exception.status === 'limited').length;

  return (
    <main className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0"><h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Kalender Operasional</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">Atur hari libur dan kapasitas khusus tanpa mengubah kapasitas normal bengkel.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"><CalendarBlank weight="fill" className="size-3.5 text-stone-400" /><span className="text-xs font-medium capitalize text-zinc-900">{monthLabel}</span></span><Button onClick={() => { setEditing(null); setDraft(emptyDraft); }} className="h-auto gap-1.5 px-3.5 py-1.5 text-xs font-semibold "><Plus size={16} weight="bold" /> Tambah Exception</Button></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">Total exception</span><span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><CalendarDots weight="bold" className="size-4" /></span></div><p className="text-2xl font-bold leading-8 tabular-nums text-neutral-900">{exceptions.length}</p><span className="text-[11px] leading-4 text-neutral-500">{monthLabel}</span></div>
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">Hari libur</span><span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600"><Storefront weight="bold" className="size-4" /></span></div><p className="text-2xl font-bold leading-8 tabular-nums text-neutral-900">{closedCount}</p><span className="text-[11px] leading-4 text-neutral-500">Tidak menerima booking</span></div>
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">Kapasitas khusus</span><span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><CalendarBlank weight="bold" className="size-4" /></span></div><p className="text-2xl font-bold leading-8 tabular-nums text-neutral-900">{limitedCount}</p><span className="text-[11px] leading-4 text-neutral-500">Override kapasitas aktif</span></div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4"><div><h2 className="text-sm font-bold leading-5 text-neutral-900">Exception tanggal</h2><p className="mt-0.5 text-xs leading-5 text-stone-600">Jadwal operasional untuk {monthLabel}.</p></div><div className="flex items-center gap-1"><button type="button" aria-label="Bulan sebelumnya" onClick={() => shiftMonth(-1)} className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"><CaretLeft size={16} /></button><button type="button" aria-label="Bulan berikutnya" onClick={() => shiftMonth(1)} className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"><CaretRight size={16} /></button></div></div>
           {isLoading ? <p className="py-10 text-center text-sm text-stone-600">Memuat kalender...</p> : isError ? <p className="py-10 text-center text-sm text-red-600">Gagal memuat kalender operasional.</p> : exceptions.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-center"><CalendarDots size={32} className="text-stone-300" /><p className="text-sm font-semibold text-zinc-900">Belum ada exception</p><p className="text-xs text-stone-600">Tambahkan hari libur atau kapasitas khusus untuk bulan ini.</p></div> : <div className="divide-y divide-black/5">{exceptions.map((exception) => { const category = exceptionCategory(exception.title); return <div key={exception.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="flex min-w-20 flex-col gap-1"><span className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase outline outline-1 ${category.style}`}>{category.label}</span><span className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${exception.status === 'closed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{exception.status === 'closed' ? 'OFF' : 'LIMITED'}</span></div><div className="min-w-0"><p className="text-sm font-bold text-zinc-900">{new Date(`${exception.slot_date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="truncate text-sm text-stone-600">{exception.title}</p>{exception.notes && <p className="mt-1 truncate text-xs text-stone-400">{exception.notes}</p>}</div></div><div className="flex items-center gap-2 sm:shrink-0"><span className="text-xs font-semibold text-sky-700">{exception.status === 'limited' ? `${exception.capacity_override} slot` : 'OFF'}</span><button type="button" aria-label="Edit exception" onClick={() => startEdit(exception)} className="rounded-lg p-2 text-sky-600/70 hover:bg-stone-100 hover:text-sky-600"><PencilSimple size={16} /></button><button type="button" aria-label="Hapus exception" onClick={() => { if (window.confirm('Hapus exception tanggal ini?')) remove.mutate(exception.id); }} className="rounded-lg p-2 text-red-600/70 hover:bg-red-50 hover:text-red-600"><Trash size={16} /></button></div></div>; })}</div>}
        </div>

        <div className="flex flex-col rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"><div className="mb-5 flex items-start justify-between border-b border-black/5 pb-4"><div><h2 className="text-sm font-bold leading-5 text-neutral-900">{editing ? 'Edit exception' : 'Exception baru'}</h2><p className="mt-0.5 text-xs leading-5 text-stone-600">Terapkan perubahan pada satu tanggal.</p></div>{editing && <button type="button" onClick={() => { setEditing(null); setDraft(emptyDraft); }} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X size={16} /></button>}</div><div className="flex flex-col gap-4"><label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-900">Tanggal<Input type="date" value={draft.slot_date} onChange={(event) => setDraft({ ...draft, slot_date: event.target.value })} /></label><label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-900">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-sky-500"><option value="closed">Libur / OFF</option><option value="limited">Kapasitas terbatas</option></select></label>{draft.status === 'limited' && <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-900">Override kapasitas<Input type="number" min="1" value={draft.capacity_override} onChange={(event) => setDraft({ ...draft, capacity_override: event.target.value })} placeholder="Contoh: 15" /></label>}<label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-900">Judul / Keterangan<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Contoh: Hari Raya Nyepi" /></label><label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-900">Catatan <span className="font-normal text-stone-400">(Opsional)</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} placeholder="Informasi untuk tim operasional..." className="resize-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-sky-500" /></label><Button disabled={save.isPending || !draft.slot_date || !draft.title.trim() || (draft.status === 'limited' && !draft.capacity_override)} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan Exception'}</Button>{save.isError && <p className="text-xs text-red-600">{(save.error as any)?.response?.data?.error ?? 'Gagal menyimpan exception.'}</p>}</div></div>
      </section>
    </main>
  );
}
