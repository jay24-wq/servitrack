import { ArrowLeft, ArrowRight, CheckCircle, EnvelopeSimple, Eye, EyeSlash, LockKey, UploadSimple, X } from '@phosphor-icons/react';
import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import PickupLocationPicker, { type PickupLocation } from '../../components/public/PickupLocationPicker';
import { registerTenant, type RegisterTenantInput } from '../../lib/api';
import { useAuthStore, homeForRole } from '../../store';

type RegisterForm = Pick<RegisterTenantInput, 'email' | 'password' | 'owner_name' | 'tenant_name' | 'phone'>;

const inputClass = 'min-h-13 w-full rounded-xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-sky-600 focus:ring-4 focus:ring-sky-100';
const steps = [
  { title: 'Buat Akun Anda', subtitle: 'Mulai menggunakan ServiTrack untuk mengelola workshop Anda.' },
  { title: 'Siapa Nama Anda?', subtitle: 'Kenalkan diri Anda sebagai pemilik workshop.' },
  { title: 'Apa Nama Toko / Usaha Anda?', subtitle: 'Nama workshop ini akan tampil di dashboard ServiTrack.' },
  { title: 'Nomor WhatsApp Anda', subtitle: 'Gunakan nomor Indonesia yang dapat dihubungi.' },
  { title: 'Dimana Lokasi Toko / Usaha Anda?', subtitle: 'Cari alamat atau pilih titik workshop Anda pada peta.' },
];

function normalizeIndonesianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function isIndonesianMobile(value: string) {
  return /^628[1-9]\d{7,11}$/.test(normalizeIndonesianPhone(value));
}

function isValidLocation(location: PickupLocation | null): location is PickupLocation {
  return Boolean(
    location?.address.trim() &&
    Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
    Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180,
  );
}

async function optimizeLogo(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Pilih logo dengan format PNG, JPG, atau WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran file logo maksimal 5 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
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
      for (const quality of [0.84, 0.72, 0.6, 0.48]) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (dataUrl.length <= 70000) return dataUrl;
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  throw new Error('Logo tidak dapat dikompres hingga 70 KB. Pilih gambar yang lebih sederhana.');
}

export default function RegisterPage() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RegisterForm>({ email: '', password: '', owner_name: '', tenant_name: '', phone: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [location, setLocation] = useState<PickupLocation | null>(null);
  const [locationError, setLocationError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const registration = useMutation({ mutationFn: registerTenant });

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  const update = (field: keyof RegisterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoDataUrl(null);
    setLogoError(null);
    setLogoProcessing(true);
    try {
      setLogoDataUrl(await optimizeLogo(file));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Logo tidak dapat diproses.');
    } finally {
      setLogoProcessing(false);
    }
    event.target.value = '';
  };

  const handleContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (step === 1 && form.password !== confirmPassword) {
      setError('Konfirmasi password belum sama.');
      return;
    }
    if (step === 4 && !isIndonesianMobile(form.phone)) {
      setError('Masukkan nomor WhatsApp seluler Indonesia yang valid.');
      return;
    }
    if (step === 5) {
      if (!isValidLocation(location)) {
        setLocationError('Pilih lokasi dan tunggu alamatnya berhasil ditemukan sebelum membuat akun.');
        return;
      }

      try {
        const result = await registration.mutateAsync({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          owner_name: form.owner_name.trim(),
          tenant_name: form.tenant_name.trim(),
          phone: normalizeIndonesianPhone(form.phone),
          address: location.address.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          ...(logoDataUrl ? { logo_data_url: logoDataUrl } : {}),
        });
        login(result.token);
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        setError(err?.response?.data?.error ?? 'Registrasi gagal. Periksa koneksi lalu coba lagi.');
      }
      return;
    }

    setStep((current) => Math.min(5, current + 1));
  };

  const back = () => {
    setError(null);
    setLocationError(undefined);
    setStep((current) => Math.max(1, current - 1));
  };

  if (step === 1) {
    return (
      <div className="min-h-dvh bg-stone-950 lg:flex">
        <aside className="relative hidden min-h-dvh w-1/2 overflow-hidden bg-stone-950 lg:block">
          <img src="/ds.webp" alt="ServiTrack" className="absolute inset-0 size-full object-cover object-[30%_50%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-transparent to-transparent" />
          <Link to="/" className="absolute left-8 top-8 z-10 inline-flex items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950">
            <span className="flex size-12 items-center justify-center rounded-2xl">
              <img src="/logos.webp" alt="" className="size-9 object-contain contrast-125 saturate-150" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-white drop-shadow-md">ServiTrack</span>
          </Link>
        </aside>

        <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-white px-5 py-8 sm:px-6 lg:w-1/2 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 inline-flex items-center gap-2 lg:hidden">
              <img src="/logos.webp" alt="" className="size-9 object-contain" />
              <span className="text-xl font-bold tracking-tight text-stone-900">ServiTrack</span>
            </div>

            <header className="mb-7 sm:mb-9">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{steps[0].title}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600 sm:text-lg">{steps[0].subtitle}</p>
            </header>

            <form onSubmit={handleContinue} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold tracking-wide text-stone-800">Alamat Email</label>
                <div className="relative">
                  <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoFocus required maxLength={150} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="nama@email.com" className="w-full rounded-2xl border-2 border-stone-200 bg-white py-3.5 pl-12 pr-4 text-base text-stone-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 sm:py-4" />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold tracking-wide text-stone-800">Password</label>
                <div className="relative">
                  <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Minimal 8 karakter" className="no-password-reveal w-full rounded-2xl border-2 border-stone-200 bg-white py-3.5 pl-12 pr-12 text-base text-stone-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 sm:py-4" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                    {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold tracking-wide text-stone-800">Konfirmasi Password</label>
                <div className="relative">
                  <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input id="confirm-password" name="confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(null); }} placeholder="Ulangi password Anda" className="no-password-reveal w-full rounded-2xl border-2 border-stone-200 bg-white py-3.5 pl-12 pr-12 text-base text-stone-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 sm:py-4" />
                  <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                    {showConfirmPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>}

              <button type="submit" className="group flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 font-semibold text-white shadow-lg transition hover:from-sky-700 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-[0.99]">
                Lanjut
                <ArrowRight size={19} weight="bold" className="transition-transform group-hover:translate-x-1" />
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-stone-600">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-semibold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 rounded-sm">Masuk</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-stone-100 px-4 py-5 sm:px-6 sm:py-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
          <img src="/logos.webp" alt="" className="size-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-stone-900">ServiTrack</span>
        </Link>
        <p className="text-right text-sm text-stone-600">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 rounded-sm">Masuk</Link>
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-6xl justify-center pb-8 pt-8 sm:pt-14">
        <section className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-5 shadow-xl shadow-stone-900/5 sm:p-8 lg:p-10">
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-stone-600">
              <span>Langkah {step} dari 5</span>
              <span>{Math.round((step / 5) * 100)}%</span>
            </div>
            <div role="progressbar" aria-label={`Progres registrasi, langkah ${step} dari 5`} aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} className="flex gap-2">
              {steps.map((item, index) => (
                <span key={item.title} className={`h-1.5 flex-1 rounded-full transition-colors ${index < step ? 'bg-sky-600' : 'bg-stone-200'}`} />
              ))}
            </div>
          </div>

          <header className="mb-7 sm:mb-9">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{steps[step - 1].title}</h1>
            <p className="mt-2 leading-relaxed text-stone-600">{steps[step - 1].subtitle}</p>
          </header>

          <form onSubmit={handleContinue} className="space-y-5">
            {step === 2 && (
              <div>
                <label htmlFor="owner_name" className="mb-2 block text-sm font-semibold text-stone-800">Nama Lengkap Pemilik</label>
                <input id="owner_name" name="owner_name" autoComplete="name" autoFocus required maxLength={100} value={form.owner_name} onChange={(event) => update('owner_name', event.target.value)} placeholder="Nama Lengkap Anda" className={inputClass} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="tenant_name" className="mb-2 block text-sm font-semibold text-stone-800">Nama Workshop</label>
                  <input id="tenant_name" name="tenant_name" autoComplete="organization" autoFocus required maxLength={120} value={form.tenant_name} onChange={(event) => update('tenant_name', event.target.value)} placeholder="Nama Toko Anda" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="workshop-logo" className="mb-2 block text-sm font-semibold text-stone-800">Logo Workshop <span className="font-normal text-stone-500">(opsional)</span></label>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
                    {logoDataUrl ? (
                      <>
                        <img src={logoDataUrl} alt="Pratinjau logo workshop" className="size-16 rounded-xl border border-stone-200 bg-white object-contain p-1" />
                        <button type="button" onClick={() => { setLogoDataUrl(null); setLogoError(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
                          <X size={17} /> Hapus logo
                        </button>
                      </>
                    ) : (
                      <label htmlFor="workshop-logo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-sky-400 hover:text-sky-700 focus-within:ring-2 focus-within:ring-sky-500">
                        <UploadSimple size={18} /> Pilih file logo
                      </label>
                    )}
                    <input id="workshop-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} className="sr-only" />
                    <p className="text-xs leading-relaxed text-stone-500">PNG, JPG, atau WebP. Maks. 5 MB sebelum dikompres.</p>
                  </div>
                  {logoError && <p role="alert" className="mt-2 text-sm text-rose-700">{logoError}</p>}
                  {logoProcessing && <p className="mt-2 text-sm text-stone-500" role="status">Mengoptimalkan logo…</p>}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-stone-800">Nomor WhatsApp</label>
                <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus required maxLength={20} value={form.phone} onChange={(event) => update('phone', event.target.value.replace(/[^\d+()\s-]/g, ''))} placeholder="628214857088" className={inputClass} />
                <p className="mt-2 text-sm text-stone-500">Gunakan format Indonesia, misalnya 628214857088 atau 08214857088.</p>
              </div>
            )}

            {step === 5 && (
              <div>
                <PickupLocationPicker
                  value={location}
                  onChange={(nextLocation) => { setLocation(nextLocation); setLocationError(undefined); }}
                  error={locationError}
                />
                {!location && !locationError && <p className="mt-3 text-sm text-stone-500" role="status">Pilih titik atau cari alamat sampai alamat berhasil ditemukan untuk melanjutkan.</p>}
              </div>
            )}

            {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-5">
              {step > 1 ? (
                <button type="button" onClick={back} disabled={registration.isPending || logoProcessing} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-50 sm:px-4">
                  <ArrowLeft size={18} /> Kembali
                </button>
              ) : <span />}
              <button
                type="submit"
                disabled={registration.isPending || logoProcessing || (step === 5 && !isValidLocation(location))}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:min-w-36 sm:px-6"
              >
                {registration.isPending ? 'Membuat akun...' : logoProcessing ? 'Memproses logo...' : step === 5 ? 'Buat Akun' : 'Lanjut'}
                {!registration.isPending && !logoProcessing && (step === 5 ? <CheckCircle size={19} weight="bold" /> : <ArrowRight size={19} weight="bold" />)}
              </button>
            </div>
          </form>
        </section>
      </main>

      <footer className="pb-2 text-center text-xs text-stone-500">ServiTrack · Reparasi Transparan</footer>
    </div>
  );
}
