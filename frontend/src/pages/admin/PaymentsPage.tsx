import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Bank, CalendarBlank, CheckCircle, DownloadSimple, MagnifyingGlass, Money, Plus, Printer, QrCode, Receipt, TrendUp, Wallet, WarningCircle, CaretDown } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { getPayments } from '../../lib/api';

const METHODS = ['Cash', 'QRIS', 'VA', 'E-Wallet'] as const;
const STATUSES = ['Belum Bayar', 'DP', 'Lunas'] as const;

const formatRupiah = (value: number | null | undefined) => 
  value === null || value === undefined 
    ? '-' 
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const dateValue = (value: unknown) => value ? new Date(String(value)) : null;

const dayKey = (value: unknown) => { 
  const date = dateValue(value); 
  return date ? date.toISOString().slice(0, 10) : ''; };

const METHOD_ICON: Record<string, any> = { Cash: Money, QRIS: QrCode, VA: Bank, 'E-Wallet': Wallet };
const STATUS_CLASS: Record<string, string> = { 
  Lunas: 'bg-emerald-50 text-emerald-700 outline-emerald-200', 
  DP: 'bg-amber-50 text-amber-800 outline-amber-200', 
  'Belum Bayar': 'bg-rose-50 text-rose-700 outline-rose-200' 
};

function downloadCsv(rows: any[]) {
  const header = ['Invoice', 'Ticket', 'Tracking', 'Pelanggan', 'Total', 'Status', 'Metode', 'Tanggal Invoice', 'Tanggal Bayar'];
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((row) => [
    row.invoice_no, 
    row.ticket_code, 
    row.tracking_code, 
    row.customer_name, 
    row.invoice_total, 
    row.invoice_status, 
    row.method, 
    row.issued_at, 
    row.paid_at
  ].map(quote).join(','));
  
  const url = URL.createObjectURL(new Blob([[header.map(quote).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); 
  link.href = url; 
  link.download = `pembayaran-${new Date().toISOString().slice(0, 10)}.csv`; 
  link.click(); 
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const [search, setSearch] = useState(''); 
  const [status, setStatus] = useState(''); 
  const [method, setMethod] = useState(''); 
  const [from, setFrom] = useState(''); 
  const [to, setTo] = useState('');
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({ 
    queryKey: ['payments', status, method, from, to, search], 
    queryFn: () => getPayments({ status, method, from, to, search }) 
  });

  const rows = data ?? [];

  const stats = useMemo(() => {
    const invoices = new Map<string, any>(); 
    rows.forEach((row: any) => invoices.set(row.invoice_id, row));

    const invoiceRows = [...invoices.values()]; 
    const totalInvoice = invoiceRows.reduce((sum, row) => sum + Number(row.invoice_total ?? 0), 0); 
    const totalPaid = rows.reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0); 
    const today = dayKey(new Date());

    const overdue = invoiceRows.filter((row) => 
      row.invoice_status !== 'Lunas' && 
      dateValue(row.issued_at) && 
      dateValue(row.issued_at)!.getTime() < Date.now() - 30 * 86400000
    );

    const todayRows = rows.filter((row: any) => dayKey(row.paid_at || row.created_at) === today);

    return { 
      totalInvoice, 
      totalPaid, 
      unpaid: invoiceRows.filter((row) => row.invoice_status !== 'Lunas')
        .reduce((sum, row) => sum + Math.max(0, Number(row.invoice_total ?? 0) - Number(row.paid_amount ?? 0)), 0), 
      invoiceCount: invoiceRows.length, 
      overdue: overdue.length, 
      todayCount: todayRows.length, 
      completion: totalInvoice ? Math.round((totalPaid / totalInvoice) * 100) : 0 
    };
  }, [rows]);

  const card = (label: string, value: string, secondary: string, footer: string, icon: any, tile: string, action?: () => void) => { 
    const Icon = icon; 
    return <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">{label}</span>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tile}`}>
          <Icon weight="bold" className="size-5" />
        </span>
      </div>
      <span className="mt-2 text-2xl font-bold leading-8 tabular-nums text-zinc-900">{value}</span>
      <span className="mt-1 text-xs leading-4 text-neutral-500">{secondary}</span>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
        <span className="text-xs text-stone-600">{footer}</span>
        {action && <button type="button" onClick={action} className="text-xs font-semibold text-sky-600">
          Tindak lanjuti →
          </button>
        }
      </div>
    </div>
    ; 
  };

  return <div className="page-enter flex flex-col gap-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pembayaran &amp; Kasir</h1>
        <p className="mt-1 text-xs leading-4 text-stone-600">
          Kelola invoice, transaksi pelanggan, pelunasan tagihan, serta penyerahan perangkat servis.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadCsv(rows)} className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700">
          <DownloadSimple weight="bold" className="size-3.5 text-neutral-500" /> Ekspor CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700">
          <Printer weight="bold" className="size-3.5 text-neutral-500" /> Cetak Laporan
        </Button>
        <Button size="sm" className="h-auto gap-1.5 px-3.5 py-1.5 text-xs font-semibold">
          <Plus weight="bold" className="size-3.5" /> Kasir Baru
        </Button>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {card('Total tagihan', formatRupiah(stats.totalInvoice), `${stats.invoiceCount} invoice`, 'Jumlah invoice aktif', Receipt, 'bg-sky-100 text-sky-600')}
      {card('Total dibayar', formatRupiah(stats.totalPaid), `${stats.completion}% dari tagihan`, 'Persentase pelunasan', CheckCircle, 'bg-emerald-50 text-emerald-600')}
      {card('Belum dibayar', formatRupiah(stats.unpaid), `${stats.invoiceCount} invoice dipantau`, 'Invoice yang perlu follow-up', WarningCircle, 'bg-rose-100 text-rose-600', () => setStatus('Belum Bayar'))}
      {card('Piutang jatuh tempo', String(stats.overdue), 'invoice lebih dari 30 hari', 'Invoice overdue', CalendarBlank, 'bg-amber-100 text-amber-700')}
      {card('Transaksi hari ini', String(stats.todayCount), 'cash / QRIS / transfer', 'Pembayaran diterima', TrendUp, 'bg-purple-50 text-purple-700')}
    </div>

    <div className="flex flex-col overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-black/10">
      <div className="flex flex-col gap-3 border-b border-black/5 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-60 flex-1">
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-500" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Cari invoice, ticket, tracking, pelanggan..." 
            className="h-auto w-full rounded-lg border-black/10 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 caret-sky-600 shadow-none placeholder:text-neutral-400 focus-visible:border-sky-500" 
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              {status === "" ? "Semua status" : status}
              <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-stone-400">Filter Status</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setStatus("")}>
              <span className={status === "" ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                Semua status
              </span>
            </DropdownMenuItem>
            {STATUSES.map((item) => (
              <DropdownMenuItem key={item} onSelect={() => setStatus(item)}>
                <span className={status === item ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                  {item}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              {method === "" ? "Semua metode" : method}
              <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-stone-400">Filter Metode</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setMethod("")}>
              <span className={method === "" ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                Semua metode
              </span>
            </DropdownMenuItem>
            {METHODS.map((item) => (
              <DropdownMenuItem key={item} onSelect={() => setMethod(item)}>
                <span className={method === item ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                  {item}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1.5">
          {/* Input Tanggal 'Dari' */}
          <div className="relative">
            <button
              type="button"
              onClick={() => fromInputRef.current?.showPicker()}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              title="Pilih tanggal dari"
            >
              <CalendarBlank size={16} className="text-neutral-500" />
              <span>{from || "Dari"}</span>
            </button>
            <input
              ref={fromInputRef}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="sr-only absolute" // Sembunyikan elemen input asli
            />
          </div>

          <span className="text-xs text-neutral-400">-</span>

          {/* Input Tanggal 'Sampai' */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toInputRef.current?.showPicker()}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              title="Pilih tanggal sampai"
            >
              <CalendarBlank size={16} className="text-neutral-500" />
              <span>{to || "Sampai"}</span>
            </button>
            <input
              ref={toInputRef}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="sr-only absolute" // Sembunyikan elemen input asli
            />
          </div>
        </div>
      </div>
    </div>
    
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead>
          <tr className="border-b border-black/5 bg-stone-100">
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Invoice</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Ticket</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Tracking</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Pelanggan</th>
            <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-stone-600">Total</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Status</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Metode</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Tanggal Invoice</th>
            <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Tanggal Bayar</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && 
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-xs text-neutral-500">Memuat data pembayaran...</td>
            </tr>
          }
          
          {!isLoading && !rows.length && 
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center">
                <span className="block text-sm font-semibold text-zinc-900">Belum ada transaksi pembayaran</span>
                <span className="mt-1 block text-xs text-stone-500">Invoice akan muncul setelah ticket selesai dan invoice dibuat.</span>
              </td>
            </tr>
          }
          
          {rows.map((row: any) => { 
            const Icon = METHOD_ICON[row.method] ?? Wallet; 
            return <tr key={row.id} className="border-b border-black/5 transition-colors last:border-b-0 hover:bg-sky-50/40">
              <td className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-900">{row.invoice_no}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-stone-600">{row.ticket_code || '-'}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-stone-600">{row.tracking_code || '-'}</td>
              <td className="px-4 py-3.5 text-xs text-zinc-900">{row.customer_name || '-'}</td>
              <td className="px-4 py-3.5 text-right text-xs font-semibold tabular-nums text-zinc-900">{formatRupiah(row.invoice_total)}</td>
              <td className="px-4 py-3.5">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold outline outline-1 -outline-offset-1 ${STATUS_CLASS[row.invoice_status] ?? 'bg-stone-100 text-stone-700 outline-black/5'}`}>
                  {row.invoice_status}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <span className="flex items-center gap-1.5 text-xs text-stone-600">
                  <Icon size={14} />
                  {row.method || '-'}
                </span>
              </td>
              <td className="px-4 py-3.5 text-xs text-stone-500">
                {row.issued_at ? new Date(row.issued_at).toLocaleDateString('id-ID') : '-'}
              </td>
              <td className="px-4 py-3.5 text-xs text-stone-500">
                {row.paid_at ? new Date(row.paid_at).toLocaleDateString('id-ID') : '-'}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      </div>
    </div>
  </div>;
}
