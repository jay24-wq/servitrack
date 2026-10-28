import { NotePencil, Plus, Trash, ArrowRight } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { useTicketStore } from '../../store';

interface QuoteItem {
  id: string;
  name: string;
  detail: string;
  price: number;
}

const ITEMS: QuoteItem[] = [
  { id: 'SRV-IC', name: 'Jasa Servis IC Power', detail: 'Biaya labor / jasa', price: 250000 },
  { id: 'PRT-012', name: 'IC Power Asus ROG PM8150', detail: 'Sparepart · Drawer C-03', price: 350000 },
];

function angka(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export default function TechnicianQuotationPage() {
  const { tickets } = useTicketStore();
  const subtotalPart = ITEMS.filter((item) => item.id.startsWith('PRT')).reduce((sum, item) => sum + item.price, 0);
  const subtotalJasa = ITEMS.filter((item) => item.id.startsWith('SRV')).reduce((sum, item) => sum + item.price, 0);
  const total = subtotalPart + subtotalJasa;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Quotation Builder</h1>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Susun penawaran biaya part dan jasa, lalu kirim ke pelanggan untuk otorisasi digital.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700">
          <Plus weight="bold" className="size-3.5 text-neutral-500" /> Tambah item lain
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-black/10 bg-white p-6 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 pb-5 border-b border-black/10">
              <NotePencil weight="fill" className="size-4 text-sky-600" />
              <h2 className="text-sm font-bold leading-5 text-zinc-900">Form Pengajuan Quotation</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-stone-600">Pilih tiket pengerjaan</span>
                <select
                  aria-label="Pilih tiket pengerjaan"
                  className="h-10 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium text-zinc-900 outline-none transition focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option>Pilih tiket...</option>
                  {tickets.map((ticket) => (
                    <option key={ticket.id}>
                      #{ticket.id} - {ticket.device}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-stone-600">Perkiraan pengerjaan</span>
                <select
                  aria-label="Perkiraan lama pengerjaan"
                  className="h-10 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium text-zinc-900 outline-none transition focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option>1–2 hari kerja</option>
                  <option>2–4 hari kerja</option>
                  <option>4–7 hari kerja</option>
                </select>
              </label>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Daftar biaya part &amp; jasa
                </h3>
              </div>

              <ul className="flex flex-col gap-2">
                {ITEMS.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-black/10 bg-stone-50 p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-zinc-900">{item.name}</span>
                      <span className="block text-[11px] text-neutral-500">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-900">
                      Rp {angka(item.price)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${item.name}`}
                      className="size-7 shrink-0 rounded-sm text-neutral-400 hover:bg-black/5 hover:text-rose-600"
                    >
                      <Trash weight="bold" className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-28 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-white shadow-lg shadow-black/10">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Ringkasan penawaran</h2>

            <dl className="mt-5 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Subtotal sparepart</dt>
                <dd className="font-semibold tabular-nums text-white">Rp {angka(subtotalPart)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Biaya jasa (labor)</dt>
                <dd className="font-semibold tabular-nums text-white">Rp {angka(subtotalJasa)}</dd>
              </div>
              <Separator className="bg-zinc-800" />
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-xs font-bold uppercase tracking-wide text-sky-400">Total biaya</dt>
                <dd className="text-2xl font-bold tabular-nums text-white">Rp {angka(total)}</dd>
              </div>
            </dl>

            <Button className="mt-6 h-11 w-full gap-2 bg-sky-600 text-xs font-bold uppercase tracking-wide text-white hover:bg-sky-500">
              Kirim ke WhatsApp <ArrowRight weight="bold" className="size-4" />
            </Button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-400">
              Sistem mengirim tautan rincian biaya ke WhatsApp pelanggan untuk persetujuan sebelum pengerjaan dilanjutkan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
