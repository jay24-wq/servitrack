import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowsClockwise, MapPin, Phone, UserCircleCheck } from '@phosphor-icons/react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { assignCourier, getCourierAssignmentQueue, getCourierRecommendations, type CourierQueueItem } from '../../lib/api';

interface Candidate { id: string; name: string; phone: string | null; active_tasks: number; recommended: boolean; reason: string }

export default function CourierAssignmentPanel() {
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<'success' | 'error' | null>(null);
  const { data: queue = [], refetch, isFetching, isError } = useQuery<CourierQueueItem[]>({
    queryKey: ['courier-assignment-queue'],
    queryFn: getCourierAssignmentQueue,
    refetchOnWindowFocus: false,
  });

  const assignmentKey = (item: CourierQueueItem) => `${item.assignment_type}-${item.id}`;

  const refresh = async () => {
    setRefreshState(null);
    const result = await refetch();
    setRefreshState(result.isError ? 'error' : 'success');
  };

  const recommend = async (item: CourierQueueItem) => {
    const key = assignmentKey(item);
    setBusy(key);
    try {
      const result = await getCourierRecommendations(item.assignment_type, item.id);
      setCandidates((current) => ({ ...current, [key]: result }));
    } finally {
      setBusy(null);
    }
  };

  const assign = async (item: CourierQueueItem, courier: Candidate) => {
    const key = assignmentKey(item);
    setBusy(key);
    try {
      await assignCourier({
        courier_id: courier.id,
        assignment_type: item.assignment_type,
        ...(item.assignment_type === 'pickup' ? { booking_id: item.id } : { ticket_id: item.id }),
        assignment_reason: `Rekomendasi semi-otomatis: ${courier.reason}`,
      });
      setCandidates((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await refetch();
    } finally {
      setBusy(null);
    }
  };

  const pickups = queue.filter((item) => item.assignment_type === 'pickup');
  const deliveries = queue.filter((item) => item.assignment_type === 'delivery');
  const renderItems = (items: CourierQueueItem[], type: 'pickup' | 'delivery') => items.length ? items.map((item) => {
    const key = assignmentKey(item);
    const itemCandidates = candidates[key];

    return (
      <article key={key} className="rounded-lg border border-stone-200 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(type === 'pickup' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                {type === 'pickup' ? 'Pickup Menunggu Assignment' : 'Delivery Menunggu Assignment'}
              </Badge>
              <span className="font-mono text-xs text-sky-700">{item.reference}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900">{item.customer_name}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin className="size-3 shrink-0" />{item.address || 'Alamat customer tersimpan pada tiket'}</p>
          </div>
          {!itemCandidates && <Button size="sm" disabled={busy === key} onClick={() => void recommend(item)}>Assign</Button>}
        </div>
        {itemCandidates && <div className="mt-3 grid gap-2 border-t border-stone-100 pt-3">
          {itemCandidates.length === 0 ? <p className="text-xs text-rose-600">Tidak ada kurir ONLINE di cabang ini.</p> : itemCandidates.map((candidate) => <div key={candidate.id} className="flex flex-col gap-2 rounded-md bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><UserCircleCheck className="size-5 text-sky-600" weight="fill" /><div><p className="text-xs font-bold text-zinc-900">{candidate.name} {candidate.recommended && <Badge className="ml-1 bg-sky-50 text-sky-700">Direkomendasikan</Badge>}</p><p className="mt-1 text-[11px] text-stone-600">{candidate.phone ? <a className="inline-flex items-center gap-1 underline underline-offset-2" href={`tel:${candidate.phone.startsWith('+') || candidate.phone.startsWith('0') ? candidate.phone : `+${candidate.phone}`}`}><Phone className="size-3" />{candidate.phone}</a> : 'No handphone belum diatur'}</p><p className="text-[11px] text-stone-500">{candidate.reason}</p></div></div><Button size="sm" disabled={busy === key} onClick={() => void assign(item, candidate)}>Assign</Button></div>)}
        </div>}
      </article>
    );
  }) : <p className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center text-xs text-stone-500">Belum ada tugas {type === 'pickup' ? 'pick up' : 'delivery'} menunggu assignment.</p>;

  return (
    <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Assignment Kurir</h2>
          <p className="mt-1 text-xs text-stone-500">Sistem hanya merekomendasikan. Tugas masuk ke kurir setelah Anda menekan Assign.</p>
          <p className={cn('mt-1 text-xs', refreshState === 'error' || isError ? 'text-rose-600' : 'text-emerald-600')} aria-live="polite">
            {refreshState === 'error' || isError ? 'Gagal memuat data assignment.' : refreshState === 'success' ? 'Data assignment berhasil diperbarui.' : null}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refresh()}>
          <ArrowsClockwise className={cn('mr-1 size-4', isFetching && 'animate-spin')} />
          {isFetching ? 'Memuat...' : 'Refresh'}
        </Button>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="courier-pickup-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="courier-pickup-heading" className="text-sm font-bold text-zinc-900">Pick Up</h3>
            <Badge className="bg-amber-50 text-amber-700" aria-label={`${pickups.length} tugas pick up`}>{pickups.length} tugas</Badge>
          </div>
          <div className="grid content-start gap-3">{renderItems(pickups, 'pickup')}</div>
        </section>
        <section aria-labelledby="courier-delivery-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="courier-delivery-heading" className="text-sm font-bold text-zinc-900">Delivery</h3>
            <Badge className="bg-emerald-50 text-emerald-700" aria-label={`${deliveries.length} tugas delivery`}>{deliveries.length} tugas</Badge>
          </div>
          <div className="grid content-start gap-3">{renderItems(deliveries, 'delivery')}</div>
        </section>
      </div>
    </section>
  );
}
