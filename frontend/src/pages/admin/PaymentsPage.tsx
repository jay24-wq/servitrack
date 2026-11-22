import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowSquareOut, Bank, CaretDown, CheckCircle, Clock, CurrencyCircleDollar,
  DownloadSimple, Handshake, MagnifyingGlass, Money, Paperclip, Plus, Printer, QrCode,
  Receipt, TrendUp, Wallet, WarningCircle, WhatsappLogo,
} from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import {
  cancelUnpaidInvoice, createInvoice, createOfflinePayment, createPaymentLink, getPayments, getPaymentSummary,
  getReadyToBill, handoverPaidInvoice, refundPaidInvoice, sendPaymentInfo,
  type InvoiceRow, type OfflinePaymentInput,
} from '../../lib/api';
import { printInvoice, type PrintableTicket } from '../../lib/ticket-print';

type Row = Record<string, any>;
type PaymentMethod = 'cash' | 'bank_transfer' | 'qris_static' | 'ewallet' | 'edc';

const methods: { value: PaymentMethod; label: string; icon: typeof Money }[] = [
  { value: 'cash', label: 'Tunai', icon: Money },
  { value: 'bank_transfer', label: 'Transfer bank manual', icon: Bank },
  { value: 'qris_static', label: 'QRIS statis', icon: QrCode },
  { value: 'ewallet', label: 'E-wallet', icon: Wallet },
  { value: 'edc', label: 'Kartu / EDC', icon: CurrencyCircleDollar },
];
const methodFilters: [string, string][] = [
  ...methods.map((item) => [item.value, item.label] as [string, string]),
  ['midtrans', 'Midtrans Online'], ['qris', 'QRIS (historis)'], ['va', 'Transfer bank (historis)'],
];
const methodLabels: Record<string, string> = {
  cash: 'Tunai', bank_transfer: 'Transfer bank manual', qris_static: 'QRIS statis', ewallet: 'E-wallet', edc: 'Kartu / EDC',
  midtrans: 'Midtrans Online', qris: 'QRIS', va: 'Transfer bank',
};
const statusLabels: Record<string, string> = { unpaid: 'Belum bayar', paid: 'Lunas', cancelled: 'Batal' };
const statusClass: Record<string, string> = {
  unpaid: 'bg-amber-50 text-amber-800 outline-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  cancelled: 'bg-stone-100 text-stone-600 outline-stone-200',
};
const MIDTRANS_AUTO_REFUND_TYPES = new Set(['credit_card', 'gopay', 'qris', 'shopeepay', 'akulaku']);
const rupiah = (value: number | string | null | undefined) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value ?? 0));

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadCsv(rows: Row[]) {
  const columns = ['No Invoice', 'Tiket', 'Tracking', 'Pelanggan', 'Total', 'Status', 'Metode', 'Referensi', 'Tanggal Invoice', 'Tanggal Bayar'];
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((row) => [
    row.invoice_no, row.ticket_code, row.tracking_code, row.customer_name, row.invoice_total,
    statusLabels[row.invoice_status] ?? row.invoice_status, methodLabels[row.method] ?? row.method,
    row.reference_no, row.issued_at, row.paid_at,
  ].map(quote).join(','));
  const url = URL.createObjectURL(new Blob([[columns.map(quote).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pembayaran-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cashierOpen, setCashierOpen] = useState(false);
  const [cashierSearch, setCashierSearch] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [externalRefundConfirmed, setExternalRefundConfirmed] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const idempotency = useRef(idempotencyKey());

  const paymentsQuery = useQuery({ queryKey: ['payments', status, methodFilter, from, to, search], queryFn: () => getPayments({ status, method: methodFilter, from, to, search }) });
  const cashierPaymentsQuery = useQuery({ queryKey: ['payments', 'cashier-options'], queryFn: () => getPayments() });
  const summaryQuery = useQuery({ queryKey: ['payments-summary'], queryFn: getPaymentSummary });
  const readyQuery = useQuery({ queryKey: ['invoices-ready'], queryFn: getReadyToBill });
  const rows: Row[] = paymentsQuery.data ?? [];
  const cashierRows: Row[] = cashierPaymentsQuery.data ?? [];
  const ready: Row[] = readyQuery.data ?? [];
  const selected = rows.find((row) => row.invoice_id === invoiceId) ?? cashierRows.find((row) => row.invoice_id === invoiceId) ?? null;

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['payments-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['invoices-ready'] }),
  ]);

  const issueInvoice = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (invoice) => {
      setFeedback(`${invoice.invoice_no} dibuat dari rincian biaya final.`);
      setError('');
      setInvoiceId(invoice.id);
      await invalidate();
    },
    onError: (issueError: any) => setError(issueError?.response?.data?.error || 'Gagal membuat invoice.'),
  });
  const payOffline = useMutation({
    mutationFn: ({ input, selectedProof }: { input: OfflinePaymentInput; selectedProof: File | null }) => createOfflinePayment(input, selectedProof),
    onSuccess: async (_result) => {
      setFeedback('Pelunasan berhasil dicatat. Invoice sekarang Lunas.');
      setError('');
      idempotency.current = idempotencyKey();
      await invalidate();
    },
    onError: (paymentError: any) => setError(paymentError?.response?.data?.error || 'Gagal mencatat pembayaran.'),
  });
  const onlineLink = useMutation({
    mutationFn: () => createPaymentLink(invoiceId, idempotency.current),
    onSuccess: async (result) => {
      idempotency.current = idempotencyKey();
      const sent = ['sent', 'delivered'].includes(result.notification?.status);
      const pending = result.notification?.status === 'queued';
      setFeedback(sent ? 'Tautan dibuat dan dikirim melalui WhatsApp bengkel.' : pending ? 'Tautan dibuat dan pengiriman WhatsApp sedang diproses.' : result.notification?.deduplicated ? 'Permintaan WhatsApp baru saja diproses. Tunggu 30 detik sebelum mencoba lagi.' : 'Tautan dibuat, tetapi WhatsApp gagal mengirim. Tunggu sebentar sebelum mencoba lagi.');
      setError(sent || pending || result.notification?.deduplicated ? '' : (result.notification?.error || 'WhatsApp gagal mengirim tautan pembayaran.'));
      await invalidate();
    },
    onError: (linkError: any) => setError(linkError?.response?.data?.error || 'Gagal membuat tautan pembayaran.'),
  });
  const sendInfo = useMutation({
    mutationFn: (selectedId: string) => sendPaymentInfo(selectedId),
    onSuccess: async (result) => {
      const sent = ['sent', 'delivered'].includes(result.status);
      const pending = result.status === 'queued';
      setFeedback(sent ? 'Info pembayaran terkirim lewat WhatsApp bengkel.' : pending ? 'Pengiriman info pembayaran sedang diproses.' : result.deduplicated ? 'Permintaan WhatsApp baru saja diproses. Tunggu 30 detik sebelum mencoba lagi.' : 'Info tersimpan, tetapi WhatsApp gagal mengirim. Tunggu sebentar sebelum mencoba lagi.');
      setError(sent || pending || result.deduplicated ? '' : (result.error || 'WhatsApp gagal mengirim info pembayaran.'));
      await invalidate();
    },
    onError: (sendError: any) => setError(sendError?.response?.data?.error || 'Gagal mengirim info pembayaran.'),
  });
  const handover = useMutation({
    mutationFn: () => handoverPaidInvoice(invoiceId),
    onSuccess: async () => { setFeedback('Serah terima perangkat tercatat.'); setError(''); await invalidate(); },
    onError: (handoverError: any) => setError(handoverError?.response?.data?.error || 'Gagal mencatat serah terima.'),
  });
  const refund = useMutation({
    mutationFn: () => refundPaidInvoice(invoiceId, refundReason, externalRefundConfirmed, refundReference),
    onSuccess: async (result) => {
      setRefundOpen(false); setRefundReason(''); setRefundReference(''); setExternalRefundConfirmed(false);
      setFeedback(result.invoice_status === 'unpaid' ? 'Pembayaran historis dikembalikan. Invoice tetap menunggu pelunasan penuh.' : 'Refund dicatat dengan alasan. Status invoice menjadi Batal.');
      setError(''); await invalidate();
    },
    onError: (refundError: any) => setError(refundError?.response?.data?.error || 'Gagal memproses refund.'),
  });
  const cancel = useMutation({
    mutationFn: () => cancelUnpaidInvoice(invoiceId, cancelReason),
    onSuccess: async () => { setCancelOpen(false); setCancelReason(''); setFeedback('Invoice dibatalkan dengan alasan.'); setError(''); await invalidate(); },
    onError: (cancelError: any) => setError(cancelError?.response?.data?.error || 'Gagal membatalkan invoice.'),
  });
  const paymentMessagePending = onlineLink.isPending || sendInfo.isPending;

  useEffect(() => {
    if (!selected) return;
    setMethod('cash');
    setCashReceived(String(Number(selected.invoice_total ?? 0)));
    setReference('');
    setProof(null);
    setRefundOpen(false);
    setRefundReason('');
    setRefundReference('');
    setExternalRefundConfirmed(false);
    setCancelOpen(false);
    setCancelReason('');
    setError('');
    setFeedback('');
    idempotency.current = idempotencyKey();
  }, [selected?.invoice_id]);

  const summary = summaryQuery.data;
  const cashierChoices: Row[] = useMemo(() => {
    const term = cashierSearch.trim().toLocaleLowerCase();
    const unpaid = cashierRows.filter((row) => row.invoice_status === 'unpaid').map((row) => ({ ...row, kind: 'invoice' }));
    const available: Row[] = [...unpaid, ...ready.map((ticket) => ({ ...ticket, kind: 'ready' }))];
    if (!term) return available;
    return available.filter((item) => [item.invoice_no, item.ticket_code, item.customer_name, item.tracking_code]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(term)));
  }, [cashierSearch, cashierRows, ready]);

  const openCashier = (id = '') => {
    setInvoiceId(id);
    setCashierSearch('');
    setFeedback('');
    setError('');
    setCashierOpen(true);
  };
  const createInvoiceFromTicket = (ticketId: string) => issueInvoice.mutate(ticketId);
  const processPayment = () => {
    if (!selected) return;
    const amount = Number(selected.invoice_total);
    payOffline.mutate({ input: {
      invoice_id: selected.invoice_id,
      method,
      amount,
      reference_no: reference.trim() || undefined,
      cash_received: method === 'cash' ? Number(cashReceived) : undefined,
      idempotency_key: idempotency.current,
    }, selectedProof: proof });
  };
  const printReceipt = (row: Row) => printInvoice(row as PrintableTicket, row as unknown as InvoiceRow);
  const due = Number(selected?.invoice_total ?? 0);
  const change = method === 'cash' ? Math.max(0, Number(cashReceived || 0) - due) : 0;
  const legacyRefund = selected?.invoice_status === 'unpaid' && Number(selected.paid_amount) > 0;
  const legacyFullRefund = selected?.invoice_status === 'paid' && Number(selected.paid_amount) >= Number(selected.invoice_total) && !selected.is_full_settlement;
  const refundMustBeExternal = Boolean(legacyRefund || legacyFullRefund) ||
    (selected?.gateway === 'midtrans' && !(selected.gateway_status === 'settlement' && MIDTRANS_AUTO_REFUND_TYPES.has(selected.gateway_payment_type)));

  return (
    <div className="page-enter flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pembayaran &amp; Kasir</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">Tagih biaya final, catat pelunasan penuh, lalu serahkan perangkat dengan jejak transaksi yang jelas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCsv(rows)}><DownloadSimple weight="bold" />Ekspor CSV</Button>
          <Button size="sm" onClick={() => openCashier()}><Plus weight="bold" />Kasir Baru</Button>
        </div>
      </header>

      <section aria-label="Ringkasan pembayaran" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total tagihan" value={summaryQuery.isError ? '—' : rupiah(summary?.total_billed)} note="Total invoice aktif" icon={Receipt} tone="sky" />
        <Kpi label="Total dibayar" value={summaryQuery.isError ? '—' : rupiah(summary?.total_paid)} note="Pembayaran yang sudah diterima" icon={CheckCircle} tone="green" />
        <Kpi label="Menunggu pembayaran" value={summaryQuery.isLoading ? '…' : summaryQuery.isError ? '—' : `${summary?.waiting_count ?? 0} invoice`} note="Belum lunas" icon={Clock} tone="amber" />
        <Kpi label="Transaksi hari ini" value={summaryQuery.isLoading ? '…' : summaryQuery.isError ? '—' : `${summary?.transactions_today ?? 0}`} note="Pembayaran lunas hari ini" icon={TrendUp} tone="violet" />
      </section>
      {summaryQuery.isError && <p role="alert" className="-mt-3 text-xs text-rose-700">Ringkasan pembayaran gagal dimuat.</p>}

      <section aria-labelledby="ready-to-bill-heading" className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-1 border-b border-black/5 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="ready-to-bill-heading" className="text-sm font-bold text-zinc-900">Siap ditagih</h2><p className="mt-1 text-xs text-stone-600">Servis selesai tanpa invoice. Nominal dihitung dari biaya final tiket.</p></div>
          <span className="text-xs font-medium tabular-nums text-stone-500">{ready.length} tiket</span>
        </div>
        {readyQuery.isLoading ? <p className="px-5 py-6 text-xs text-stone-500">Memuat tiket selesai…</p> : readyQuery.isError ? <p role="alert" className="px-5 py-6 text-xs text-rose-700">Tiket siap ditagih gagal dimuat.</p> : ready.length === 0 ? (
          <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-zinc-900">Semua tiket selesai sudah memiliki invoice</p><p className="mt-1 text-xs text-stone-500">Tiket baru akan muncul di sini setelah statusnya Selesai.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-black/5 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500"><th className="px-5 py-3">Tiket</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3">Status tiket</th><th className="px-4 py-3 text-right">Biaya final</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead>
              <tbody>{ready.map((ticket) => <tr key={ticket.id} className="border-b border-black/5 last:border-0 hover:bg-sky-50/40">
                <td className="px-5 py-3"><span className="font-mono text-xs font-semibold text-zinc-900">{ticket.ticket_code}</span><span className="mt-0.5 block text-[11px] text-stone-500">{ticket.device_model || 'Perangkat'}</span></td>
                <td className="px-4 py-3 text-xs text-zinc-800">{ticket.customer_name || '—'}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{ticket.current_status === 'batal' ? 'Batal' : ticket.current_status === 'siap_diambil' ? 'Siap diambil' : 'Selesai'}</span></td>
                <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-zinc-900">{rupiah(ticket.cost?.finalCost)}</td>
                <td className="px-5 py-3 text-right"><Button size="sm" disabled={issueInvoice.isPending} onClick={() => createInvoiceFromTicket(ticket.id)}>{issueInvoice.isPending ? 'Membuat…' : 'Buat invoice'}</Button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 border-b border-black/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-60 flex-1">
            <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari invoice, tiket, tracking, pelanggan…" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Semua status" value={status} onChange={setStatus} options={[
              ['unpaid', 'Belum bayar'], ['paid', 'Lunas'], ['cancelled', 'Batal'],
            ]} />
            <FilterSelect label="Semua metode" value={methodFilter} onChange={setMethodFilter} options={methodFilters} />
            <label className="sr-only" htmlFor="payments-from">Dari tanggal</label><Input id="payments-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-auto min-w-32 px-2 text-xs" />
            <label className="sr-only" htmlFor="payments-to">Sampai tanggal</label><Input id="payments-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-auto min-w-32 px-2 text-xs" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead><tr className="border-b border-black/5 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              <th className="px-5 py-3.5">Invoice</th><th className="px-4 py-3.5">Tiket</th><th className="px-4 py-3.5">Pelanggan</th><th className="px-4 py-3.5 text-right">Total</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Metode</th><th className="px-5 py-3.5 text-right">Aksi</th>
            </tr></thead>
            <tbody>
              {paymentsQuery.isLoading && <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-stone-500">Memuat invoice…</td></tr>}
              {paymentsQuery.isError && <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-rose-700">Invoice gagal dimuat. Periksa koneksi lalu muat ulang halaman.</td></tr>}
              {!paymentsQuery.isLoading && !paymentsQuery.isError && rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="text-sm font-semibold text-zinc-900">Belum ada invoice</p><p className="mt-1 text-xs text-stone-500">Tiket selesai tanpa invoice muncul pada daftar Siap ditagih.</p></td></tr>}
              {rows.map((row) => <tr key={row.invoice_id} className="border-b border-black/5 last:border-0 hover:bg-sky-50/40">
                <td className="px-5 py-3.5"><span className="font-mono text-xs font-semibold text-zinc-900">{row.invoice_no}</span><span className="mt-0.5 block text-[11px] text-stone-500">{row.issued_at ? new Date(row.issued_at).toLocaleDateString('id-ID') : '—'}</span></td>
                <td className="px-4 py-3.5 font-mono text-xs text-stone-600">{row.ticket_code || '—'}</td>
                <td className="px-4 py-3.5 text-xs text-zinc-800">{row.customer_name || '—'}{row.handed_over_at && <span className="mt-0.5 block text-[11px] text-emerald-700">Diserahkan oleh {row.handed_over_by_name || 'staf'} · {new Date(row.handed_over_at).toLocaleDateString('id-ID')}</span>}</td>
                <td className="px-4 py-3.5 text-right text-xs font-semibold tabular-nums text-zinc-900">{rupiah(row.invoice_total)}</td>
                <td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold outline outline-1 -outline-offset-1 ${statusClass[row.invoice_status] ?? statusClass.unpaid}`}>{statusLabels[row.invoice_status] ?? row.invoice_status}</span></td>
                <td className="px-4 py-3.5 text-xs text-stone-600">{methodLabels[row.method] ?? '—'}</td>
                <td className="px-5 py-3.5"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openCashier(row.invoice_id)} title="Lihat dan kelola invoice">Lihat</Button>
                   {row.invoice_status === 'unpaid' && <>
                    <Button variant="ghost" size="icon" disabled={paymentMessagePending} onClick={() => sendInfo.mutate(row.invoice_id)} title="Kirim info pembayaran via WhatsApp"><WhatsappLogo weight="bold" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openCashier(row.invoice_id)} title="Catat pelunasan"><Money weight="bold" /></Button>
                  </>}
                  <Button variant="ghost" size="icon" onClick={() => printReceipt(row)} title="Cetak struk"><Printer weight="bold" /></Button>
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {feedback && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{feedback}</p>}
      {error && !cashierOpen && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">{error}</p>}

      <Sheet open={cashierOpen} onOpenChange={(open) => { setCashierOpen(open); if (!open) setInvoiceId(''); }}>
        <SheetContent side="right" className="w-full max-w-none gap-0 overflow-y-auto border-l border-stone-200 p-0 sm:w-[min(620px,92vw)]">
          <SheetHeader className="border-b border-black/5 pr-16">
            <SheetTitle>{selected ? selected.invoice_no : 'Kasir Baru'}</SheetTitle>
            <SheetDescription>{selected ? `${selected.ticket_code} · ${selected.customer_name || 'Pelanggan'}` : 'Pilih invoice belum lunas atau tiket servis yang siap ditagih.'}</SheetDescription>
          </SheetHeader>
          {!selected ? (
            <div className="flex flex-col gap-4 p-5">
              <div className="relative"><MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" /><Input autoFocus value={cashierSearch} onChange={(event) => setCashierSearch(event.target.value)} placeholder="Cari tiket, invoice, atau pelanggan…" className="pl-9" /></div>
              <div className="flex flex-col divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
                {cashierChoices.map((item) => <div key={`${item.kind}-${item.id ?? item.invoice_id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-zinc-900">{item.kind === 'ready' ? item.ticket_code : item.invoice_no}</p><p className="mt-0.5 truncate text-[11px] text-stone-500">{item.customer_name || 'Pelanggan'} · {item.ticket_code || item.device_model || 'Servis selesai'}</p></div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-800">{rupiah(item.kind === 'ready' ? item.cost?.finalCost : item.invoice_total)}</span>
                  {item.kind === 'ready'
                    ? <Button size="sm" disabled={issueInvoice.isPending} onClick={() => createInvoiceFromTicket(item.id)}>Buat invoice</Button>
                    : <Button size="sm" variant="outline" onClick={() => setInvoiceId(item.invoice_id)}>Pilih</Button>}
                </div>)}
                {!cashierChoices.length && <p className="px-4 py-8 text-center text-xs text-stone-500">Tidak ada tiket atau invoice yang cocok.</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 p-5">
              <section className="rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-900">{selected.customer_name || 'Pelanggan'}</p><p className="mt-0.5 text-xs text-stone-500">Tiket {selected.ticket_code} · {selected.device_model || 'Perangkat'}</p></div><StatusBadge status={selected.invoice_status} /></div>
                <div className="mt-4 divide-y divide-black/5 border-y border-black/5">
                  {(selected.line_items ?? []).map((line: Row, index: number) => <div key={`${line.type}-${index}`} className="flex items-start justify-between gap-4 py-2.5 text-xs"><span className="min-w-0 text-stone-700">{line.name}<span className="mt-0.5 block text-[11px] text-stone-500">{line.quantity} × {rupiah(line.unit_price)}</span></span><span className="shrink-0 font-medium tabular-nums text-zinc-900">{rupiah(line.total)}</span></div>)}
                  {!selected.line_items?.length && <div className="py-3 text-xs text-stone-500">Snapshot rincian biaya tidak tersedia pada invoice lama.</div>}
                </div>
                <div className="flex items-center justify-between pt-3"><span className="text-xs font-semibold text-zinc-900">Total pelunasan</span><span className="text-lg font-bold tabular-nums text-zinc-900">{rupiah(selected.invoice_total)}</span></div>
                {Number(selected.paid_amount) > 0 && selected.invoice_status === 'unpaid' && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Invoice memiliki transaksi pembayaran lama yang perlu direkonsiliasi sebelum pelunasan baru.</p>}
              </section>

              {selected.invoice_status === 'unpaid' ? <>
                {selected.has_active_online && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><WarningCircle weight="fill" className="mr-1 inline size-4" />Ada transaksi Midtrans aktif. Tunggu kedaluwarsa sebelum menerima pembayaran offline.</p>}
                <section className="rounded-xl border border-black/10 bg-white p-4">
                  <h2 className="text-sm font-semibold text-zinc-900">Pelunasan penuh</h2>
                  <p className="mt-1 text-xs text-stone-600">Nominal pembayaran selalu sama dengan total invoice dan tidak dapat diubah.</p>
                  <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Nominal invoice<Input readOnly value={rupiah(selected.invoice_total)} className="bg-stone-100 font-semibold tabular-nums" /></label>
                  <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Metode pembayaran
                    <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="h-10 rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                      {methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  {method === 'cash' ? <>
                    <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Uang diterima<Input type="number" min={due} step="1" inputMode="numeric" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label>
                    <p className="mt-2 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5 text-xs"><span className="text-stone-600">Kembalian</span><strong className="tabular-nums text-zinc-900">{rupiah(change)}</strong></p>
                  </> : <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Nomor referensi{method !== 'qris_static' ? ' (wajib)' : ' (opsional)'}<Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Nomor transaksi / approval" /></label>}
                  <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Bukti pembayaran (opsional)<span className="flex items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-600"><Paperclip weight="bold" />{proof?.name ?? 'JPG, PNG, atau WebP — maks. 5 MB'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></span></label>
                  {proof && <button type="button" onClick={() => setProof(null)} className="mt-1 text-left text-[11px] font-medium text-rose-700 underline">Hapus {proof.name}</button>}
                  <Button className="mt-5 w-full" disabled={payOffline.isPending || selected.has_active_online || Number(selected.paid_amount) > 0 || (method !== 'cash' && method !== 'qris_static' && !reference.trim()) || (method === 'cash' && Number(cashReceived) < due)} onClick={processPayment}>
                    {payOffline.isPending ? 'Mencatat pelunasan…' : 'Catat pelunasan'}
                  </Button>
                </section>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" disabled={paymentMessagePending || legacyRefund} onClick={() => onlineLink.mutate()}><LinkIcon />{onlineLink.isPending ? 'Membuat tautan…' : 'Kirim tautan pembayaran'}</Button>
                  <Button variant="outline" disabled={paymentMessagePending} onClick={() => sendInfo.mutate(invoiceId)}><WhatsappLogo weight="bold" />{sendInfo.isPending ? 'Mengirim…' : 'Kirim info pembayaran via WhatsApp'}</Button>
                </div>
                {selected.has_active_online && selected.snap_url && <a href={selected.snap_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 underline-offset-4 hover:underline"><ArrowSquareOut weight="bold" className="size-4" />Buka tautan pembayaran aktif</a>}
                {legacyRefund && (refundOpen ? <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><p className="mb-3 text-xs leading-5 text-amber-900">Kembalikan dana pembayaran historis secara manual sebelum membuka kembali pelunasan penuh.</p><label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Alasan refund wajib<textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={3} maxLength={500} className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500" placeholder="Jelaskan alasan pengembalian dana" /></label><label className="mt-3 flex flex-col gap-1.5 text-xs font-medium text-stone-700">Referensi pengembalian (opsional)<Input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Nomor bukti transfer balik" /></label><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-stone-700"><input type="checkbox" checked={externalRefundConfirmed} onChange={(event) => setExternalRefundConfirmed(event.target.checked)} className="mt-1 accent-sky-600" />Saya sudah mengembalikan dana pembayaran lama.</label><div className="mt-3 flex gap-2"><Button variant="destructive" disabled={!refundReason.trim() || !externalRefundConfirmed || refund.isPending} onClick={() => refund.mutate()}>{refund.isPending ? 'Memproses…' : 'Catat refund historis'}</Button><Button variant="outline" onClick={() => setRefundOpen(false)}>Kembali</Button></div></div> : <Button variant="ghost" className="self-start text-amber-800" onClick={() => setRefundOpen(true)}>Rekonsiliasi pembayaran historis</Button>)}
                {cancelOpen ? <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Alasan pembatalan wajib<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} maxLength={500} className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500" placeholder="Jelaskan alasan invoice dibatalkan" /></label><div className="mt-3 flex gap-2"><Button variant="destructive" disabled={!cancelReason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? 'Membatalkan…' : 'Batalkan invoice'}</Button><Button variant="outline" onClick={() => setCancelOpen(false)}>Kembali</Button></div></div> : <Button variant="ghost" disabled={legacyRefund} className="self-start text-stone-600" onClick={() => setCancelOpen(true)}>Batalkan invoice dengan alasan</Button>}
              </> : selected.invoice_status === 'paid' ? <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle weight="fill" className="size-5" />Pembayaran lunas</p><p className="mt-1 text-xs leading-5 text-emerald-800">Perangkat siap diserahkan. Pelunasan telah tercatat di sistem.</p></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => printReceipt(selected)}><Printer weight="bold" />Cetak struk</Button>
                  {!selected.handed_over_at && <Button variant="outline" disabled={handover.isPending} onClick={() => handover.mutate()}><Handshake weight="bold" />{handover.isPending ? 'Mencatat…' : 'Catat serah terima'}</Button>}
                  {selected.handed_over_at && <p className="col-span-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">Diserahkan oleh {selected.handed_over_by_name || 'staf'} pada {new Date(selected.handed_over_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</p>}
                </div>
                {refundOpen ? <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4"><label className="flex flex-col gap-1.5 text-xs font-medium text-stone-700">Alasan refund wajib<textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={3} maxLength={255} className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500" placeholder="Jelaskan alasan koreksi/refund" /></label>{refundMustBeExternal && <div className="mt-3 flex flex-col gap-2 rounded-lg bg-white p-3"><label className="flex items-start gap-2 text-xs leading-5 text-stone-700"><input type="checkbox" checked={externalRefundConfirmed} onChange={(event) => setExternalRefundConfirmed(event.target.checked)} className="mt-1 accent-sky-600" />Saya sudah mengembalikan dana melalui Dashboard Midtrans atau transfer manual.</label><Input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Nomor referensi refund (opsional)" /></div>}<div className="mt-3 flex gap-2"><Button variant="destructive" disabled={!refundReason.trim() || refund.isPending || (refundMustBeExternal && !externalRefundConfirmed)} onClick={() => refund.mutate()}>{refund.isPending ? 'Memproses…' : 'Proses refund'}</Button><Button variant="outline" onClick={() => setRefundOpen(false)}>Kembali</Button></div></div> : <Button variant="ghost" className="self-start text-rose-700 hover:text-rose-800" onClick={() => setRefundOpen(true)}>Refund / koreksi dengan alasan</Button>}
              </> : <p className="rounded-lg bg-stone-100 px-4 py-3 text-xs text-stone-700">Invoice berstatus Batal dan tidak dapat dibayar.</p>}

              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">{error}</p>}
              {feedback && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{feedback}</p>}
              <div className="flex flex-wrap gap-2 border-t border-black/5 pt-4"><Button variant="outline" onClick={() => printReceipt(selected)}><Printer weight="bold" />Cetak invoice / struk</Button><Button variant="ghost" onClick={() => setInvoiceId('')}>Pilih tiket lain</Button></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LinkIcon() {
  return <ArrowSquareOut weight="bold" className="size-4" />;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold outline outline-1 -outline-offset-1 ${statusClass[status] ?? statusClass.unpaid}`}>{statusLabels[status] ?? status}</span>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <div className="relative"><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 appearance-none rounded-lg border border-stone-200 bg-white py-1.5 pl-3 pr-8 text-xs text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"><option value="">{label}</option>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select><CaretDown weight="bold" className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-500" /></div>;
}

function Kpi({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Receipt; tone: string }) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', violet: 'bg-violet-50 text-violet-700',
  };
  return <article className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
    <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1.5 truncate text-xl font-bold leading-7 tabular-nums text-zinc-900">{value}</p><p className="mt-0.5 text-[11px] text-stone-600">{note}</p></div>
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon weight="fill" className="size-5" /></span>
  </article>;
}
