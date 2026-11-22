import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/button';
import { getPublicQuotation, decidePublicQuotation } from '../../lib/api';
import { cn } from '../../lib/utils';

function rupiah(value: number | string) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function errorText(error: any) {
  return error?.response?.data?.error ?? 'Keputusan belum tersimpan. Periksa koneksi lalu coba lagi.';
}

export default function QuotationApprovalPage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const quotationQuery = useQuery({
    queryKey: ['public-quotation', token],
    queryFn: () => getPublicQuotation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  });
  const decisionMutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => decidePublicQuotation(token, decision, note.trim() || undefined),
    onSuccess: (_, decision) => queryClient.setQueryData(['public-quotation', token], (current: any) => current ? { ...current, status: decision === 'approve' ? 'approved' : 'rejected' } : current),
    retry: false,
  });

  const quotation = quotationQuery.data;
  const canDecide = quotation?.status === 'sent' && !quotation.is_expired && !decisionMutation.isPending;

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Persetujuan biaya servis</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Periksa hasil pemeriksaan dan rincian biaya sebelum memilih setuju atau menolak.
          </p>
        </header>

        {quotationQuery.isLoading && (
          <div role="status" className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Memuat quotation…</div>
        )}
        {quotationQuery.isError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            {errorText(quotationQuery.error)}
          </div>
        )}
        {quotation && (
          <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 px-5 py-5 sm:px-7">
              <div>
                <p className="font-mono text-xs font-semibold text-sky-700">{quotation.quotation_number}</p>
                <h2 className="mt-1 text-lg font-bold">Tiket #{quotation.ticket_code}</h2>
                <p className="mt-1 text-sm text-stone-600">Untuk {quotation.customer_name}</p>
              </div>
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                quotation.status === 'approved' ? 'bg-emerald-50 text-emerald-800' :
                  quotation.status === 'rejected' ? 'bg-rose-50 text-rose-800' :
                    quotation.status === 'expired' || quotation.is_expired ? 'bg-stone-100 text-stone-600' : 'bg-amber-50 text-amber-800'
              )}>
                {quotation.status === 'approved' ? <CheckCircle weight="fill" className="size-4" /> :
                  quotation.status === 'rejected' ? <XCircle weight="fill" className="size-4" /> :
                    <Clock weight="fill" className="size-4" />}
                {quotation.status === 'approved' ? 'Disetujui' : quotation.status === 'rejected' ? 'Ditolak' :
                  quotation.status === 'expired' || quotation.is_expired ? 'Kedaluwarsa' : quotation.status === 'draft' ? 'Belum terkirim' : 'Menunggu keputusan'}
              </span>
            </div>

            <div className="divide-y divide-stone-200 px-5 sm:px-7">
              <section className="grid gap-4 py-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Keluhan awal</h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{quotation.complaint || '—'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Hasil Pemeriksaan Teknisi</h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{quotation.technician_diagnosis || '—'}</p>
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Rincian estimasi</h3>
                <ul className="mt-3 divide-y divide-stone-100">
                  {quotation.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                      <span className="min-w-0">
                          <span className="block font-semibold">{item.part_name || item.description}{item.item_type === 'part' && item.part_is_registered === false ? ' · Part perlu dipesan' : ''}</span>
                          {item.part_specification_snapshot && <span className="mt-0.5 block text-xs text-stone-500">{item.part_specification_snapshot}</span>}
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {item.item_type === 'part' ? `Sparepart · ${item.qty} × ${rupiah(item.part_unit_price_snapshot ?? item.unit_price)}` : 'Jasa'}
                          {item.labor_cost != null && Number(item.labor_cost) > 0 ? ` · Jasa ${rupiah(item.labor_cost)}` : ''}
                          {item.item_type === 'part' && item.availability_status ? ` · ${item.availability_status} (${item.available_qty_snapshot ?? 0} tersedia)` : ''}
                          {item.estimated_part_arrival_days ? ` · Estimasi part ${item.estimated_part_arrival_days} hari` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{rupiah(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between border-t border-stone-200 pt-4">
                  <span className="text-sm font-bold">Total estimasi</span>
                  <span className="text-xl font-bold tabular-nums text-sky-800">{rupiah(quotation.total_amount)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Estimasi sparepart dan jasa. Stok sparepart baru dicatat saat pengerjaan dimulai setelah persetujuan.
                </p>
              </section>
            </div>

            {quotation.status === 'sent' && !quotation.is_expired && (
              <div className="border-t border-stone-200 bg-stone-50/70 px-5 py-5 sm:px-7">
                <label htmlFor="approval-note" className="text-xs font-semibold text-stone-700">Catatan untuk teknisi (opsional)</label>
                <textarea
                  id="approval-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 500))}
                  rows={2}
                  maxLength={500}
                  className="mt-1.5 w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                  placeholder="Tulis catatan jika diperlukan…"
                />
                {decisionMutation.isError && <p role="alert" className="mt-3 text-sm text-rose-700">{errorText(decisionMutation.error)}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" disabled={!canDecide} onClick={() => decisionMutation.mutate('reject')} className="h-11 border-rose-200 text-rose-700 hover:bg-rose-50">
                    <XCircle weight="bold" /> Tolak quotation
                  </Button>
                  <Button disabled={!canDecide} onClick={() => decisionMutation.mutate('approve')} className="h-11">
                    <CheckCircle weight="bold" /> Setujui quotation
                  </Button>
                </div>
                {decisionMutation.isPending && <p role="status" className="mt-3 text-center text-xs text-stone-500">Menyimpan keputusan…</p>}
              </div>
            )}

            {(quotation.is_expired || quotation.status === 'expired') && (
              <p className="border-t border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-600 sm:px-7">Tautan ini sudah kedaluwarsa. Hubungi workshop untuk meminta quotation baru.</p>
            )}
            {quotation.status === 'approved' && (
              <p className="border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 sm:px-7">Persetujuan tersimpan. Teknisi akan melanjutkan sesuai rincian yang disetujui.</p>
            )}
            {quotation.status === 'rejected' && (
              <p className="border-t border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 sm:px-7">Penolakan tersimpan. Teknisi akan menghubungi Anda mengenai langkah berikutnya.</p>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
