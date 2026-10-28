// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addInventoryStock, createPart, getInventoryParts, deletePart, updatePart } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../store";
import TambahStokModal from "./TambahStokModal";
import MutasiModal from "./MutasiModal";
import EditPartModal from "./EditPartModal";
import StockInModal from "./StockInModal";
import { ArrowClockwise, ArrowRight, CaretDown, CaretLeft, CaretRight, ClockCounterClockwise, DownloadSimple, MagnifyingGlass, Package, PencilSimple, Plus, Trash, Wallet, WarningCircle, Wrench } from "@phosphor-icons/react";

const CATEGORY_STYLE = {
  LCD: "bg-blue-50 text-blue-700 outline-blue-200/60",
  Baterai: "bg-amber-50 text-amber-800 outline-amber-200/60",
  "IC Chipset": "bg-purple-50 text-purple-700 outline-purple-200/60",
  "Pasta & Lube": "bg-emerald-50 text-emerald-700 outline-emerald-200/60",
};

const rupiah = (n) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

const icons = {
  download: DownloadSimple,
  history: ClockCounterClockwise,
  plus: Plus,
  box: Package,
  alert: WarningCircle,
  wrench: Wrench,
  wallet: Wallet,
  search: MagnifyingGlass,
  chevronDown: CaretDown,
  chevronLeft: CaretLeft,
  chevronRight: CaretRight,
  reset: ArrowClockwise,
  edit: PencilSimple,
  trash: Trash,
};

const Ico = ({ name, size = 14, className }) => { const Icon = icons[name]; return <Icon size={size} className={className} weight="regular" aria-hidden="true" />; };

const CARD = "flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]";

const StatCard = ({ label, labelClass = "text-neutral-500", iconName, iconBox, iconColor, children, footer, tone }) => (
  <div className={tone === "rose" ? `${CARD} outline outline-1 -outline-offset-1 outline-rose-200/80` : CARD}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className={`text-xs font-semibold uppercase leading-4 tracking-wide ${labelClass}`}>{label}</span>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconBox}`}><Ico name={iconName} size={20} className={iconColor} /></span>
        </div>
        {children}
      </div>
      {footer}
    </div>
  </div>
);

const CardFooter = ({ left, right, borderClass = "border-black/5" }) => (
  <div className={`mt-4 flex items-center justify-between gap-3 border-t pt-3 ${borderClass}`}>
    <span className="text-xs leading-4 text-stone-600">{left}</span>
    {right}
  </div>
);

const SelectField = ({ value, onChange, options, ariaLabel, className = "" }) => (
  <div className={`relative ${className}`}>
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-lg bg-stone-100 py-1.5 pl-3 pr-8 text-xs leading-4 text-stone-700 outline outline-1 -outline-offset-1 outline-black/10 focus:outline-2 focus:outline-sky-600">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <Ico name="chevronDown" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
  </div>
);

const SORT_OPTIONS = [
  { value: "stok-asc", label: "Urutkan: Sisa Stok Terendah" },
  { value: "stok-desc", label: "Urutkan: Sisa Stok Tertinggi" },
  { value: "nama", label: "Urutkan: Nama (A-Z)" },
  { value: "harga-desc", label: "Urutkan: Harga Tertinggi" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status Stok" },
  { value: "low", label: "Stok Menipis" },
  { value: "ok", label: "Stok Aman" },
];

const INVENTORY_STATUS_OPTIONS = [
  { value: "active", label: "Part Aktif" },
  { value: "inactive", label: "Part Nonaktif" },
  { value: "all", label: "Semua Part" },
];

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const [inventoryStatus, setInventoryStatus] = useState("active");
  const { data: partsRaw = [] } = useQuery({ queryKey: ["inventory-parts", inventoryStatus], queryFn: () => getInventoryParts(inventoryStatus) });
  const [showStockModal, setShowStockModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editPart, setEditPart] = useState<any>(null);
  const [stockInPart, setStockInPart] = useState<any>(null);

  const parts = (partsRaw as any[]).map((p) => ({
    id: p.id,
    sku: p.sku,
    nama: p.name,
    deskripsi: p.spec || "",
    kategori: p.category || "Umum",
    stok: Number(p.stock_qty ?? 0),
    min: Number(p.min_stock ?? 0),
    satuan: p.unit || "pcs",
    harga: Number(p.sell_price ?? 0),
    bin: p.bin_location ?? "-",
    cost: Number(p.cost_price ?? 0),
    is_active: Boolean(p.is_active),
  }));

  const stats = useMemo(() => ({
    totalSku: parts.length,
    totalUnit: parts.reduce((s, p) => s + p.stok, 0),
    lowStock: parts.filter((p) => p.stok <= p.min).length,
    usedThisMonth: 0,
    usedGrowth: "+0% vs lalu",
    installedValue: rupiah(0),
    stockValue: rupiah(parts.reduce((s, p) => s + p.stok * p.cost, 0)),
    turnaround: "~- Hari",
  }), [parts]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("stok-asc");
  const rowsPerPage = "10";
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => [{ value: "all", label: "Semua Kategori" }, ...[...new Set(parts.map((p) => p.kategori))].map((k) => ({ value: k, label: k }))], [parts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = parts.filter((p) => {
      const isLow = p.stok <= p.min;
       return (!q || p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) && (category === "all" || p.kategori === category) && (status === "all" || (status === "low" ? isLow : !isLow));
    });
    const sorters = { "stok-asc": (a, b) => a.stok - b.stok, "stok-desc": (a, b) => b.stok - a.stok, nama: (a, b) => a.nama.localeCompare(b.nama), "harga-desc": (a, b) => b.harga - a.harga };
    return [...filtered].sort(sorters[sort]);
  }, [parts, query, category, status, sort]);

  const activeFilters = [query.trim(), category !== "all", status !== "all", inventoryStatus !== "active"].filter(Boolean).length;
  const resetFilters = () => { setQuery(""); setCategory("all"); setStatus("all"); setInventoryStatus("active"); setSort("stok-asc"); };

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Number(rowsPerPage)));
  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));
  const pageNumbers = totalPages <= 5 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, 2, 3, "gap", totalPages];
  const visibleRows = rows.slice((page - 1) * Number(rowsPerPage), page * Number(rowsPerPage));

  const exportCsv = () => {
    const headers = ["SKU", "Nama Part", "Kategori", "Stock Saat Ini", "Minimum Stock", "Harga Beli", "Harga Jual", "Status Stock"];
    const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((p) => [p.sku, p.nama, p.kategori, p.stok, p.min, p.cost, p.harga, p.stok <= p.min ? "Stok Menipis" : "Stok Aman"].map(csvValue).join(","));
    const blob = new Blob([`${headers.map(csvValue).join(",")}\n${body.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Management Inventaris</h1>
          <p className="mt-1 text-xs leading-4 text-stone-600">Monitor, restock, dan kelola ketersediaan suku cadang workshop secara efisien.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700" onClick={exportCsv}><Ico name="download" className="text-neutral-500" />Ekspor CSV</Button>
           <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700" onClick={() => setShowMovementModal(true)}><Ico name="history" className="text-neutral-500" />Riwayat Mutasi</Button>
           {role === "ADMIN" && <Button size="sm" className="h-auto gap-1.5 px-3.5 py-1.5 text-xs font-semibold" onClick={() => setShowStockModal(true)}><Ico name="plus" />Tambah Part Baru</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Suku Cadang" iconName="box" iconBox="bg-blue-50" iconColor="text-sky-600" footer={<CardFooter left="Total unit fisik tersimpan" right={<span className="text-xs font-semibold text-zinc-900">{stats.totalUnit} Pcs</span>} />}>
          <div className="flex items-baseline gap-2"><span className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{stats.totalSku}</span><span className="text-xs font-medium leading-4 text-neutral-500">Katalog SKU</span></div>
        </StatCard>
         <StatCard label="Stok Menipis & Kritis" labelClass="text-rose-700" iconName="alert" iconBox="bg-rose-100" iconColor="text-rose-600" tone="rose" footer={<CardFooter borderClass="border-rose-100" left={<span>Di bawah ambang minimum</span>} right={<Button variant="ghost" size="sm" className="h-auto gap-1 px-2 py-1 text-xs text-rose-600" onClick={() => setStatus("low")}>Periksa item <ArrowRight size={13} /></Button>} />}>
          <div className="flex items-center gap-2"><span className="text-3xl font-bold leading-9 tabular-nums text-rose-600">{stats.lowStock}</span><span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold leading-4 text-rose-700">Perlu Restock</span></div>
        </StatCard>
        <StatCard label="Part Terpakai Bulan Ini" iconName="wrench" iconBox="bg-zinc-100" iconColor="text-stone-700" footer={<CardFooter left="Nilai suku cadang terpasang" right={<span className="text-xs font-semibold text-zinc-900">{stats.installedValue}</span>} />}>
          <div className="flex items-center gap-2"><span className="text-3xl font-bold leading-9 tabular-nums text-zinc-900">{stats.usedThisMonth}</span><span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-xs font-medium leading-4 text-emerald-600">{stats.usedGrowth}</span></div>
        </StatCard>
        <StatCard label="Estimasi Nilai Stok" iconName="wallet" iconBox="bg-emerald-50" iconColor="text-emerald-600" footer={<CardFooter left="Perputaran stok (Turnaround)" right={<span className="text-xs font-medium text-stone-700">{stats.turnaround}</span>} />}>
          <span className="text-xl font-bold leading-7 tabular-nums text-zinc-900">{stats.stockValue}</span>
        </StatCard>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-2 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Ico name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari suku cadang atau ID..." className="h-11 w-full rounded-lg border-black/10 bg-stone-50 pl-10 pr-4 text-sm text-neutral-900 shadow-none placeholder:text-stone-400 focus-visible:border-sky-500" />
          </div>
           <SelectField ariaLabel="Filter kategori" value={category} onChange={setCategory} options={categoryOptions} className="w-44" />
           <SelectField ariaLabel="Filter status part" value={inventoryStatus} onChange={(value) => { setInventoryStatus(value); setPage(1); }} options={INVENTORY_STATUS_OPTIONS} className="w-44" />
           <SelectField ariaLabel="Filter status stok" value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-44" />
          <SelectField ariaLabel="Urutkan" value={sort} onChange={setSort} options={SORT_OPTIONS} className="w-52" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs leading-4 text-stone-500">Filter Aktif: <span className="font-medium text-zinc-900">{activeFilters ? `${activeFilters} filter` : "Semua"}</span></span>
          <Button variant="ghost" size="sm" className="h-auto p-1.5 text-stone-600" onClick={resetFilters} aria-label="Reset filter"><Ico name="reset" /></Button>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-black/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
            <thead>
              <tr className="bg-stone-100">
                <th className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">ID Part</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Nama Suku Cadang</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Kategori</th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Sisa Stok</th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Stok Min.</th>
                <th className="px-4 py-4 text-right text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Harga Satuan</th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Lokasi Bin</th>
                <th className="px-4 py-4 text-right text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-neutral-500">Tidak ada suku cadang yang cocok.</td></tr>)}
               {visibleRows.map((p) => {
                const isLow = p.stok <= p.min;
                return (
                  <tr key={p.id} className={`border-b border-black/5 align-top transition-colors last:border-b-0 hover:bg-sky-50/40 ${isLow ? "bg-rose-50/20" : ""}`}>
                     <td className="px-4 py-3.5 align-middle font-mono text-xs font-medium leading-4 text-neutral-500">{p.sku}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2"><span className="text-xs font-semibold leading-4 text-zinc-900">{p.nama}</span>{isLow && <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />}</div>
                      <p className="text-xs leading-4 text-neutral-500">{p.deskripsi}</p>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium leading-4 outline outline-1 -outline-offset-1 ${CATEGORY_STYLE[p.kategori] ?? "bg-zinc-100 text-stone-700 outline-black/5"}`}>{p.kategori}</span></td>
                    <td className="px-4 py-3.5 text-center align-middle">{isLow ? <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold leading-4 text-rose-700 outline outline-1 -outline-offset-1 outline-rose-200">Stok Menipis : {p.stok} {p.satuan}</span> : <span className="text-xs leading-4"><span className="font-bold text-zinc-900">{p.stok}</span> <span className="text-neutral-500">{p.satuan}</span></span>}</td>
                    <td className="px-4 py-3.5 text-center align-middle text-xs font-medium leading-4 text-neutral-500">{p.min} {p.satuan}</td>
                    <td className="px-4 py-3.5 text-right align-middle text-xs font-medium leading-4 text-zinc-900">{rupiah(p.harga)}</td>
                    <td className="px-4 py-3.5 text-center align-middle"><span className="inline-block rounded-sm bg-zinc-100 px-1.5 font-mono text-xs leading-4 text-stone-700 outline outline-1 -outline-offset-1 outline-black/5">{p.bin}</span></td>
                     <td className="px-4 py-3 align-middle"><div className="flex items-center justify-end gap-1">{role === "ADMIN" && <><button type="button" onClick={() => setEditPart(p)} aria-label={`Edit ${p.nama}`} className="rounded-sm p-1 text-neutral-500 hover:bg-black/5 hover:text-zinc-900"><Ico name="edit" /></button><button type="button" onClick={() => setStockInPart(p)} aria-label={`Tambah stok ${p.nama}`} className="rounded-sm p-1 text-neutral-500 hover:bg-sky-50 hover:text-sky-600"><Ico name="box" /></button><button type="button" onClick={async () => { if (window.confirm(`Nonaktifkan ${p.nama}?`)) { await deletePart(p.id); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); queryClient.invalidateQueries({ queryKey: ["inventory-parts", inventoryStatus] }); } }} aria-label={`Nonaktifkan ${p.nama}`} className="rounded-sm p-1 text-neutral-500 hover:bg-rose-50 hover:text-rose-600"><Ico name="trash" /></button></>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
           <span className="text-xs leading-4 text-zinc-600">Menampilkan <span className="font-medium text-zinc-900">{visibleRows.length ? `${(page - 1) * Number(rowsPerPage) + 1} - ${(page - 1) * Number(rowsPerPage) + visibleRows.length}` : "0"}</span> dari <span className="font-medium text-zinc-900">{totalItems}</span> suku cadang</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-medium" disabled={page === 1} onClick={() => goTo(page - 1)}><Ico name="chevronLeft" />Sebelumnya</Button>
            {pageNumbers.map((n, idx) => n === "gap" ? <span key={`gap-${idx}`} className="w-6 text-center text-xs font-bold tracking-wider text-stone-400">...</span> : <button key={n} type="button" onClick={() => goTo(n)} className={`flex size-8 items-center justify-center rounded-lg text-xs leading-4 transition-colors ${page === n ? "bg-sky-600 font-semibold text-white" : "font-medium text-zinc-600 hover:bg-stone-100"}`}>{n}</button>)}
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-medium" disabled={page === totalPages} onClick={() => goTo(page + 1)}>Berikutnya<Ico name="chevronRight" /></Button>
          </div>
        </div>
      </div>
      {showStockModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><TambahStokModal onClose={() => setShowStockModal(false)} onSubmit={async (payload) => { await createPart(payload); setShowStockModal(false); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); }} /></div>}
      {editPart && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><EditPartModal part={editPart} onClose={() => setEditPart(null)} onSubmit={async (payload) => { await updatePart(editPart.id, payload); setEditPart(null); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); queryClient.invalidateQueries({ queryKey: ["inventory-parts", inventoryStatus] }); }} /></div>}
      {stockInPart && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><StockInModal part={stockInPart} onClose={() => setStockInPart(null)} onSubmit={async (payload) => { await addInventoryStock(payload); setStockInPart(null); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); queryClient.invalidateQueries({ queryKey: ["inventory-parts", inventoryStatus] }); queryClient.invalidateQueries({ queryKey: ["inventory-movements"] }); }} /></div>}
      {showMovementModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><MutasiModal onClose={() => setShowMovementModal(false)} /></div>}
    </div>
  );
}

