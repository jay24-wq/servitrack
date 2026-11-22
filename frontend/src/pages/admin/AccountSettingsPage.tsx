import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Eye, EyeSlash, Trash } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { UserAvatar } from '../../components/ui/user-avatar';
import { getMyAccount, updateMyAccount, type AccountProfile, type UpdateAccountInput } from '../../lib/api';
import { initialsOf } from '../../lib/avatar';
import { useAuthStore } from '../../store';

const TIME_ZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura' },
  { value: 'UTC', label: 'UTC' },
];

const fieldClass = 'h-10 rounded-lg border-stone-200 bg-stone-50 text-sm text-zinc-900 shadow-sm focus-visible:border-sky-500 focus-visible:ring-sky-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-stone-700';

async function optimizeAvatar(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Pilih foto berformat PNG, JPG, atau WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB.');

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
      if (!context) throw new Error('Foto tidak dapat diproses pada browser ini.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.84, 0.72, 0.6, 0.48, 0.36]) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('Browser ini tidak mendukung kompresi foto WebP.');
        if (dataUrl.length <= 68000) return dataUrl;
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  throw new Error('Foto terlalu besar setelah dikompres. Pilih foto yang lebih sederhana.');
}

function formatAccountDate(value: string | null, timeZone: string, includeTime = false) {
  if (!value) return 'Belum ada aktivitas';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
    timeZone,
  }).format(date);
}

function AccountHeader() {
  return (
    <header>
      <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Akun</h1>
      <p className="mt-1 text-xs leading-5 text-stone-600">Kelola profil dan keamanan akun Anda.</p>
    </header>
  );
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-black/5 bg-stone-50 px-3.5 py-3">
      <dt className="text-[11px] font-medium leading-4 text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-900">{value || '—'}</dd>
    </div>
  );
}

export default function AccountSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const accountQuery = useQuery({
    queryKey: ['account-profile', user?.id],
    queryFn: getMyAccount,
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (!accountQuery.data) return;
    const account = accountQuery.data;
    updateAuthUser({
      name: account.name,
      email: account.email,
      avatar_data_url: account.avatar_data_url,
      time_zone: account.time_zone,
    });
  }, [accountQuery.data, updateAuthUser]);

  if (accountQuery.isPending) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <AccountHeader />
        <section aria-label="Memuat data akun" aria-busy="true" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <div className="flex animate-pulse flex-col gap-5">
            <div className="h-5 w-40 rounded bg-stone-200" />
            <div className="h-16 rounded-lg bg-stone-100" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-16 rounded-lg bg-stone-100" />
              <div className="h-16 rounded-lg bg-stone-100" />
            </div>
            <div className="h-28 rounded-lg bg-stone-100" />
          </div>
        </section>
      </div>
    );
  }

  if (accountQuery.isError || !accountQuery.data) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <AccountHeader />
        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <p role="alert" className="text-sm font-medium text-rose-700">Gagal memuat data akun. Periksa koneksi lalu coba lagi.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void accountQuery.refetch()}>Coba lagi</Button>
        </section>
      </div>
    );
  }

  return <AccountSettingsForm key={accountQuery.data.id} account={accountQuery.data} />;
}

function AccountSettingsForm({ account }: { account: AccountProfile }) {
  const authUser = useAuthStore((state) => state.user);
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const queryClient = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const saveMutation = useMutation({ mutationFn: updateMyAccount });
  const [form, setForm] = useState({ name: account.name, email: account.email, time_zone: account.time_zone || 'Asia/Jakarta' });
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhotoError('');
    setSuccess('');
    setPhotoProcessing(true);
    try {
      const avatarDataUrl = await optimizeAvatar(file);
      setPendingAvatar(avatarDataUrl);
    } catch (photoFailure) {
      setPhotoError(photoFailure instanceof Error ? photoFailure.message : 'Foto tidak dapat diproses.');
    } finally {
      setPhotoProcessing(false);
      input.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const changingPassword = Boolean(currentPassword || newPassword || confirmPassword);
    if (changingPassword) {
      if (!currentPassword) return setError('Masukkan password saat ini untuk mengubah password.');
      if (!newPassword) return setError('Masukkan password baru.');
      if (newPassword.length < 8) return setError('Password baru minimal 8 karakter.');
      if (newPassword !== confirmPassword) return setError('Konfirmasi password baru belum sama.');
    }

    const payload: UpdateAccountInput = {
      name: form.name,
      email: form.email,
      avatar_data_url: pendingAvatar === undefined ? authUser?.avatar_data_url ?? account.avatar_data_url : pendingAvatar,
      time_zone: form.time_zone,
      ...(changingPassword ? { current_password: currentPassword, new_password: newPassword } : {}),
    };

    try {
      const account = await saveMutation.mutateAsync(payload);
      updateAuthUser({
        name: account.name,
        email: account.email,
        avatar_data_url: account.avatar_data_url,
        time_zone: account.time_zone,
      });
      queryClient.setQueryData(['account-profile', account.id], account);
      setPendingAvatar(undefined);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSuccess('Perubahan akun berhasil disimpan.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Gagal menyimpan perubahan akun. Silakan coba lagi.');
    }
  };

  const roleLabel = ({ ADMIN: 'Admin', FRONTDESK: 'Frontdesk', TEKNISI: 'Teknisi', KURIR: 'Kurir' } as Record<string, string>)[account.role] ?? account.role;
  const busy = saveMutation.isPending || photoProcessing;
  const avatarName = authUser?.name ?? account.name;
  const avatarSrc = authUser?.avatar_data_url;
  const canRemoveAvatar = pendingAvatar === undefined ? Boolean(avatarSrc) : pendingAvatar !== null;
  const avatarPending = pendingAvatar !== undefined;

  const passwordField = (
    id: string,
    label: string,
    value: string,
    visible: boolean,
    setValue: (value: string) => void,
    toggleVisible: () => void,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          disabled={busy}
          value={value}
          onChange={(event) => { setValue(event.target.value); setError(''); setSuccess(''); }}
          className={`no-password-reveal ${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={toggleVisible}
          disabled={busy}
          aria-label={visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-enter flex flex-col gap-6">
      <AccountHeader />

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <section aria-labelledby="account-profile-heading" className="p-5 sm:p-7">
          <div>
            <h2 id="account-profile-heading" className="text-sm font-bold leading-5 text-zinc-900">Profil Akun</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Informasi profil untuk akun ServiTrack Anda.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>Foto Profil</span>
              <div className="flex flex-wrap items-center gap-4">
                <UserAvatar seed={avatarName} initials={initialsOf(avatarName)} alt={`Foto profil ${avatarName}`} imageSrc={avatarSrc} className="size-16 border border-stone-200" />
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} className="sr-only" aria-label="Pilih foto profil" disabled={busy} />
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => photoInput.current?.click()}>
                    <Camera weight="bold" className="size-4" /> {photoProcessing ? 'Memproses foto...' : 'Ubah foto'}
                  </Button>
                  {canRemoveAvatar && (
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setPendingAvatar(null); setPhotoError(''); setError(''); setSuccess(''); }}>
                      <Trash weight="bold" className="size-4" /> Hapus foto
                    </Button>
                  )}
                  <span className="w-full text-xs text-stone-500">
                    {avatarPending ? pendingAvatar ? 'Foto baru siap disimpan.' : 'Foto profil akan dihapus saat disimpan.' : 'PNG, JPG, atau WebP · maks. 5 MB sebelum dikompres.'}
                  </span>
                </div>
              </div>
              {photoError && <p role="alert" className="mt-2 text-xs text-rose-700">{photoError}</p>}
            </div>

            <div>
              <label htmlFor="account-name" className={labelClass}>Nama Lengkap</label>
              <Input id="account-name" autoComplete="name" required maxLength={100} disabled={busy} value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setError(''); setSuccess(''); }} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="account-email" className={labelClass}>Email</label>
              <Input id="account-email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={150} disabled={busy} value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setError(''); setSuccess(''); }} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="account-role" className={labelClass}>Role</label>
              <Input id="account-role" value={roleLabel} readOnly aria-readonly="true" disabled={busy} className={`${fieldClass} cursor-not-allowed bg-stone-100 text-stone-600`} />
            </div>
            <div>
              <label htmlFor="account-time-zone" className={labelClass}>Preferensi Zona Waktu</label>
              <select id="account-time-zone" value={form.time_zone} disabled={busy} onChange={(event) => { setForm((current) => ({ ...current, time_zone: event.target.value })); setError(''); setSuccess(''); }} className={`w-full border ${fieldClass} px-3.5 outline-none focus-visible:ring-2`}>
                {TIME_ZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section aria-labelledby="account-security-heading" className="border-t border-black/10 p-5 sm:p-7">
          <div>
            <h2 id="account-security-heading" className="text-sm font-bold leading-5 text-zinc-900">Keamanan</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Isi ketiga field password hanya jika ingin mengganti password.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {passwordField('current-password', 'Password Saat Ini', currentPassword, showCurrentPassword, setCurrentPassword, () => setShowCurrentPassword((value) => !value), 'current-password')}
            {passwordField('new-password', 'Password Baru', newPassword, showNewPassword, setNewPassword, () => setShowNewPassword((value) => !value), 'new-password')}
            {passwordField('confirm-new-password', 'Konfirmasi Password Baru', confirmPassword, showConfirmPassword, setConfirmPassword, () => setShowConfirmPassword((value) => !value), 'new-password')}
          </div>
        </section>

        <section aria-labelledby="account-information-heading" className="border-t border-black/10 p-5 sm:p-7">
          <div>
            <h2 id="account-information-heading" className="text-sm font-bold leading-5 text-zinc-900">Informasi Akun</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Informasi ini dikelola oleh sistem dan tidak dapat diubah dari halaman akun.</p>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ReadOnlyItem label="Tenant" value={account.tenant_name} />
            <ReadOnlyItem label="Cabang Aktif" value={account.active_branch_name ?? 'Belum ditetapkan'} />
            <ReadOnlyItem label="Role" value={roleLabel} />
            <ReadOnlyItem label="Tanggal Bergabung" value={formatAccountDate(account.created_at, form.time_zone)} />
            <ReadOnlyItem label="Terakhir Aktif" value={formatAccountDate(account.last_login_at, form.time_zone, true)} />
          </dl>
        </section>

        <footer className="flex flex-col gap-3 border-t border-black/10 bg-stone-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div aria-live="polite" className="min-h-5 text-xs">
            {error && <p role="alert" className="font-medium text-rose-700">{error}</p>}
            {success && <p role="status" className="font-medium text-emerald-700">{success}</p>}
          </div>
          <Button type="submit" disabled={busy} className="min-h-10 gap-2 self-end px-4">
            {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
