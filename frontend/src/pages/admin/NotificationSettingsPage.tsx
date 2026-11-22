import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationEventKey,
  type NotificationPreferences,
} from '../../lib/api';
import { useAuthStore } from '../../store';

type ChannelKey = keyof NotificationPreferences['channels'];

const notificationGroups: { title: string; items: { key: NotificationEventKey; title: string; description: string; important?: boolean }[] }[] = [
  {
    title: 'Booking & Pelanggan',
    items: [
      { key: 'booking_new', title: 'Booking Baru', description: 'Kirim notifikasi ketika ada booking servis baru.' },
      { key: 'booking_pickup_new', title: 'Booking Pickup Baru', description: 'Kirim notifikasi ketika pelanggan memilih layanan pickup atau pickup & delivery.', important: true },
      { key: 'booking_cancelled', title: 'Booking Dibatalkan', description: 'Kirim notifikasi ketika booking dibatalkan pelanggan.' },
    ],
  },
  {
    title: 'Kurir',
    items: [
      { key: 'courier_assignment_new', title: 'Assignment Kurir Baru', description: 'Kirim notifikasi ketika terdapat tugas pickup atau delivery baru yang perlu ditangani.', important: true },
      { key: 'courier_assignment_pending', title: 'Assignment Kurir Belum Diproses', description: 'Kirim pengingat jika booking pickup belum mendapatkan kurir dalam waktu tertentu.', important: true },
      { key: 'pickup_today', title: 'Pickup Hari Ini', description: 'Pengingat daftar pickup yang dijadwalkan hari ini.' },
      { key: 'delivery_today', title: 'Delivery Hari Ini', description: 'Pengingat daftar delivery yang dijadwalkan hari ini.' },
    ],
  },
  {
    title: 'Servis',
    items: [
      { key: 'device_ready_diagnosis', title: 'Perangkat Siap Diagnosa', description: 'Kirim notifikasi ketika perangkat sudah check-in dan menunggu diagnosa.' },
      { key: 'device_ready_repair', title: 'Perangkat Siap Diperbaiki', description: 'Kirim notifikasi ketika quotation disetujui.' },
      { key: 'device_repair_complete', title: 'Perangkat Selesai Diperbaiki', description: 'Kirim notifikasi ketika servis selesai.', important: true },
    ],
  },
  {
    title: 'Kapasitas & Operasional',
    items: [
      { key: 'booking_capacity_nearly_full', title: 'Kapasitas Booking Hampir Penuh', description: 'Kirim notifikasi ketika slot booking hampir habis.' },
      { key: 'queue_over_capacity', title: 'Antrian Melebihi Kapasitas', description: 'Kirim notifikasi ketika jumlah antrean melebihi kapasitas harian.' },
    ],
  },
];

const channels: { key: ChannelKey; title: string; description: string }[] = [
  { key: 'whatsapp', title: 'WhatsApp', description: 'Kirim notifikasi melalui WhatsApp workshop.' },
  { key: 'email', title: 'Email', description: 'Kirim notifikasi melalui email workshop.' },
  { key: 'in_app', title: 'In-App Notification', description: 'Tampilkan notifikasi di dalam aplikasi ServiTrack.' },
];

function ToggleSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className={`text-xs font-medium ${checked ? 'text-sky-700' : 'text-stone-500'}`}>{checked ? 'ON' : 'OFF'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex h-6 w-11 items-center rounded-full border transition-colors ${checked ? 'border-sky-600 bg-sky-600' : 'border-stone-300 bg-stone-200'}`}>
          <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </div>
  );
}

function SettingRow({
  title,
  description,
  important,
  enabled,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  important?: boolean;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold leading-5 text-zinc-900">{title}</h3>
          {important && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-800 outline outline-1 outline-amber-200">Penting</span>}
        </div>
        <p className="mt-1 text-xs leading-5 text-stone-600">{description}</p>
      </div>
      <ToggleSwitch label={title} checked={enabled} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function NotificationsHeader() {
  return (
    <header>
      <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Notifikasi</h1>
      <p className="mt-1 text-xs leading-5 text-stone-600">Kelola notifikasi operasional workshop dan pengingat penting sistem.</p>
    </header>
  );
}

function NotificationSettingsForm({ settings, tenantId }: { settings: NotificationPreferences; tenantId: string }) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => ({
    event_preferences: { ...settings.event_preferences },
    channels: { ...settings.channels },
  }), [settings]);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const saveMutation = useMutation({ mutationFn: updateNotificationPreferences });
  const saving = saveMutation.isPending;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const setEvent = (key: NotificationEventKey, enabled: boolean) => {
    setDraft((current) => ({ ...current, event_preferences: { ...current.event_preferences, [key]: enabled } }));
    setError('');
    setSuccess('');
  };
  const setChannel = (key: ChannelKey, enabled: boolean) => {
    setDraft((current) => ({ ...current, channels: { ...current.channels, [key]: enabled } }));
    setError('');
    setSuccess('');
  };

  const save = async () => {
    setError('');
    setSuccess('');
    try {
      const updated = await saveMutation.mutateAsync(draft);
      queryClient.setQueryData(['notification-settings', tenantId], updated);
      setDraft({ event_preferences: { ...updated.event_preferences }, channels: { ...updated.channels } });
      setSuccess('Pengaturan notifikasi berhasil disimpan.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Gagal menyimpan pengaturan notifikasi. Silakan coba lagi.');
    }
  };

  const reset = () => {
    setDraft(initial);
    setError('');
    setSuccess('');
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <NotificationsHeader />

      {notificationGroups.map((group) => {
        const headingId = `notification-group-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return (
          <section key={group.title} aria-labelledby={headingId} className="flex flex-col gap-3">
            <div>
              <h2 id={headingId} className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-500">{group.title}</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
              {group.items.map((item, index) => (
                <div key={item.key} className={index ? 'border-t border-black/5' : ''}>
                  <SettingRow
                    title={item.title}
                    description={item.description}
                    important={item.important}
                    enabled={draft.event_preferences[item.key]}
                    disabled={saving}
                    onChange={(enabled) => setEvent(item.key, enabled)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="notification-channels-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="notification-channels-heading" className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-500">Saluran Notifikasi</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          {channels.map((channel, index) => (
            <div key={channel.key} className={index ? 'border-t border-black/5' : ''}>
              <SettingRow
                title={channel.title}
                description={channel.description}
                enabled={draft.channels[channel.key]}
                disabled={saving}
                onChange={(enabled) => setChannel(channel.key, enabled)}
              />
            </div>
          ))}
        </div>
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
          Jika sebuah notifikasi aktif tetapi salurannya dimatikan, notifikasi tidak dikirim melalui saluran tersebut.
        </p>
      </section>

      <footer className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div aria-live="polite" className="min-h-5 text-xs">
          {error && <p role="alert" className="font-medium text-rose-700">{error}</p>}
          {success && <p role="status" className="font-medium text-emerald-700">{success}</p>}
          {!error && !success && dirty && <p className="text-stone-500">Ada perubahan yang belum disimpan.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving || !dirty} onClick={reset}>Reset Perubahan</Button>
          <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function NotificationsLoading() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <NotificationsHeader />
      {notificationGroups.slice(0, 3).map((group) => (
        <section key={group.title} aria-label={`Memuat ${group.title}`} aria-busy="true" className="flex flex-col gap-3">
          <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
          <div className="h-40 animate-pulse rounded-xl border border-black/5 bg-white" />
        </section>
      ))}
    </div>
  );
}

export default function NotificationSettingsPage() {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const settingsQuery = useQuery({
    queryKey: ['notification-settings', tenantId],
    queryFn: getNotificationPreferences,
    enabled: Boolean(tenantId),
  });

  if (settingsQuery.isPending) return <NotificationsLoading />;
  if (settingsQuery.isError || !settingsQuery.data || !tenantId) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <NotificationsHeader />
        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <p role="alert" className="text-sm font-medium text-rose-700">Pengaturan notifikasi gagal dimuat. Periksa koneksi lalu coba lagi.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void settingsQuery.refetch()}>Coba lagi</Button>
        </section>
      </div>
    );
  }

  return <NotificationSettingsForm key={tenantId} tenantId={tenantId} settings={settingsQuery.data} />;
}
