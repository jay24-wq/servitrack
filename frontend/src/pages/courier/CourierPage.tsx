import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle, Clock, MapPin, NavigationArrow, Package, Phone,
  Truck, WarningCircle,
} from '@phosphor-icons/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { getCourierAssignments, getCourierDashboard, type CourierAssignment } from '../../lib/api';
import { resolveCourierDestination, googleMapsDirectionsUrl, localPhoneNumber } from '../../lib/courier-task';
import { getDeviceDisplayName } from '../../lib/mappers';
import { useAuthStore } from '../../store';

const terminal = ['SELESAI', 'PERANGKAT_TIBA_DI_WORKSHOP', 'PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE'];
const statusLabels: Record<string, string> = {
  KURIR_DITUGASKAN: 'Kurir ditugaskan', MENUJU_LOKASI: 'Menuju lokasi', TIBA_DI_LOKASI: 'Tiba di lokasi',
  PERANGKAT_DIJEMPUT: 'Perangkat dijemput', MENUJU_TOKO: 'Menuju toko', PERANGKAT_TIBA_DI_WORKSHOP: 'Tiba di toko',
  SIAP_DIANTAR: 'Siap diantar', MENUJU_CUSTOMER: 'Menuju pelanggan', SAMPAI_DI_LOKASI: 'Tiba di pelanggan',
  PERANGKAT_DISERAHKAN: 'Perangkat diserahkan', SELESAI: 'Selesai', PICKUP_FAILED: 'Pickup gagal', DELIVERY_FAILED: 'Delivery gagal',
};
const statusLabel = (status: string) => statusLabels[status] ?? status.replaceAll('_', ' ').toLowerCase();

function formatSchedule(task: CourierAssignment) {
  if (!task.schedule_date) return 'Jadwal belum ditentukan';
  const date = new Date(`${String(task.schedule_date).slice(0, 10)}T00:00:00+08:00`);
  return `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' }).format(date)} · ${task.schedule_time || '--:--'} WITA`;
}

export default function CourierPage({ filter }: { filter?: 'tasks' | 'history' }) {
  const userName = useAuthStore((state) => state.user?.name) || 'Kurir';
  const [loaded, setLoaded] = useState<{ filter?: 'tasks' | 'history'; rows: CourierAssignment[]; stats: Record<string, number>; error?: string } | null>(null);
  const [kind, setKind] = useState<'all' | 'pickup' | 'delivery'>('all');
  const current = loaded?.filter === filter ? loaded : null;
  const rows = current?.rows ?? [];
  const stats = current?.stats ?? {};
  const loadError = current?.error ?? '';
  const loading = current === null;

  useEffect(() => {
    let current = true;
    const request = filter === 'tasks' || filter === 'history'
      ? getCourierAssignments().then((rows) => ({ rows, stats: {} }))
      : getCourierDashboard().then((data) => ({ rows: data.active, stats: data.stats }));
    void request.then((data) => { if (current) setLoaded({ filter, ...data }); }).catch(() => {
      if (current) setLoaded({ filter, rows: [], stats: {}, error: 'Tugas belum dapat dimuat. Periksa koneksi lalu coba lagi.' });
    });
    return () => { current = false; };
  }, [filter]);

  const filtered = kind === 'all' ? rows : rows.filter((row) => row.assignment_type === kind);
  const visible = filter === 'history'
    ? filtered.filter((row) => terminal.includes(row.status))
    : filter === 'tasks'
      ? filtered.filter((row) => !terminal.includes(row.status))
      : filtered;
  const failed = (stats.pickup_gagal || 0) + (stats.delivery_gagal || 0);
  const cards = [
    { label: 'Tugas hari ini', value: (stats.pickup_hari_ini || 0) + (stats.delivery_hari_ini || 0), detail: `${stats.pickup_hari_ini || 0} pickup · ${stats.delivery_hari_ini || 0} delivery`, icon: Package, tone: 'text-sky-700', tile: 'bg-blue-50', badge: 'Aktif', badgeTone: 'bg-blue-50 text-sky-700 outline-blue-200' },
    { label: 'Dalam perjalanan', value: stats.dalam_perjalanan || 0, detail: 'Sedang menuju lokasi', icon: NavigationArrow, tone: 'text-amber-700', tile: 'bg-amber-50', badge: 'Berjalan', badgeTone: 'bg-amber-50 text-amber-700 outline-amber-200' },
    { label: 'Selesai hari ini', value: stats.selesai_hari_ini || 0, detail: 'Perangkat berhasil diterima', icon: CheckCircle, tone: 'text-emerald-700', tile: 'bg-emerald-50', badge: 'Selesai', badgeTone: 'bg-emerald-50 text-emerald-700 outline-emerald-200' },
    { label: 'Perlu ditangani', value: failed, detail: 'Tugas yang mengalami kendala', icon: WarningCircle, tone: 'text-rose-700', tile: 'bg-rose-50', badge: 'Perlu tindakan', badgeTone: 'bg-rose-50 text-rose-700 outline-rose-200' },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8 lg:mx-0 lg:max-w-none">
      <header className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 lg:leading-8 lg:text-zinc-900">{filter === 'history' ? 'Riwayat tugas' : filter === 'tasks' ? 'Tugas kurir' : `Selamat bertugas, ${userName}`}</h1>
          <p className="text-sm text-stone-600 lg:mt-1 lg:text-xs lg:leading-4">Pickup dan delivery dalam satu alur kerja.</p>
        </div>
      </header>

      {!filter && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 lg:grid-cols-4 lg:gap-4" aria-label="Ringkasan tugas">
        {cards.map((card) => {
          const Icon = card.icon;
          return <article key={card.label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 lg:overflow-hidden lg:border-black/10 lg:p-5 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
            <div className="lg:hidden">
              <div className="flex items-center justify-between">
                <Icon size={22} weight="fill" className={card.tone} />
                <span className="text-2xl font-bold tabular-nums text-zinc-950">{card.value}</span>
              </div>
              <h2 className="mt-4 text-sm font-semibold text-zinc-900">{card.label}</h2>
              <p className="mt-1 text-xs text-stone-600">{card.detail}</p>
            </div>
            <div className="hidden lg:flex lg:flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-10 items-center justify-center rounded-lg ${card.tile} ${card.tone}`}>
                  <Icon size={20} weight="fill" />
                </span>
                <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-tight outline outline-1 ${card.badgeTone}`}>
                  {card.badge}
                </span>
              </div>
              <div className="pt-4">
                <p className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-400">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold leading-9 tabular-nums text-zinc-900">{card.value}</p>
                <p className="mt-1 text-xs font-medium text-stone-600">{card.detail}</p>
              </div>
            </div>
          </article>;
        })}
      </section>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:rounded-xl lg:border-black/10 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:border-black/10 lg:p-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 lg:text-sm lg:leading-5">{filter === 'history' ? 'Riwayat perjalanan' : 'Daftar tugas'}</h2>
            <p className="mt-1 text-sm text-stone-600 lg:mt-0 lg:text-xs lg:leading-4">{filter === 'history' ? 'Tugas pickup dan delivery yang telah selesai atau mengalami kendala.' : 'Pilih tugas untuk melihat rute, lokasi, dan tindakan berikutnya.'}</p>
          </div>
          <Badge className="w-fit bg-sky-50 px-3 py-1 text-sky-800 lg:rounded-sm lg:outline lg:outline-1 lg:outline-sky-200">{visible.length} tugas</Badge>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-stone-200 px-4 py-3 sm:px-5 lg:hidden" aria-label="Filter tugas">
          {(['all', 'pickup', 'delivery'] as const).map((value) => {
            const title = value === 'all' ? 'Semua' : value === 'pickup' ? 'Pickup' : 'Delivery';
            return <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value}
              className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 ${kind === value ? 'bg-zinc-950 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
              {title}
            </button>;
          })}
        </div>

        <div className="hidden border-b border-black/10 px-5 py-3 lg:block" aria-label="Filter tugas">
          <div className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-stone-100 p-1">
            {(['all', 'pickup', 'delivery'] as const).map((value) => {
              const title = value === 'all' ? 'Semua' : value === 'pickup' ? 'Pickup' : 'Delivery';
              return <Button key={value} type="button" variant={kind === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={kind === value}
                onClick={() => setKind(value)} className={kind === value ? 'h-8 bg-white px-3 text-xs text-sky-700 shadow-sm hover:bg-white' : 'h-8 px-3 text-xs font-medium text-stone-600'}>
                {title}
              </Button>;
            })}
          </div>
        </div>

        {loadError && <p role="alert" className="m-4 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-800 sm:m-5 lg:rounded-lg lg:border lg:border-rose-200 lg:text-xs">{loadError}</p>}
        {loading ? <>
          <div className="space-y-3 p-4 sm:p-5 lg:hidden" aria-label="Memuat tugas">
            {[0, 1, 2].map((key) => <div key={key} className="h-36 animate-pulse rounded-xl bg-stone-100" />)}
          </div>
          <div className="hidden space-y-3 p-5 lg:block" aria-label="Memuat tugas">
            {[0, 1, 2, 3].map((key) => <div key={key} className="h-12 animate-pulse rounded-lg bg-stone-100" />)}
          </div>
        </> : visible.length === 0 && !loadError ? <>
          <div className="px-6 py-14 text-center lg:hidden">
            <Truck size={34} className="mx-auto text-stone-400" />
            <p className="mt-3 font-semibold text-zinc-800">Belum ada tugas di sini</p>
            <p className="mt-1 text-sm text-stone-600">Tugas baru akan muncul setelah ditugaskan kepada Anda.</p>
          </div>
          <div className="hidden m-5 rounded-xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center lg:block">
            <Truck size={28} className="mx-auto text-stone-400" />
            <p className="mt-3 text-sm font-semibold text-zinc-900">Belum ada tugas di sini</p>
            <p className="mt-1 text-xs text-stone-600">Tugas baru akan muncul setelah ditugaskan kepada Anda.</p>
          </div>
        </> : <>
        <div className="divide-y divide-stone-200 lg:hidden">
          {visible.map((task) => {
            const destination = resolveCourierDestination(task);
            const directionsUrl = googleMapsDirectionsUrl(destination);
            const phone = localPhoneNumber(task.customer_phone);
            const reference = task.ticket_code || task.booking_code || task.reference || 'Belum tersedia';
            return <article key={task.id} className="p-4 transition hover:bg-stone-50 sm:p-5">
              <Link to={`/courier/tasks/${encodeURIComponent(task.id)}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={task.assignment_type === 'pickup' ? 'bg-violet-50 text-violet-800' : 'bg-sky-50 text-sky-800'}>{task.assignment_type === 'pickup' ? 'PICKUP' : 'DELIVERY'}</Badge>
                  <span className="text-xs font-medium text-stone-500">{reference}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-zinc-700"><Clock size={14} />{statusLabel(task.status)}</span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-zinc-950">{task.customer_name || 'Belum tersedia'}</h3>
                    <p className="mt-1 text-sm text-stone-600">{!task.device_model || task.device_model.trim() === '-' ? 'Belum tersedia' : getDeviceDisplayName(task.device_model)} <span aria-hidden="true">·</span> {formatSchedule(task)}</p>
                  </div>
                  <ArrowRight size={20} className="mt-1 shrink-0 text-stone-400" />
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm leading-5 text-stone-700">
                  <MapPin size={17} weight="fill" className="mt-0.5 shrink-0 text-sky-700" />
                  <span><span className="font-semibold">{destination.label}:</span> {destination.address || 'Belum tersedia'}</span>
                </p>
              </Link>
              <div className="mt-4 flex gap-2">
                {directionsUrl ? <a href={directionsUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"><NavigationArrow size={18} weight="fill" />Rute</a>
                  : <button type="button" disabled className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-stone-100 px-4 text-sm font-semibold text-stone-500" aria-label="Rute belum tersedia"><NavigationArrow size={18} />Rute belum tersedia</button>}
                {phone ? <a href={`tel:${phone}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-zinc-800 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"><Phone size={17} />{phone}</a>
                  : <button type="button" disabled className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-medium text-stone-500"><Phone size={17} />Belum tersedia</button>}
              </div>
            </article>;
          })}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <caption className="sr-only">Daftar tugas kurir pickup dan delivery</caption>
            <thead>
              <tr className="bg-stone-100">
                {['Jenis', 'Kode', 'Pelanggan', 'Perangkat', 'Jadwal', 'Alamat tujuan', 'Status', 'Aksi'].map((heading) => <th key={heading} scope="col" className="px-3 py-3 text-xs font-semibold uppercase leading-4 tracking-wide text-stone-600">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => {
                const destination = resolveCourierDestination(task);
                const directionsUrl = googleMapsDirectionsUrl(destination);
                const phone = localPhoneNumber(task.customer_phone);
                const reference = task.ticket_code || task.booking_code || task.reference || 'Belum tersedia';
                return <tr key={task.id} className="border-b border-black/5 align-middle transition-colors last:border-0 hover:bg-sky-50/40">
                  <td className="px-3 py-3"><Badge className={task.assignment_type === 'pickup' ? 'rounded-sm bg-violet-50 text-violet-800 outline outline-1 outline-violet-200' : 'rounded-sm bg-sky-50 text-sky-800 outline outline-1 outline-sky-200'}>{task.assignment_type === 'pickup' ? 'PICKUP' : 'DELIVERY'}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3"><Link to={`/courier/tasks/${encodeURIComponent(task.id)}`} className="text-xs font-semibold text-sky-700 hover:underline">{reference}</Link></td>
                  <td className="max-w-40 px-3 py-3"><Link to={`/courier/tasks/${encodeURIComponent(task.id)}`} className="block truncate text-sm font-semibold text-zinc-900 hover:text-sky-700">{task.customer_name || 'Belum tersedia'}</Link></td>
                  <td className="max-w-36 px-3 py-3 text-xs text-stone-700"><span className="block truncate">{!task.device_model || task.device_model.trim() === '-' ? 'Belum tersedia' : getDeviceDisplayName(task.device_model)}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-stone-600">{formatSchedule(task)}</td>
                  <td className="max-w-56 px-3 py-3 text-xs text-stone-700"><span className="block truncate" title={destination.address || 'Belum tersedia'}>{destination.address || 'Belum tersedia'}</span></td>
                  <td className="whitespace-nowrap px-3 py-3"><Badge variant="secondary" className="rounded-sm text-[10px] font-semibold">{statusLabel(task.status)}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {directionsUrl ? <Button asChild size="sm" className="h-8 gap-1 px-2.5 text-[11px]"><a href={directionsUrl} target="_blank" rel="noreferrer"><NavigationArrow weight="fill" />Rute</a></Button>
                        : <Button size="sm" disabled variant="outline" className="h-8 gap-1 px-2.5 text-[11px]"><NavigationArrow />Rute</Button>}
                      {phone ? <Button asChild size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-[11px]"><a href={`tel:${phone}`}><Phone />Telepon</a></Button>
                        : <Button size="sm" variant="outline" disabled className="h-8 gap-1 px-2.5 text-[11px]"><Phone />Telepon</Button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        </>}
      </section>
    </div>
  );
}
