import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle, PencilSimple, X } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  getTenantOperationalSettings,
  updateTenantOperationalSettings,
  type TenantOperatingHour,
  type TenantOperationalSettings,
  type UpdateTenantOperationalSettingsInput,
} from '../../lib/api';
import { useAuthStore } from '../../store';

const DAYS = [
  { weekday: 1, label: 'Senin' },
  { weekday: 2, label: 'Selasa' },
  { weekday: 3, label: 'Rabu' },
  { weekday: 4, label: 'Kamis' },
  { weekday: 5, label: 'Jumat' },
  { weekday: 6, label: 'Sabtu' },
  { weekday: 7, label: 'Minggu' },
] as const;

type EditableDay = TenantOperatingHour & { configured: boolean };

function operatingDaysFromSettings(settings: TenantOperationalSettings) {
  const byDay = new Map(settings.operating_hours.map((day) => [day.weekday, day]));
  return DAYS.map(({ weekday }) => {
    const saved = byDay.get(weekday);
    return {
      weekday,
      configured: Boolean(saved),
      is_open: saved?.is_open ?? false,
      open_time: saved?.open_time?.slice(0, 5) ?? null,
      close_time: saved?.close_time?.slice(0, 5) ?? null,
    } satisfies EditableDay;
  });
}

function summarizeOperatingHours(days: EditableDay[]) {
  const groups: { key: string; days: string[]; value: string }[] = [];
  for (const day of days) {
    const label = DAYS[day.weekday - 1].label;
    const value = !day.configured
      ? 'Belum diatur'
      : !day.is_open
        ? 'Tutup'
        : day.open_time && day.close_time
          ? `${day.open_time} - ${day.close_time}`
          : 'Jam belum lengkap';
    const key = `${day.configured}:${value}`;
    const previous = groups[groups.length - 1];
    if (previous?.key === key) previous.days.push(label);
    else groups.push({ key, days: [label], value });
  }

  return groups.map((group) => ({
    days: group.days.length > 1 ? `${group.days[0]} - ${group.days[group.days.length - 1]}` : group.days[0],
    value: group.value,
  }));
}

function Switch({ checked, label, status, disabled, onChange }: { checked: boolean; label: string; status: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${checked ? 'text-sky-700' : 'text-stone-500'}`}>{status}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex size-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex h-6 w-11 items-center rounded-full border transition-colors ${checked ? 'border-sky-600 bg-sky-600' : 'border-stone-300 bg-stone-200'}`}>
          <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </div>
  );
}

function OperationalForm({ settings, tenantId }: { settings: TenantOperationalSettings; tenantId: string }) {
  const queryClient = useQueryClient();
  const savedHours = useMemo(() => operatingDaysFromSettings(settings), [settings]);
  const [hoursDraft, setHoursDraft] = useState<EditableDay[]>(savedHours);
  const [trackingPrefix, setTrackingPrefix] = useState(settings.tracking_prefix);
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState(String(settings.default_booking_capacity));
  const [hoursError, setHoursError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [trackingSuccess, setTrackingSuccess] = useState('');
  const saveMutation = useMutation({ mutationFn: updateTenantOperationalSettings });
  const saving = saveMutation.isPending;
  const hoursDirty = JSON.stringify(hoursDraft) !== JSON.stringify(savedHours);
  const trackingDirty = trackingPrefix !== settings.tracking_prefix;
  const bookingDirty = bookingDraft !== String(settings.default_booking_capacity);
  const prefixIsValid = /^[A-Z]{3}$/.test(trackingPrefix);
  const bookingCapacity = Number(bookingDraft);
  const hoursSummary = summarizeOperatingHours(savedHours);

  const updateDay = (weekday: number, updates: Partial<EditableDay>) => {
    setHoursDraft((current) => current.map((day) => day.weekday === weekday ? { ...day, ...updates, configured: true } : day));
    setHoursError('');
  };

  const saveHours = async () => {
    setHoursError('');
    const invalidDay = hoursDraft.find((day) => day.configured && (
      (day.is_open && (!day.open_time || !day.close_time || day.open_time >= day.close_time)) ||
      (Boolean(day.open_time) !== Boolean(day.close_time)) ||
      (day.open_time && day.close_time && day.open_time >= day.close_time)
    ));
    if (invalidDay) {
      setHoursError(`${DAYS[invalidDay.weekday - 1].label}: jam buka dan tutup belum valid.`);
      return;
    }

    const payload: UpdateTenantOperationalSettingsInput = {
      tracking_prefix: settings.tracking_prefix,
      default_booking_capacity: settings.default_booking_capacity,
      operating_hours: hoursDraft.filter((day) => day.configured).map(({ weekday, is_open, open_time, close_time }) => ({
        weekday,
        is_open,
        open_time: open_time || null,
        close_time: close_time || null,
      })),
    };

    try {
      const saved = await saveMutation.mutateAsync(payload);
      queryClient.setQueryData(['tenant-operational-settings', tenantId], saved);
      setHoursDraft(operatingDaysFromSettings(saved));
      setHoursDialogOpen(false);
    } catch (saveError: any) {
      setHoursError(saveError?.response?.data?.error || 'Gagal menyimpan jam operasional. Silakan coba lagi.');
    }
  };

  const saveTrackingPrefix = async () => {
    setTrackingError('');
    setTrackingSuccess('');
    if (!prefixIsValid) {
      setTrackingError('Prefix tracking harus tepat 3 huruf A-Z.');
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync({
        tracking_prefix: trackingPrefix,
        default_booking_capacity: settings.default_booking_capacity,
        operating_hours: settings.operating_hours,
      });
      queryClient.setQueryData(['tenant-operational-settings', tenantId], saved);
      setTrackingPrefix(saved.tracking_prefix);
      setTrackingSuccess('Prefix tracking berhasil disimpan.');
    } catch (saveError: any) {
      setTrackingError(saveError?.response?.data?.error || 'Gagal menyimpan prefix tracking. Silakan coba lagi.');
    }
  };

  const resetTrackingPrefix = () => {
    setTrackingPrefix(settings.tracking_prefix);
    setTrackingError('');
    setTrackingSuccess('');
  };

  const saveBookingCapacity = async () => {
    setBookingError('');
    if (!Number.isInteger(bookingCapacity) || bookingCapacity < 1 || bookingCapacity > 10000) {
      setBookingError('Maksimal booking per hari harus berupa bilangan bulat positif.');
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync({
        tracking_prefix: settings.tracking_prefix,
        default_booking_capacity: bookingCapacity,
        operating_hours: settings.operating_hours,
      });
      queryClient.setQueryData(['tenant-operational-settings', tenantId], saved);
      setBookingDraft(String(saved.default_booking_capacity));
      setBookingDialogOpen(false);
    } catch (saveError: any) {
      setBookingError(saveError?.response?.data?.error || 'Gagal menyimpan kapasitas booking. Silakan coba lagi.');
    }
  };

  const openBookingDialog = () => {
    setBookingDraft(String(settings.default_booking_capacity));
    setBookingError('');
    setBookingDialogOpen(true);
  };

  const openHoursDialog = () => {
    setHoursDraft(savedHours);
    setHoursError('');
    setHoursDialogOpen(true);
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pengaturan Operasional</h1>
        <p className="mt-1 text-xs leading-5 text-stone-600">Kelola jam operasional, konfigurasi booking, dan pengaturan tracking code workshop.</p>
      </header>

      <section aria-labelledby="operating-hours-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="operating-hours-heading" className="text-sm font-bold leading-5 text-zinc-900">Jam Operasional</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Atur hari dan jam operasional workshop.</p>
          </div>
          <Button type="button" variant="outline" disabled={saving} onClick={openHoursDialog} className="self-start">
            <PencilSimple weight="bold" className="size-4" /> Ubah
          </Button>
        </div>

        <div className="mt-4 divide-y divide-black/5 rounded-lg border border-black/5 bg-stone-50 px-4 sm:px-5">
          {hoursSummary.map((summary) => (
            <div key={summary.days} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-sm font-semibold text-zinc-900">{summary.days}</p>
              <p className={`text-sm tabular-nums ${summary.value === 'Tutup' || summary.value === 'Belum diatur' ? 'text-stone-500' : 'font-semibold text-zinc-900'}`}>{summary.value}</p>
            </div>
          ))}
        </div>
      </section>

      <Dialog.Root open={hoursDialogOpen} onOpenChange={setHoursDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl focus:outline-none">
            <header className="flex items-start justify-between gap-4 border-b border-black/10 bg-stone-50 p-5 sm:p-6">
              <div>
                <Dialog.Title className="text-lg font-bold leading-6 text-zinc-900">Ubah Jam Operasional</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-stone-600">Atur status dan rentang waktu untuk setiap hari.</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Tutup" className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </header>

            <div className="ledger-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="divide-y divide-black/5">
                {hoursDraft.map((day) => {
                  const dayName = DAYS[day.weekday - 1].label;
                  return (
                    <div key={day.weekday} className="grid grid-cols-2 items-end gap-x-3 gap-y-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(125px,1fr)_auto_minmax(135px,0.65fr)_minmax(135px,0.65fr)] sm:items-center sm:gap-x-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{dayName}</p>
                        {!day.configured && (
                          <button type="button" disabled={saving} onClick={() => updateDay(day.weekday, { is_open: false, open_time: null, close_time: null })} className="mt-1 min-h-8 rounded-md text-left text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50">
                            Tandai tutup
                          </button>
                        )}
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <Switch
                          checked={day.is_open}
                          label={`${dayName}, ${day.configured ? day.is_open ? 'buka' : 'tutup' : 'belum diatur'}`}
                          status={day.configured ? day.is_open ? 'Buka' : 'Tutup' : 'Belum diatur'}
                          disabled={saving}
                          onChange={(is_open) => updateDay(day.weekday, { is_open })}
                        />
                      </div>
                      <div>
                        <label htmlFor={`modal-open-${day.weekday}`} className="mb-1 block text-[11px] font-medium text-stone-500">Jam Buka</label>
                        <Input id={`modal-open-${day.weekday}`} type="time" disabled={saving} value={day.open_time ?? ''} onChange={(event) => updateDay(day.weekday, { open_time: event.target.value || null })} className="px-2.5 tabular-nums" />
                      </div>
                      <div>
                        <label htmlFor={`modal-close-${day.weekday}`} className="mb-1 block text-[11px] font-medium text-stone-500">Jam Tutup</label>
                        <Input id={`modal-close-${day.weekday}`} type="time" disabled={saving} value={day.close_time ?? ''} onChange={(event) => updateDay(day.weekday, { close_time: event.target.value || null })} className="px-2.5 tabular-nums" />
                      </div>
                    </div>
                  );
                })}
              </div>
              {hoursError && <p role="alert" className="mt-4 text-xs font-medium text-rose-700">{hoursError}</p>}
            </div>

            <footer className="flex justify-end gap-2 border-t border-black/10 bg-stone-50 p-4 sm:px-6">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setHoursDialogOpen(false)}>Batal</Button>
              <Button type="button" disabled={saving || !hoursDirty} onClick={() => void saveHours()}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <section aria-labelledby="booking-configuration-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="booking-configuration-heading" className="text-sm font-bold leading-5 text-zinc-900">Konfigurasi Booking</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Aturan default booking untuk tanggal yang tidak memiliki pengecualian kalender.</p>
          </div>
          <Button type="button" variant="outline" disabled={saving} onClick={openBookingDialog} className="self-start">
            <PencilSimple weight="bold" className="size-4" /> Ubah
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-black/5 bg-stone-50 px-4 py-3.5">
          <span className="text-2xl font-bold leading-8 tabular-nums text-zinc-900">{settings.default_booking_capacity}</span>
          <span className="text-sm font-semibold text-zinc-900">booking per hari</span>
          <span className="w-full text-xs leading-5 text-stone-600">Kapasitas tanggal dengan pengecualian tetap mengikuti pengaturan Kalender Operasional.</span>
        </div>
      </section>

      <Dialog.Root open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl focus:outline-none">
            <header className="flex items-start justify-between gap-4 border-b border-black/10 bg-stone-50 p-5 sm:p-6">
              <div>
                <Dialog.Title className="text-lg font-bold leading-6 text-zinc-900">Konfigurasi Booking</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-stone-600">Atur kapasitas default untuk tanggal tanpa pengecualian kalender.</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Tutup" className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </header>
            <div className="p-5 sm:p-6">
              <label htmlFor="default-booking-capacity" className="mb-1.5 block text-xs font-semibold text-stone-700">Maksimal Booking per Hari</label>
              <Input
                id="default-booking-capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                step={1}
                disabled={saving}
                value={bookingDraft}
                onChange={(event) => { setBookingDraft(event.target.value); setBookingError(''); }}
                className="tabular-nums"
              />
              <p className="mt-1.5 text-xs leading-5 text-stone-500">Tanggal yang memiliki pengecualian kalender mempertahankan kapasitas khususnya.</p>
              {bookingError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{bookingError}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-black/10 bg-stone-50 p-4 sm:px-6">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setBookingDialogOpen(false)}>Batal</Button>
              <Button type="button" disabled={saving || !bookingDirty} onClick={() => void saveBookingCapacity()}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <section aria-labelledby="tracking-code-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div>
          <h2 id="tracking-code-heading" className="text-sm font-bold leading-5 text-zinc-900">Tracking Code Configuration</h2>
          <p className="mt-1 text-xs leading-5 text-stone-600">Prefix ini hanya digunakan untuk tracking code baru. Tracking code yang sudah dibuat tidak berubah.</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tracking-prefix" className="mb-1.5 block text-xs font-semibold text-stone-700">Prefix Tracking Code</label>
            <Input id="tracking-prefix" autoComplete="off" disabled={saving} value={trackingPrefix} onChange={(event) => { setTrackingPrefix(event.target.value.toUpperCase()); setTrackingError(''); setTrackingSuccess(''); }} className="h-10 uppercase tracking-[0.12em]" aria-describedby="tracking-prefix-help" />
            <p id="tracking-prefix-help" className="mt-1.5 text-xs text-stone-500">Tepat 3 huruf A-Z. Input otomatis menjadi huruf besar.</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone-700">Tracking Code Preview</p>
            <div className="flex h-10 items-center rounded-lg border border-black/10 bg-stone-50 px-3.5 font-mono text-sm font-semibold tracking-wide text-zinc-900">
              {prefixIsValid ? `${trackingPrefix}1234567890` : 'Masukkan 3 huruf A-Z'}
            </div>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 min-h-5 text-xs">
          {trackingError && <p role="alert" className="font-medium text-rose-700">{trackingError}</p>}
          {trackingSuccess && <p role="status" className="font-medium text-emerald-700">{trackingSuccess}</p>}
          {!trackingError && !trackingSuccess && trackingDirty && <p className="text-stone-500">Prefix tracking belum disimpan.</p>}
        </div>
        <footer className="mt-4 flex justify-end gap-2 border-t border-black/10 pt-4">
          <Button type="button" variant="outline" disabled={saving || !trackingDirty} onClick={resetTrackingPrefix}>Reset Perubahan</Button>
          <Button type="button" disabled={saving || !trackingDirty} onClick={() => void saveTrackingPrefix()}>
            {saving ? 'Menyimpan...' : <><CheckCircle weight="bold" className="size-4" /> Simpan Perubahan</>}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function OperationalLoading() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pengaturan Operasional</h1>
        <p className="mt-1 text-xs leading-5 text-stone-600">Kelola jam operasional, konfigurasi booking, dan pengaturan tracking code workshop.</p>
      </header>
      <div aria-label="Memuat pengaturan operasional" aria-busy="true" className="grid animate-pulse gap-5">
        <div className="h-72 rounded-xl border border-black/5 bg-white" />
        <div className="h-52 rounded-xl border border-black/5 bg-white" />
        <div className="h-36 rounded-xl border border-black/5 bg-white" />
      </div>
    </div>
  );
}

export default function OperationalSettingsPage() {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const settingsQuery = useQuery({
    queryKey: ['tenant-operational-settings', tenantId],
    queryFn: getTenantOperationalSettings,
    enabled: Boolean(tenantId),
  });

  if (settingsQuery.isPending) return <OperationalLoading />;
  if (settingsQuery.isError || !settingsQuery.data || !tenantId) {
    return (
      <div className="page-enter flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pengaturan Operasional</h1>
          <p className="mt-1 text-xs leading-5 text-stone-600">Kelola jam operasional, konfigurasi booking, dan pengaturan tracking code workshop.</p>
        </header>
        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-7">
          <p role="alert" className="text-sm font-medium text-rose-700">
            {(settingsQuery.error as any)?.response?.data?.error || 'Pengaturan operasional gagal dimuat. Periksa koneksi lalu coba lagi.'}
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void settingsQuery.refetch()}>Coba lagi</Button>
        </section>
      </div>
    );
  }

  return <OperationalForm key={tenantId} settings={settingsQuery.data} tenantId={tenantId} />;
}
