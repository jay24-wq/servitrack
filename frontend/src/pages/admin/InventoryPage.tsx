// @ts-nocheck
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from 'react-router-dom';
import { addInventoryStock, cancelPartRequest, createPart, deletePart, getPartRequests, orderPartRequest, receivePartRequest, updatePart } from "../../lib/api";
import { useInventoryParts } from "../../hooks/useInventoryParts";
import { inventoryStockStatus, toIntegerPrice } from "../../lib/inventory-parts";
import { Button } from "../../components/ui/button";
import DataTablePagination from "../../components/ui/data-table-pagination";
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useAuthStore } from "../../store";
import { useBranchStore } from "../../store/branchStore";
import TambahStokModal from "./TambahStokModal";
import MutasiModal from "./MutasiModal";
import EditPartModal from "./EditPartModal";
import StockInModal from "./StockInModal";
import { RupiahInput } from "../../components/ui/rupiah-input";
import { ArrowClockwise, ArrowRight, CaretDown, ClockCounterClockwise, DownloadSimple, MagnifyingGlass, Package, PencilSimple, Plus, Trash, Wallet, WarningCircle, Wrench } from "@phosphor-icons/react";

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
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const branchId = useBranchStore((state) => state.currentBranch?.id);
  const canManagePartRequests = String(role ?? '').toUpperCase() === 'ADMIN';
  const [inventoryStatus, setInventoryStatus] = useState("active");
  const { data: partsRaw = [] } = useInventoryParts(inventoryStatus);
  const { data: activePartRows = [] } = useInventoryParts('active');
  const [showStockModal, setShowStockModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editPart, setEditPart] = useState<any>(null);
  const [stockInPart, setStockInPart] = useState<any>(null);
  const [requestStatus, setRequestStatus] = useState('active');
  const [receivingRequest, setReceivingRequest] = useState<any>(null);
  const [receivePartId, setReceivePartId] = useState('');
  const [receiveQty, setReceiveQty] = useState('');
  const [receivePrice, setReceivePrice] = useState('');
  const [newPartRequest, setNewPartRequest] = useState<any>(null);
  const [requestActionMessage, setRequestActionMessage] = useState('');
  const [requestActionError, setRequestActionError] = useState('');
  const { data: requestsResponse, isLoading: requestsLoading, isError: requestsError } = useQuery({
    queryKey: ['part-requests', tenantId, branchId, requestStatus],
    queryFn: () => getPartRequests(requestStatus),
  });
  const partRequests = requestsResponse?.data ?? [];
  const requestSummary = requestsResponse?.summary ?? { OPEN: 0, ORDERED: 0, RECEIVED: 0, PENDING_APPROVAL: 0 };
  const activeParts = (activePartRows as any[]).map((part) => ({ id: part.id, sku: part.sku, name: part.name, stock: Number(part.stock_qty ?? 0), cost: Number(part.cost_price ?? 0) }));
  const partRequestQueryKey = ['part-requests', tenantId, branchId];
  const invalidatePartRequestViews = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: partRequestQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['inventory-parts'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
    queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  ]);
  const orderPartMutation = useMutation({
    mutationFn: (input: { id: string; days?: number }) => orderPartRequest(input.id, input.days),
    onSuccess: async (_data, input) => { setRequestActionError(''); setRequestActionMessage(input.days ? 'Status ORDERED dan estimasi kedatangan diperbarui.' : 'Permintaan part ditandai ORDERED.'); await invalidatePartRequestViews(); },
    onError: (error: any) => setRequestActionError(error?.response?.data?.error ?? 'Gagal memperbarui status permintaan part.'),
    retry: false,
  });
  const cancelPartMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) => cancelPartRequest(input.id, input.reason),
    onSuccess: async () => { setRequestActionError(''); setRequestActionMessage('Permintaan part dibatalkan.'); await invalidatePartRequestViews(); },
    onError: (error: any) => setRequestActionError(error?.response?.data?.error ?? 'Gagal membatalkan permintaan part.'),
    retry: false,
  });
  const receivePartMutation = useMutation({
    mutationFn: () => receivePartRequest(receivingRequest.id, {
      linked_part_id: receivePartId,
      qty_received: Number(receiveQty),
      actual_price: receivePrice === '' ? undefined : Number(receivePrice),
    }),
    onSuccess: async (result: any) => {
      setRequestActionError('');
      const difference = Number(result.price_difference ?? 0);
      setRequestActionMessage(difference === 0
        ? `Part diterima dan ditautkan ke ${result.part?.name ?? 'inventory'}.`
        : `Part diterima. Selisih harga aktual dari estimasi quotation: ${difference > 0 ? '+' : ''}${rupiah(difference)} per unit.`);
      setReceivingRequest(null);
      setReceivePartId('');
      setReceiveQty('');
      setReceivePrice('');
      await invalidatePartRequestViews();
    },
    onError: (error: any) => setRequestActionError(error?.response?.data?.error ?? 'Gagal menerima permintaan part.'),
    retry: false,
  });

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
    lowStock: parts.filter((p) => inventoryStockStatus(p.stok, p.min) !== 'Aman').length,
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
      const isLow = inventoryStockStatus(p.stok, p.min) !== 'Aman';
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
  const visibleRows = rows.slice((page - 1) * Number(rowsPerPage), page * Number(rowsPerPage));

  const exportCsv = () => {
    const headers = ["SKU", "Nama Part", "Kategori", "Stock Saat Ini", "Minimum Stock", "Harga Beli", "Harga Jual", "Status Stock"];
    const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((p) => [p.sku, p.nama, p.kategori, p.stok, p.min, p.cost, p.harga, `Stok ${inventoryStockStatus(p.stok, p.min)}`].map(csvValue).join(","));
    const blob = new Blob([`${headers.map(csvValue).join(",")}\n${body.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const markPartOrdered = (request) => {
    const entered = window.prompt('Estimasi kedatangan terbaru (hari)', String(request.estimated_arrival_days));
    if (entered === null) return;
    const days = Number(entered);
    if (!Number.isSafeInteger(days) || days <= 0) return window.alert('Estimasi kedatangan harus bilangan bulat lebih dari 0.');
    orderPartMutation.mutate({ id: request.id, days });
  };

  const cancelPart = (request) => {
    const reason = window.prompt(`Alasan membatalkan permintaan ${request.requested_name}?`);
    if (reason === null) return;
    if (!reason.trim()) return window.alert('Alasan pembatalan wajib diisi.');
    cancelPartMutation.mutate({ id: request.id, reason: reason.trim() });
  };

  const startReceivePart = (request) => {
    setReceivingRequest(request);
    setReceivePartId('');
    setReceiveQty(String(request.qty));
    setReceivePrice(String(toIntegerPrice(request.estimated_price)));
  };

  const createPartFromRequest = async (payload: any) => {
    if (!newPartRequest) return;
    const part = await createPart({
      ...payload,
      part_request_id: newPartRequest.id,
      stock_qty: 0,
    });
    setRequestActionError('');
    setRequestActionMessage(`Part baru ${part.name} terdaftar dengan stok 0. Tautkan & restock saat part diterima.`);
    setReceivingRequest(newPartRequest);
    setReceivePartId(part.id);
    setReceiveQty(String(newPartRequest.qty));
    setReceivePrice(String(payload.cost_price));
    setNewPartRequest(null);
    await invalidatePartRequestViews();
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
            <MagnifyingGlass name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <Input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari suku cadang atau ID..." className="h-auto w-full rounded-lg border-black/10 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 caret-sky-600 shadow-none placeholder:text-neutral-400 focus-visible:border-sky-500" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                {categoryOptions.find(o => o.value === category)?.label || 'Kategori'}
                <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-stone-400">Filter Kategori</DropdownMenuLabel>
              {categoryOptions.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => { setCategory(option.value); setPage(1); }}>
                  <span className={category === option.value ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                    {option.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Status Part */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                {INVENTORY_STATUS_OPTIONS.find(o => o.value === inventoryStatus)?.label || 'Status Part'}
                <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-stone-400">Status Part</DropdownMenuLabel>
              {INVENTORY_STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => { setInventoryStatus(option.value); setPage(1); }}>
                  <span className={inventoryStatus === option.value ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                    {option.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Status Stok */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                {STATUS_OPTIONS.find(o => o.value === status)?.label || 'Status Stok'}
                <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-stone-400">Status Stok</DropdownMenuLabel>
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => { setStatus(option.value); setPage(1); }}>
                  <span className={status === option.value ? 'flex-1 font-bold text-sky-700' : 'flex-1'}>
                    {option.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                {SORT_OPTIONS.find((item) => item.value === sort)?.label}
                <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {SORT_OPTIONS.map((item) => (
                <DropdownMenuItem key={item.value} onSelect={() => { setSort(item.value); setPage(1); }}>
                  <span className={cn('flex-1', sort === item.value && 'font-bold text-sky-700')}>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                const stockStatus = inventoryStockStatus(p.stok, p.min);
                const isLow = stockStatus !== 'Aman';
                return (
                  <tr key={p.id} className={`border-b border-black/5 align-top transition-colors last:border-b-0 hover:bg-sky-50/40 ${isLow ? "bg-rose-50/20" : ""}`}>
                     <td className="px-4 py-3.5 align-middle font-mono text-xs font-medium leading-4 text-neutral-500">{p.sku}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2"><span className="text-xs font-semibold leading-4 text-zinc-900">{p.nama}</span>{isLow && <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />}</div>
                      <p className="text-xs leading-4 text-neutral-500">{p.deskripsi}</p>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium leading-4 outline outline-1 -outline-offset-1 ${CATEGORY_STYLE[p.kategori] ?? "bg-zinc-100 text-stone-700 outline-black/5"}`}>{p.kategori}</span></td>
                    <td className="px-4 py-3.5 text-center align-middle">{isLow ? <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold leading-4 text-rose-700 outline outline-1 -outline-offset-1 outline-rose-200">Stok {stockStatus} : {p.stok} {p.satuan}</span> : <span className="text-xs leading-4"><span className="font-bold text-zinc-900">{p.stok}</span> <span className="text-neutral-500">{p.satuan}</span></span>}</td>
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
        <DataTablePagination
          page={page}
          pageSize={Number(rowsPerPage)}
          totalItems={totalItems}
          totalPages={totalPages}
          visibleItems={visibleRows.length}
          itemLabel="suku cadang"
          onPageChange={goTo}
        />
      </div>
      <section className={CARD}>
        <div className="flex flex-col gap-3 border-b border-black/5 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Permintaan Part (Perlu Dibeli)</h2>
            <p className="mt-1 text-xs text-stone-600">Part custom hanya masuk daftar setelah pelanggan menyetujui quotation.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(['OPEN', 'ORDERED', 'RECEIVED'] as const).map((statusKey) => (
                <span key={statusKey} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                  {statusKey} <b className="ml-1 tabular-nums">{requestSummary[statusKey] ?? 0}</b>
                </span>
              ))}
              <span className="text-[11px] text-stone-500">{requestSummary.PENDING_APPROVAL ?? 0} menunggu persetujuan pelanggan</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            Filter status
            <select value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)} className="h-9 rounded-lg border border-black/10 bg-white px-2.5 text-xs text-zinc-900">
              <option value="active">OPEN + ORDERED</option>
              <option value="OPEN">OPEN</option>
              <option value="ORDERED">ORDERED</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="all">Semua status</option>
            </select>
          </label>
        </div>
        {requestActionMessage && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{requestActionMessage}</p>}
        {requestActionError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{requestActionError}</p>}
        {requestsError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">Gagal memuat permintaan part.</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead>
              <tr className="border-y border-black/10 bg-stone-50 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-3 py-3">Nama part</th><th className="px-3 py-3">Spesifikasi</th><th className="px-3 py-3 text-center">Qty</th>
                <th className="px-3 py-3 text-right">Estimasi harga</th><th className="px-3 py-3">Tiket</th><th className="px-3 py-3">Teknisi</th>
                <th className="px-3 py-3">Tanggal diminta</th><th className="px-3 py-3">Estimasi kedatangan</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requestsLoading ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-stone-500">Memuat permintaan part…</td></tr>
              ) : partRequests.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-stone-500">{requestStatus === 'active' ? 'Tidak ada part yang perlu dibeli.' : 'Tidak ada permintaan part untuk filter ini.'}</td></tr>
              ) : partRequests.map((request: any) => (
                <tr key={request.id} className="border-b border-black/5 align-top last:border-0">
                  <td className="px-3 py-3 font-semibold text-zinc-900">{request.requested_name}{request.linked_part_name && <span className="mt-1 block text-[10px] font-normal text-emerald-700">Tertaut: {request.linked_part_name} · {request.linked_part_sku}</span>}</td>
                  <td className="px-3 py-3 text-stone-600">{request.specification || '—'}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums">{request.qty}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{rupiah(Number(request.estimated_price))}{request.actual_price != null && Number(request.price_difference) !== 0 && <span className={`mt-1 block text-[10px] font-semibold ${Number(request.price_difference) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>Aktual {rupiah(Number(request.actual_price))} ({Number(request.price_difference) > 0 ? '+' : ''}{rupiah(Number(request.price_difference))}/unit)</span>}</td>
                  <td className="px-3 py-3"><Link to={`/tracking?resi=${encodeURIComponent(request.tracking_code ?? request.ticket_code)}`} className="font-mono font-semibold text-sky-700 hover:underline">{request.ticket_code}</Link></td>
                  <td className="px-3 py-3 text-stone-700">{request.technician_name}</td>
                  <td className="px-3 py-3 text-stone-600">{new Date(request.requested_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-3 py-3 text-stone-700">{request.estimated_arrival_days} hari</td>
                  <td className="px-3 py-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', request.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : request.status === 'ORDERED' ? 'bg-sky-100 text-sky-800' : request.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' : request.status === 'CANCELLED' ? 'bg-stone-200 text-stone-600' : 'bg-violet-100 text-violet-800')}>{request.status}</span>{request.cancelled_reason && <span className="mt-1 block max-w-36 text-[10px] text-stone-500">{request.cancelled_reason}</span>}</td>
                  <td className="px-3 py-3">
                    {!canManagePartRequests ? <span className="text-stone-400">Lihat saja</span> : (
                      <div className="flex min-w-48 flex-col gap-1.5">
                        {request.status === 'OPEN' && <Button size="sm" variant="outline" onClick={() => markPartOrdered(request)} disabled={orderPartMutation.isPending} className="h-8 text-[10px]">Tandai dipesan</Button>}
                        {request.status === 'ORDERED' && <Button size="sm" variant="outline" onClick={() => markPartOrdered(request)} disabled={orderPartMutation.isPending} className="h-8 text-[10px]">Perbarui estimasi</Button>}
                        {['OPEN', 'ORDERED'].includes(request.status) && (
                          receivingRequest?.id === request.id ? (
                            <div className="flex flex-col gap-1.5 rounded-md border border-stone-200 bg-stone-50 p-2">
                              <select value={receivePartId} onChange={(event) => setReceivePartId(event.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-[10px]">
                                <option value="">Pilih part inventory…</option>
                                {activeParts.map((part) => <option key={part.id} value={part.id}>{part.name} · {part.sku} · stok {part.stock}</option>)}
                              </select>
                              <input type="number" min={Number(request.qty)} step={1} value={receiveQty} onChange={(event) => setReceiveQty(event.target.value)} placeholder="Qty diterima" className="h-8 rounded border border-stone-300 bg-white px-2 text-[10px]" />
                              <RupiahInput id={`receive-price-${request.id}`} value={receivePrice} onChange={setReceivePrice} ariaLabel="Harga aktual per unit" placeholder="Harga aktual / unit" className="h-8 w-full rounded border border-stone-300 bg-white pl-8 pr-2 text-[10px] tabular-nums" />
                              <Button size="sm" onClick={() => receivePartMutation.mutate()} disabled={!receivePartId || Number(receiveQty) < Number(request.qty) || receivePartMutation.isPending} className="h-8 text-[10px]">{receivePartMutation.isPending ? 'Menerima…' : 'Tautkan & restock'}</Button>
                              <Button size="sm" variant="ghost" onClick={() => setReceivingRequest(null)} className="h-7 text-[10px]">Batal</Button>
                            </div>
                          ) : <Button size="sm" variant="outline" onClick={() => startReceivePart(request)} className="h-8 text-[10px]">Tautkan part diterima</Button>
                        )}
                        {request.status === 'ORDERED' && <Button size="sm" variant="outline" onClick={() => setNewPartRequest(request)} className="h-8 text-[10px]">Tambah Part Baru</Button>}
                        {!['CANCELLED', 'RECEIVED'].includes(request.status) && <Button size="sm" variant="ghost" onClick={() => cancelPart(request)} disabled={cancelPartMutation.isPending} className="h-7 text-[10px] text-rose-700">Batalkan request</Button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {showStockModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><TambahStokModal onClose={() => setShowStockModal(false)} onSubmit={async (payload) => { await createPart(payload); setShowStockModal(false); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); }} /></div>}
      {editPart && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><EditPartModal part={editPart} onClose={() => setEditPart(null)} onSubmit={async (payload) => { await updatePart(editPart.id, payload); setEditPart(null); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); queryClient.invalidateQueries({ queryKey: ["inventory-parts", inventoryStatus] }); }} /></div>}
      {stockInPart && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><StockInModal part={stockInPart} onClose={() => setStockInPart(null)} onSubmit={async (payload) => { await addInventoryStock(payload); setStockInPart(null); queryClient.invalidateQueries({ queryKey: ["inventory-parts"] }); queryClient.invalidateQueries({ queryKey: ["inventory-parts", inventoryStatus] }); queryClient.invalidateQueries({ queryKey: ["inventory-movements"] }); }} /></div>}
      {newPartRequest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><TambahStokModal partRequestId={newPartRequest.id} initialValues={{ name: newPartRequest.requested_name, spec: newPartRequest.specification ?? '', cost_price: String(toIntegerPrice(newPartRequest.estimated_price)), sell_price: '' }} onClose={() => setNewPartRequest(null)} onSubmit={createPartFromRequest} /></div>}
      {showMovementModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><MutasiModal onClose={() => setShowMovementModal(false)} /></div>}
    </div>
  );
}
