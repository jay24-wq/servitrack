import { useState, useMemo } from 'react';
import { Package, LockKey, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { PARTS, angka, type Part } from '../../data/parts';

export default function TechnicianInventoryPage() {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return PARTS.filter(
      (part: Part) => keyword === '' || part.name.toLowerCase().includes(keyword) || part.id.toLowerCase().includes(keyword)
    );
  }, [query]);

  const lowStock = PARTS.filter((part) => part.stock < part.min).length;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Inventaris &amp; Stok Sparepart</h1>
          <p className="mt-0.5 text-sm leading-5 text-neutral-500">
            Cari cepat ketersediaan dan lokasi bin suku cadang untuk pengerjaan tiket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
            {lowStock} part menipis
          </span>
          <Button size="sm" className="h-auto gap-1.5 px-3.5 py-1.5 text-xs font-semibold">
            <Package weight="bold" className="size-3.5" /> Cek stok cabang lain
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-96 lg:min-w-60">
          <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Cari suku cadang berdasarkan nama atau ID part"
            placeholder="Cari suku cadang atau ID..."
            className="h-auto rounded-lg border-black/10 bg-stone-100 py-1.5 pl-9 pr-3 text-xs text-zinc-900 caret-sky-600 shadow-none placeholder:text-neutral-500 focus-visible:border-sky-500"
          />
        </div>
        <span className="text-xs leading-4 text-neutral-500 lg:ml-auto">
          Menampilkan <span className="font-bold text-zinc-900">{rows.length}</span> dari {PARTS.length} suku cadang
        </span>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-black/10 bg-white">
        <div className="ledger-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">
              Daftar suku cadang dengan sisa stok, lokasi bin, dan harga satuan
            </caption>
            <thead>
              <tr className="border-b border-black/10 bg-stone-50">
                <th scope="col" className="px-4 py-4 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Nama suku cadang
                </th>
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Sisa stok
                </th>
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Stok min.
                </th>
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Lokasi bin
                </th>
                <th scope="col" className="px-4 py-4 text-right text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Harga satuan
                </th>
                <th scope="col" className="px-4 py-4 text-right text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((part, index) => {
                const menipis = part.stock < part.min;
                return (
                  <tr
                    key={part.id}
                    className={cn(
                      'border-t border-black/5 align-middle transition-colors hover:bg-sky-50/40',
                      menipis ? 'bg-rose-50/20' : index % 2 === 1 && 'bg-stone-50/40'
                    )}
                  >
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold leading-4 text-zinc-900">{part.name}</span>
                      <span className="mt-0.5 block font-mono text-[11px] leading-4 text-neutral-500">
                        {part.id} · {part.spec}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {menipis ? (
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold leading-4 text-rose-700 outline outline-1 outline-rose-200">
                          Menipis: {part.stock} {part.unit}
                        </span>
                      ) : (
                        <span className="text-xs leading-4 text-zinc-900">
                          <span className="font-bold tabular-nums">{part.stock}</span>{' '}
                          <span className="font-normal text-neutral-500">{part.unit}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium leading-4 tabular-nums text-neutral-500">
                      {part.min} {part.unit}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-zinc-100 px-2 py-0.5 font-mono text-xs font-normal leading-4 text-stone-700 outline outline-1 outline-black/5">
                        <LockKey weight="bold" className="size-3 text-stone-400" />
                        {part.bin}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-medium leading-4 tabular-nums text-zinc-900">
                      Rp {angka(part.price)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700"
                      >
                        Gunakan pada tiket
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <span className="block text-sm font-semibold text-neutral-900">Tidak ada suku cadang yang cocok</span>
                    <span className="mt-1 block text-xs text-neutral-500">Coba periksa kembali kata kunci pencarian.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
