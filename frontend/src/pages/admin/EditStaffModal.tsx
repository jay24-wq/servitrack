import { useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { StaffPasswordInput } from './StaffPasswordInput';
import { STAFF_ROLES, staffModalInputClass, type StaffRole } from './staffModalConfig';
import { STAFF_PHONE_PATTERN } from '../../../../common/utils/staffPhone';

type EditStaffValues = { name: string; email: string; phone: string; role: StaffRole; password?: string };

export default function EditStaffModal({
  staff,
  onClose,
  onSubmit,
}: {
  staff: { name: string; email: string; phone: string; role: StaffRole };
  onClose: () => void;
  onSubmit: (values: EditStaffValues) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: staff.name, email: staff.email, phone: staff.phone, role: staff.role });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    if (password || confirmPassword) {
      if (!password) {
        setError('Isi password baru untuk mengonfirmasi perubahan password.');
        return;
      }
      if (password.length < 8) {
        setError('Password baru minimal 8 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi password baru belum sama.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        ...(password ? { password } : {}),
      });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memperbarui data staff.');
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-staff-title"
      className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl bg-white font-sans shadow-2xl outline outline-1 -outline-offset-1 outline-black/10"
    >
      <div className="flex items-start justify-between border-b border-black/10 bg-stone-50 p-6">
        <div>
          <h2 id="edit-staff-title" className="text-lg font-bold leading-7 text-zinc-900">Edit Staff</h2>
          <p className="text-xs leading-4 text-neutral-500">Perbarui data staff. Kosongkan password baru jika tidak ingin menggantinya.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/5 disabled:opacity-50">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-6">
        <div>
          <label htmlFor="edit-staff-name" className="mb-1 block text-xs font-semibold text-stone-700">Nama Lengkap</label>
          <input
            id="edit-staff-name"
            autoComplete="name"
            required
            maxLength={100}
            value={form.name}
            onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setError(''); }}
            className={staffModalInputClass}
          />
        </div>

        <div>
          <label htmlFor="edit-staff-email" className="mb-1 block text-xs font-semibold text-stone-700">Email</label>
          <input
            id="edit-staff-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            maxLength={150}
            value={form.email}
            onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setError(''); }}
            className={staffModalInputClass}
          />
        </div>

        <div>
          <label htmlFor="edit-staff-phone" className="mb-1 block text-xs font-semibold text-stone-700">No Handphone</label>
          <input
            id="edit-staff-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            maxLength={13}
            pattern={STAFF_PHONE_PATTERN.source}
            title="Gunakan format 628xxxxxxxxxx"
            placeholder="6281234567890"
            value={form.phone}
            onChange={(event) => { setForm((current) => ({ ...current, phone: event.target.value })); setError(''); }}
            className={staffModalInputClass}
          />
        </div>

        <div className="flex gap-3.5">
          <div className="flex-1">
            <label htmlFor="edit-staff-role" className="mb-1 block text-xs font-semibold text-stone-700">Role</label>
            <select
              id="edit-staff-role"
              value={form.role}
              onChange={(event) => { setForm((current) => ({ ...current, role: event.target.value as StaffRole })); setError(''); }}
              className={staffModalInputClass}
            >
              {STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          <StaffPasswordInput id="edit-staff-password" label="Password Baru" value={password} onChange={(value) => { setPassword(value); setError(''); }} />
        </div>

        <StaffPasswordInput
          id="edit-staff-confirm-password"
          label="Konfirmasi Password Baru"
          value={confirmPassword}
          onChange={(value) => { setConfirmPassword(value); setError(''); }}
        />

        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-black/10 bg-stone-50 p-5">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-white px-3.5 py-1.5 text-xs text-stone-700 outline outline-1 -outline-offset-1 outline-black/10 disabled:opacity-50">
          Batal
        </button>
        <button disabled={saving} type="submit" className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  );
}
