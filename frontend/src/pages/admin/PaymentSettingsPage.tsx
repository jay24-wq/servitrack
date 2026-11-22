import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bank, CheckCircle, QrCode, Wallet } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { getPaymentInstructions, updatePaymentInstructions, type PaymentInstructions } from '../../lib/api';

const empty: PaymentInstructions = {
  bank_name: '', bank_account_name: '', bank_account_number: '', static_qris_image_url: '', ewallet_provider: '', ewallet_account: '',
};

export default function PaymentSettingsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['payment-instructions'], queryFn: getPaymentInstructions });
  const [draft, setDraft] = useState(empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: updatePaymentInstructions,
    onSuccess: (settings) => {
      client.setQueryData(['payment-instructions'], settings);
      setDraft(settings);
      setMessage('Petunjuk pembayaran tersimpan.');
      setError('');
    },
    onError: (saveError: any) => {
      setError(saveError?.response?.data?.error || 'Gagal menyimpan pengaturan pembayaran.');
      setMessage('');
    },
  });

  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);
  const set = (key: keyof PaymentInstructions, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <Link to="/settings" className="inline-flex min-h-9 items-center gap-2 rounded-md text-xs font-medium text-stone-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
          <ArrowLeft weight="bold" className="size-3.5" /> Kembali ke Pengaturan
        </Link>
        <h1 className="mt-3 text-2xl font-bold leading-8 tracking-tight text-zinc-900">Petunjuk Pembayaran</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">Informasi rekening dan akun bengkel yang disertakan pada pesan pembayaran manual via WhatsApp.</p>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }} className="flex flex-col gap-5">
        <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Bank weight="fill" className="size-5" /></span>
            <div><h2 className="text-sm font-semibold text-zinc-900">Transfer bank manual</h2><p className="mt-0.5 text-xs text-stone-600">Nomor rekening tujuan pelunasan.</p></div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Nama bank<Input value={draft.bank_name} onChange={(event) => set('bank_name', event.target.value)} placeholder="Contoh: BCA" /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Nama pemilik rekening<Input value={draft.bank_account_name} onChange={(event) => set('bank_account_name', event.target.value)} placeholder="Nama sesuai rekening" /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700 sm:col-span-2">Nomor rekening<Input value={draft.bank_account_number} onChange={(event) => set('bank_account_number', event.target.value)} inputMode="numeric" placeholder="Nomor rekening bengkel" /></label>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><QrCode weight="fill" className="size-5" /></span>
            <div><h2 className="text-sm font-semibold text-zinc-900">QRIS statis</h2><p className="mt-0.5 text-xs text-stone-600">Tautan gambar QRIS yang aman (HTTPS), dikirim pada instruksi pembayaran.</p></div>
          </div>
          <div className="p-5"><label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">URL gambar QRIS<Input type="url" value={draft.static_qris_image_url} onChange={(event) => set('static_qris_image_url', event.target.value)} placeholder="https://..." /></label></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Wallet weight="fill" className="size-5" /></span>
            <div><h2 className="text-sm font-semibold text-zinc-900">E-wallet bengkel</h2><p className="mt-0.5 text-xs text-stone-600">Akun penerima untuk pembayaran manual.</p></div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Penyedia e-wallet<Input value={draft.ewallet_provider} onChange={(event) => set('ewallet_provider', event.target.value)} placeholder="Contoh: GoPay" /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Nomor / akun penerima<Input value={draft.ewallet_account} onChange={(event) => set('ewallet_account', event.target.value)} placeholder="Nomor atau nama akun" /></label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={query.isLoading || save.isPending}>{save.isPending ? 'Menyimpan…' : 'Simpan petunjuk pembayaran'}</Button>
          {message && <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle weight="fill" className="size-4" />{message}</span>}
          {error && <span role="alert" className="text-xs font-medium text-rose-700">{error}</span>}
          {query.isError && <span role="alert" className="text-xs font-medium text-rose-700">Pengaturan pembayaran gagal dimuat.</span>}
        </div>
      </form>
    </div>
  );
}
