import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Buildings, Camera, CheckCircle, MapPin, Storefront, Trash, UploadSimple } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import PickupLocationPicker, { type PickupLocation } from '../../components/public/PickupLocationPicker';
import {
  getTenantCustomizationProfile,
  updateTenantCustomizationProfile,
  type TenantCustomizationProfile,
  type UpdateTenantCustomizationProfileInput,
} from '../../lib/api';
import { useAuthStore } from '../../store';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^628[1-9]\d{7,11}$/;
const fieldClass = 'h-10 rounded-lg border-stone-200 bg-stone-50 text-sm text-zinc-900 shadow-sm focus-visible:border-sky-500 focus-visible:ring-sky-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-stone-700';

type CustomizationForm = {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  logo_data_url: string | null;
  location: PickupLocation | null;
};

function normalizeIndonesianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function formFromProfile(profile: TenantCustomizationProfile): CustomizationForm {
  const latitude = profile.latitude === null ? Number.NaN : Number(profile.latitude);
  const longitude = profile.longitude === null ? Number.NaN : Number(profile.longitude);
  const address = profile.address ?? '';
  const location = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { address, area: '', latitude, longitude }
    : null;

  return {
    name: profile.name,
    description: profile.description ?? '',
    phone: profile.phone,
    email: profile.email ?? '',
    address,
    logo_data_url: profile.logo_data_url,
    location,
  };
}

async function optimizeLogo(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Pilih logo berformat PNG, JPG, atau WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran logo maksimal 5 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = objectUrl;
    await image.decode();

    for (const size of [512, 384, 256, 192]) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Logo tidak dapat diproses pada browser ini.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.84, 0.72, 0.6, 0.48, 0.36]) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('Browser ini tidak mendukung kompresi logo WebP.');
        if (dataUrl.length <= 68000) return dataUrl;
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  throw new Error('Logo terlalu besar setelah dikompres. Pilih gambar yang lebih sederhana.');
}

function DataPreview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium leading-4 text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-900">{value || '—'}</dd>
    </div>
  );
}

function ProfileForm({ profile, tenantId }: { profile: TenantCustomizationProfile; tenantId: string }) {
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const initialForm = useMemo(() => formFromProfile(profile), [profile]);
  const [form, setForm] = useState(initialForm);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const saveMutation = useMutation({ mutationFn: updateTenantCustomizationProfile });

  const busy = saveMutation.isPending || logoProcessing;
  const dirty = form.name !== initialForm.name
    || form.description !== initialForm.description
    || form.phone !== initialForm.phone
    || form.email !== initialForm.email
    || form.address !== initialForm.address
    || form.logo_data_url !== initialForm.logo_data_url
    || form.location?.latitude !== initialForm.location?.latitude
    || form.location?.longitude !== initialForm.location?.longitude;

  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setLogoError('');
    setError('');
    setSuccess('');
    setLogoProcessing(true);
    try {
      const logoDataUrl = await optimizeLogo(file);
      setForm((current) => ({ ...current, logo_data_url: logoDataUrl }));
    } catch (failure) {
      setLogoError(failure instanceof Error ? failure.message : 'Logo tidak dapat diproses.');
    } finally {
      setLogoProcessing(false);
      input.value = '';
    }
  };

  const handleLocationChange = (location: PickupLocation | null) => {
    setForm((current) => ({
      ...current,
      location,
      ...(location ? { address: location.address } : {}),
    }));
    if (location) setLocationError('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const name = form.name.trim();
    const address = form.address.trim();
    const phone = normalizeIndonesianPhone(form.phone);
    const email = form.email.trim().toLowerCase();
    if (!name) return setError('Nama workshop wajib diisi.');
    if (!PHONE_PATTERN.test(phone)) return setError('Masukkan nomor WhatsApp seluler Indonesia yang valid.');
    if (email && !EMAIL_PATTERN.test(email)) return setError('Masukkan alamat email workshop yang valid.');
    if (!address) return setError('Alamat workshop wajib diisi.');
    if (!form.location || !Number.isFinite(form.location.latitude) || !Number.isFinite(form.location.longitude)) {
      setLocationError('Pilih lokasi workshop pada peta atau cari alamat untuk menetapkan titik lokasi.');
      return setError('Lokasi workshop belum dipilih.');
    }

    const payload: UpdateTenantCustomizationProfileInput = {
      name,
      description: form.description.trim() || null,
      phone,
      email: email || null,
      address,
      logo_data_url: form.logo_data_url,
      latitude: form.location.latitude,
      longitude: form.location.longitude,
    };

    try {
      const savedProfile = await saveMutation.mutateAsync(payload);
      queryClient.setQueryData(['tenant-customization-profile', tenantId], savedProfile);
      setForm(formFromProfile(savedProfile));
      setLocationError('');
      setSuccess('Profil usaha berhasil disimpan.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Gagal menyimpan profil usaha. Silakan coba lagi.');
    }
  };

  const reset = () => {
    setForm(initialForm);
    setLogoError('');
    setLocationError('');
    setError('');
    setSuccess('');
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Profile Usaha</h1>
        <p className="mt-1 text-xs leading-5 text-stone-600">Kelola identitas dan informasi workshop yang ditampilkan kepada pelanggan.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section aria-labelledby="workshop-profile-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
          <div>
            <h2 id="workshop-profile-heading" className="text-sm font-bold leading-5 text-zinc-900">Profile Usaha</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Logo, identitas, dan informasi kontak workshop.</p>
          </div>

          <div className="mt-5 border-b border-black/10 pb-5">
            <h3 className="text-xs font-semibold leading-4 text-stone-700">Logo Workshop</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {form.logo_data_url
                  ? <img src={form.logo_data_url} alt={`Logo ${form.name || 'workshop'}`} className="size-full object-contain p-2" />
                  : <Storefront weight="regular" className="size-9 text-stone-400" aria-label="Belum ada logo workshop" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} disabled={busy} className="sr-only" aria-label="Pilih logo workshop" />
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => logoInput.current?.click()}>
                  {form.logo_data_url ? <Camera weight="bold" className="size-4" /> : <UploadSimple weight="bold" className="size-4" />}
                  {logoProcessing ? 'Memproses logo...' : form.logo_data_url ? 'Ganti Logo' : 'Upload Logo'}
                </Button>
                {form.logo_data_url && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setForm((current) => ({ ...current, logo_data_url: null })); setLogoError(''); setError(''); setSuccess(''); }}>
                    <Trash weight="bold" className="size-4" /> Hapus Logo
                  </Button>
                )}
                <p className="w-full text-xs leading-5 text-stone-500">PNG, JPG, atau WebP · maks. 5 MB sebelum dikompres.</p>
              </div>
            </div>
            {logoError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{logoError}</p>}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="workshop-name" className={labelClass}>Nama Workshop</label>
              <Input id="workshop-name" required maxLength={120} disabled={busy} value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setError(''); setSuccess(''); }} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="workshop-description" className={labelClass}>Deskripsi Workshop</label>
              <textarea id="workshop-description" maxLength={1000} disabled={busy} value={form.description} onChange={(event) => { setForm((current) => ({ ...current, description: event.target.value })); setError(''); setSuccess(''); }} rows={3} className="w-full resize-y rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50" />
            </div>
            <div>
              <label htmlFor="workshop-phone" className={labelClass}>Nomor WhatsApp</label>
              <Input id="workshop-phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} disabled={busy} value={form.phone} onChange={(event) => { setForm((current) => ({ ...current, phone: event.target.value.replace(/[^\d+()\s-]/g, '') })); setError(''); setSuccess(''); }} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="workshop-email" className={labelClass}>Email Workshop</label>
              <Input id="workshop-email" type="email" autoComplete="email" autoCapitalize="none" maxLength={150} disabled={busy} value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setError(''); setSuccess(''); }} className={fieldClass} />
            </div>
          </div>
        </section>

        <section aria-labelledby="workshop-location-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
          <div>
            <h2 id="workshop-location-heading" className="text-sm font-bold leading-5 text-zinc-900">Lokasi Usaha</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Cari alamat atau pilih titik workshop pada peta.</p>
          </div>
          <div className="mt-5 flex flex-col gap-5">
            <div>
              <label htmlFor="workshop-address" className={labelClass}>Alamat Workshop</label>
              <textarea id="workshop-address" required maxLength={500} disabled={busy} value={form.address} onChange={(event) => {
                const address = event.target.value;
                setForm((current) => ({
                  ...current,
                  address,
                  location: current.location ? { ...current.location, address } : null,
                }));
                setLocationError('');
                setError('');
                setSuccess('');
              }} rows={3} className="w-full resize-y rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50" />
              <p className="mt-1.5 text-xs leading-5 text-stone-500">Alamat akan mengikuti hasil pencarian atau titik yang dipilih di peta.</p>
            </div>
            <div className={busy ? 'pointer-events-none opacity-60' : ''}>
              <p className={labelClass}>Map Preview</p>
              <PickupLocationPicker value={form.location} onChange={handleLocationChange} error={locationError} searchFirst />
              {!form.location && <p className="mt-2 text-xs leading-5 text-stone-500" role="status">Titik lokasi belum ditetapkan. Cari alamat atau pilih titik pada peta.</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="workshop-preview-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
          <div>
            <h2 id="workshop-preview-heading" className="text-sm font-bold leading-5 text-zinc-900">Preview Profile Usaha</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Pratinjau informasi yang akan ditampilkan kepada pelanggan setelah disimpan.</p>
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-black/5 bg-stone-50 p-4 sm:flex-row sm:items-start sm:p-5">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
              {form.logo_data_url
                ? <img src={form.logo_data_url} alt={`Logo ${form.name || 'workshop'}`} className="size-full object-contain p-2" />
                : <Buildings weight="regular" className="size-8 text-stone-400" aria-label="Logo belum tersedia" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold leading-6 text-zinc-900">{form.name.trim() || 'Nama Workshop'}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-stone-600">{form.description.trim() || 'Deskripsi workshop belum diisi.'}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DataPreview label="Alamat" value={form.address.trim()} />
                <DataPreview label="WhatsApp" value={form.phone.trim()} />
                <DataPreview label="Email" value={form.email.trim()} />
              </dl>
              {form.location && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone-500"><MapPin weight="fill" className="size-3.5" /> Titik lokasi dipilih pada peta</p>}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div aria-live="polite" className="min-h-5 text-xs">
            {error && <p role="alert" className="font-medium text-rose-700">{error}</p>}
            {success && <p role="status" className="font-medium text-emerald-700">{success}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy || !dirty} onClick={reset}>Reset Perubahan</Button>
            <Button type="submit" disabled={busy || !dirty}>
              {saveMutation.isPending ? 'Menyimpan...' : <><CheckCircle weight="bold" className="size-4" /> Simpan Perubahan</>}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}

export default function CustomizationProfilePage() {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const profileQuery = useQuery({
    queryKey: ['tenant-customization-profile', tenantId],
    queryFn: getTenantCustomizationProfile,
    enabled: Boolean(tenantId),
  });

  if (profileQuery.isPending) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Profile Usaha</h1>
          <p className="mt-1 text-xs leading-5 text-stone-600">Kelola identitas dan informasi workshop yang ditampilkan kepada pelanggan.</p>
        </header>
        <section aria-label="Memuat profil workshop" aria-busy="true" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <div className="grid animate-pulse gap-5 xl:grid-cols-2">
            <div className="h-40 rounded-lg bg-stone-100" />
            <div className="h-64 rounded-lg bg-stone-100" />
            <div className="h-72 rounded-lg bg-stone-100 xl:col-span-2" />
          </div>
        </section>
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data || !tenantId) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Profile Usaha</h1>
          <p className="mt-1 text-xs leading-5 text-stone-600">Kelola identitas dan informasi workshop yang ditampilkan kepada pelanggan.</p>
        </header>
        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <p role="alert" className="text-sm font-medium text-rose-700">Profil workshop gagal dimuat. Periksa koneksi lalu coba lagi.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void profileQuery.refetch()}>Coba lagi</Button>
        </section>
      </div>
    );
  }

  return <ProfileForm key={tenantId} profile={profileQuery.data} tenantId={tenantId} />;
}
