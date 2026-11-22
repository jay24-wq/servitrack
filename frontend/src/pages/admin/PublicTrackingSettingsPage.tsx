import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import {
  getTenantPublicTrackingSettings,
  updateTenantPublicTrackingSettings,
  type TrackingContactVisibility,
} from '../../lib/api';
import { useAuthStore } from '../../store';

const options: { value: TrackingContactVisibility; title: string; description: string }[] = [
  { value: 'full', title: 'Tampilkan penuh', description: 'Nama dan nomor telepon petugas ditampilkan lengkap.' },
  { value: 'masked', title: 'Samarkan sebagian', description: 'Nama ditampilkan, nomor disamarkan. Contoh: +62 877-****-5449.' },
  { value: 'hidden', title: 'Sembunyikan', description: 'Nama petugas tetap tampil, nomor telepon tidak ditampilkan.' },
];

function PublicTrackingForm({ initial, tenantId }: { initial: TrackingContactVisibility; tenantId: string }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const mutation = useMutation({ mutationFn: updateTenantPublicTrackingSettings });
  const dirty = value !== saved;

  const save = async () => {
    setError('');
    setSuccess('');
    try {
      const saved = await mutation.mutateAsync({ contact_visibility: value });
      queryClient.setQueryData(['public-tracking-settings', tenantId], saved);
      setSaved(saved.contact_visibility);
      setValue(saved.contact_visibility);
      setSuccess('Pengaturan tracking publik berhasil disimpan.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Gagal menyimpan pengaturan. Silakan coba lagi.');
    }
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Tracking Publik</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">
          Atur informasi kontak petugas yang muncul pada riwayat aktivitas pelanggan. Perubahan diterapkan oleh server.
        </p>
      </header>

      <fieldset className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <legend className="sr-only">Tampilkan kontak petugas di tracking publik</legend>
        <div className="border-b border-black/5 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold leading-5 text-zinc-900">Tampilkan kontak petugas di tracking publik</h2>
          <p className="mt-1 text-xs leading-5 text-stone-600">Nama dan nomor hanya berasal dari petugas yang menangani aktivitas tersebut.</p>
        </div>
        <div className="divide-y divide-black/5">
          {options.map((option) => (
            <label key={option.value} className="flex min-h-16 cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-stone-50 sm:px-5">
              <input
                type="radio"
                name="contact-visibility"
                value={option.value}
                checked={value === option.value}
                disabled={mutation.isPending}
                onChange={() => { setValue(option.value); setError(''); setSuccess(''); }}
                className="mt-0.5 size-4 shrink-0 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-zinc-900">{option.title}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-600">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <footer className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div aria-live="polite" className="min-h-5 text-xs">
          {error && <p role="alert" className="font-medium text-rose-700">{error}</p>}
          {success && <p role="status" className="font-medium text-emerald-700">{success}</p>}
          {!error && !success && dirty && <p className="text-stone-500">Ada perubahan yang belum disimpan.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending || !dirty} onClick={() => { setValue(saved); setError(''); setSuccess(''); }}>Reset Perubahan</Button>
          <Button type="button" disabled={mutation.isPending || !dirty} onClick={() => void save()}>
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default function PublicTrackingSettingsPage() {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const query = useQuery({
    queryKey: ['public-tracking-settings', tenantId],
    queryFn: getTenantPublicTrackingSettings,
    enabled: Boolean(tenantId),
  });

  if (query.isPending) {
    return <div className="page-enter flex flex-col gap-6" aria-busy="true"><div><h1 className="text-2xl font-bold leading-8 text-zinc-900">Tracking Publik</h1><p className="mt-1 text-xs text-stone-600">Memuat pengaturan...</p></div><div className="h-52 animate-pulse rounded-xl border border-black/5 bg-white" /></div>;
  }
  if (query.isError || !query.data || !tenantId) {
    return <div className="page-enter flex flex-col gap-6"><header><h1 className="text-2xl font-bold leading-8 text-zinc-900">Tracking Publik</h1></header><section className="rounded-xl border border-black/10 bg-white p-5"><p role="alert" className="text-sm font-medium text-rose-700">Pengaturan tracking publik gagal dimuat. Periksa koneksi lalu coba lagi.</p><Button type="button" variant="outline" className="mt-4" onClick={() => void query.refetch()}>Coba lagi</Button></section></div>;
  }

  return <PublicTrackingForm key={tenantId} tenantId={tenantId} initial={query.data.contact_visibility} />;
}
