import { useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { StaffPasswordInput } from './StaffPasswordInput';
import { STAFF_ROLES, staffModalInputClass, type StaffRole } from './staffModalConfig';
import { STAFF_PHONE_PATTERN } from '../../../../common/utils/staffPhone';

type AddStaffPayload = { name: string; email: string; phone: string; password: string; role: StaffRole };

export default function TambahStaffModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: AddStaffPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<AddStaffPayload>({ name: '', email: '', phone: '', password: '', role: 'frontdesk' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (values: Partial<AddStaffPayload>) => {
    setForm((current) => ({ ...current, ...values }));
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      setError('Nama lengkap dan email wajib diisi.');
      return;
    }
    if (!STAFF_PHONE_PATTERN.test(form.phone)) {
      setError('Nomor handphone wajib menggunakan format 628xxxxxxxxxx.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (form.password !== confirmPassword) {
      setError('Konfirmasi password belum sama.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menambahkan staff.');
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-title"
      className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl bg-white font-sans shadow-2xl outline outline-1 -outline-offset-1 outline-black/10"
    >
      <div className="flex items-start justify-between border-b border-black/10 bg-stone-50 p-6">
        <div>
          <h2 id="add-staff-title" className="text-lg font-bold leading-7 text-zinc-900">Tambah Staff Baru</h2>
          <p className="text-xs leading-4 text-neutral-500">Buat akun staff pada tenant workshop aktif.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/5 disabled:opacity-50">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-6">
        <div>
          <label htmlFor="staff-name" className="mb-1 block text-xs font-semibold text-stone-700">Nama Lengkap</label>
          <input
            id="staff-name"
            autoComplete="name"
            required
            maxLength={100}
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            className={staffModalInputClass}
          />
        </div>

        <div>
          <label htmlFor="staff-email" className="mb-1 block text-xs font-semibold text-stone-700">Email</label>
          <input
            id="staff-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            maxLength={150}
            value={form.email}
            onChange={(event) => update({ email: event.target.value })}
            className={staffModalInputClass}
          />
        </div>

        <div>
          <label htmlFor="staff-phone" className="mb-1 block text-xs font-semibold text-stone-700">No Handphone</label>
          <input
            id="staff-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            maxLength={13}
            pattern={STAFF_PHONE_PATTERN.source}
            title="Gunakan format 628xxxxxxxxxx"
            placeholder="6281234567890"
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
            className={staffModalInputClass}
          />
        </div>

        <div className="flex gap-3.5">
          <div className="flex-1">
            <label htmlFor="staff-role" className="mb-1 block text-xs font-semibold text-stone-700">Role</label>
            <select
              id="staff-role"
              value={form.role}
              onChange={(event) => update({ role: event.target.value as StaffRole })}
              className={staffModalInputClass}
            >
              {STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          <StaffPasswordInput
            id="staff-password"
            label="Password"
            value={form.password}
            required
            onChange={(password) => update({ password })}
          />
        </div>

        <StaffPasswordInput
          id="staff-confirm-password"
          label="Konfirmasi Password"
          value={confirmPassword}
          required
          onChange={(password) => { setConfirmPassword(password); setError(''); }}
        />

        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-black/10 bg-stone-50 p-5">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-white px-3.5 py-1.5 text-xs text-stone-700 outline outline-1 -outline-offset-1 outline-black/10 disabled:opacity-50">
          Batal
        </button>
        <button disabled={saving} type="submit" className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Tambah Staff'}
        </button>
      </div>
    </form>
  );
}
