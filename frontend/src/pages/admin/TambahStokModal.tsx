import { useMemo, useState } from 'react';
import { ArrowClockwise, Plus, X } from '@phosphor-icons/react';
import { RupiahInput } from '../../components/ui/rupiah-input';
import { formatInventoryNumber, parseInventoryNumber } from '../../lib/inventory-parts';

const KATEGORI = [
  'Baterai & Power System', 
  'Layar & Display', 
  'Keyboard & Trackpad', 
  'Storage & Memori', 
  'Logic Board & Chip', 
  'Aksesori & Kabel'
];

const numberValue = (value: string) => Number(parseInventoryNumber(value)) || 0;

const randomSku = () => 
  `PRT-${String(Math.floor(Math.random() * 900) + 100)}`;

const inputClass = 
  'w-full rounded-lg bg-stone-100 px-3 py-1.5 text-xs leading-4 text-zinc-900 outline outline-1 -outline-offset-1 outline-black/10 placeholder:text-neutral-400 focus:bg-white focus:outline-2 focus:outline-sky-600';

const Label = ({ 
  htmlFor, 
  children 
}: { 
  htmlFor: string; 
  children: React.ReactNode 
}) => ( 
  <label 
    htmlFor={htmlFor} 
    className="text-xs font-semibold leading-4 text-stone-700">
    {children}
  </label>
);

const Field = ({ 
  id, 
  label, 
  value, 
  onChange, 
  className = '' 
}: { 
  id: string; 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  className?: string 
}) => ( 
  <div className={`flex flex-col gap-1 ${className}`}>
    <Label htmlFor={id}>{label}</Label>
    <input 
      id={id} 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      className={inputClass} 
    />
  </div>
);

const StockField = ({ 
  id, 
  label, 
  value, 
  onChange,
  disabled = false,
  note,
}: { 
  id: string; 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  disabled?: boolean;
  note?: string;
}) => ( 
  <div className="flex flex-1 flex-col gap-1">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-2">
      <input 
        id={id} 
        inputMode="numeric" 
        value={value} 
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} 
        disabled={disabled}
        aria-describedby={note ? `${id}-note` : undefined}
        className={`${inputClass} flex-1 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500`}
      />
      <span className="text-xs font-medium leading-4 text-neutral-500">pcs</span>
    </div>
    {note && <p id={`${id}-note`} className="text-[11px] leading-4 text-stone-600">{note}</p>}
  </div>
);

const PriceField = ({ 
  id, 
  label, 
  value, 
  onChange,
  placeholder,
}: { 
  id: string; 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  placeholder?: string;
}) => ( 
  <div className="flex flex-1 flex-col gap-1">
    <Label htmlFor={id}>{label}</Label>
    <RupiahInput id={id} value={value} onChange={onChange} placeholder={placeholder} className={`${inputClass} pl-9 font-mono font-semibold`} />
  </div>
);

export default function TambahStokModal({ 
  onClose, 
  onSubmit,
  initialValues,
  partRequestId,
}: { 
  onClose: () => void; 
  onSubmit: (payload: any) => Promise<void>;
  initialValues?: Partial<{ sku: string; category: string; name: string; spec: string; stock_qty: string; min_stock: string; cost_price: string; sell_price: string; bin_location: string }>;
  partRequestId?: string;
}) {
  const [form, setForm] = useState(() => ({ 
    sku: randomSku(), 
    category: KATEGORI[0], 
    name: '', 
    spec: '', 
    stock_qty: '1', 
    min_stock: '0', 
    cost_price: '', 
    sell_price: '', 
    bin_location: '',
    ...initialValues,
    ...(partRequestId ? { stock_qty: '0' } : {}),
  }));

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: string) => 
    setForm((current) => ({ ...current, [key]: value }));

  const total = useMemo(
    () => numberValue(form.stock_qty) * numberValue(form.cost_price), 
    [form.stock_qty, form.cost_price]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { 
      ...form, 
      stock_qty: partRequestId ? 0 : numberValue(form.stock_qty),
      min_stock: numberValue(form.min_stock), 
      cost_price: numberValue(form.cost_price), 
      sell_price: numberValue(form.sell_price), 
      unit: 'pcs',
      ...(partRequestId ? { part_request_id: partRequestId } : {}),
    };

    if (
      !form.name.trim() || 
      (!partRequestId && payload.stock_qty <= 0) ||
      payload.cost_price < 0 || 
      payload.sell_price < 0
    ) { 
      setError(
        partRequestId
          ? 'Nama part wajib diisi dan harga tidak boleh negatif.'
          : 'Nama part wajib diisi, jumlah stok harus lebih dari 0, dan harga tidak boleh negatif.'
      ); 
      return; 
    }
    
    setSaving(true); 
    setError('');
    
    try { 
      await onSubmit(payload); 
    } catch (e: any) { 
      setError(e?.response?.data?.error || 'Gagal menyimpan part.'); 
      setSaving(false); 
    }
  };

  return ( 
    <form 
      onSubmit={submit} 
      className="flex max-h-[calc(100vh-32px)] w-full max-w-[672px] flex-col overflow-hidden rounded-xl bg-white font-sans shadow-2xl outline outline-1 -outline-offset-1 outline-black/10">
      <div className="flex items-start justify-between border-b border-black/10 bg-stone-50 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold leading-7 text-zinc-900">
            Tambah Stok Suku Cadang Baru
          </h2>
          <p className="text-xs leading-4 text-neutral-500">
            Daftarkan komponen hardware, tentukan batas ambang minimum restock, dan alokasikan lokasi bin rak
            <br />
            workshop.
          </p>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          aria-label="Tutup" 
          className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-zinc-900">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex flex-col gap-6 overflow-y-auto p-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-1.5">
            <h3 className="text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
              1 Identitas &amp; Klasifikasi Suku Cadang
            </h3>
            <span className="text-[10px] font-medium leading-4 text-zinc-900">
              Wajib diisi
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_2fr] gap-3.5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sku">Kode / SKU Part</Label>
                <div className="flex">
                  <input 
                    id="sku" 
                    value={form.sku} 
                    onChange={(e) => set('sku')(e.target.value)} 
                    className={`${inputClass} min-w-0 flex-1 rounded-r-none font-mono`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => set('sku')(randomSku())} 
                    aria-label="Buat SKU baru" 
                    className="rounded-r-lg border-y border-r border-black/10 bg-zinc-100 px-2 text-zinc-900">
                    <ArrowClockwise size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="category">Kategori Suku Cadang</Label>
                <select 
                  id="category" 
                  value={form.category} 
                  onChange={(e) => set('category')(e.target.value)} 
                  className={inputClass}>
                    {KATEGORI.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                </select>
              </div>
            </div>
            <Field 
              id="name" 
              label="Nama Komponen / Suku Cadang" 
              value={form.name} 
              onChange={set('name')} 
            />
            <Field 
              id="spec" 
              label="Model Kompatibilitas / Tipe Perangkat" 
              value={form.spec} 
              onChange={set('spec')} 
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-1.5">
            <h3 className="text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
              2 Stok &amp; Pengelolaan Finansial
            </h3>
            <span className="text-[10px] font-medium leading-4 text-zinc-900">
              Unit &amp; Penetapan Harga
            </span>
          </div>
          <div className="flex gap-3.5">
            <StockField 
              id="stock_qty" 
              label="Jumlah Stok Masuk (Fisik)" 
              value={form.stock_qty} 
              onChange={set('stock_qty')} 
              disabled={Boolean(partRequestId)}
              note={partRequestId ? 'Stok akan bertambah saat part diterima lewat Tautkan & restock.' : undefined}
            />
            <StockField 
              id="min_stock" 
              label="Ambang Batas Minimum (Restock)" 
              value={form.min_stock} 
              onChange={set('min_stock')} 
            />
          </div>
          <div className="flex gap-3.5">
            <PriceField 
              id="cost_price" 
              label="Harga Satuan Modal / Beli" 
              value={form.cost_price} 
              onChange={set('cost_price')} 
            />
            <PriceField 
              id="sell_price" 
              label="Harga Jual Layanan Servis" 
              value={form.sell_price} 
              onChange={set('sell_price')} 
              placeholder="Isi harga jual"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-1.5">
            <h3 className="text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
              3 Alokasi Fisik Workshop &amp; Vendor
            </h3>
            <span className="text-[10px] font-medium leading-4 text-zinc-900">
              Logistik workshop
            </span>
          </div>
          <Field 
            id="bin_location" 
            label="Lokasi Rak / Bin Workshop" 
            value={form.bin_location} 
            onChange={set('bin_location')} 
            className="w-72 max-w-full" 
          />
        </section>
        
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
      
      <div className="flex items-center justify-between border-t border-black/10 bg-stone-50 p-5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" />
          <span className="text-xs leading-4 text-neutral-500">
            Total Estimasi Nilai Masuk:
          </span>
          <span className="font-mono text-xs font-bold leading-4 text-zinc-900">
            Rp {formatInventoryNumber(total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-medium leading-4 text-stone-700 outline outline-1 -outline-offset-1 outline-black/10 transition-colors hover:bg-stone-100">
            Batal
          </button>
          <button 
            disabled={saving} 
            type="submit" 
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold leading-4 text-white transition-colors hover:bg-sky-700 disabled:opacity-50">
            {saving ? (
              'Menyimpan...' ) : ( 
              <>
                <Plus size={14} />
                Simpan &amp; Tambahkan ke Inventaris
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
