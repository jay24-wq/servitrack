import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarBlank, Camera, CheckCircle, Crosshair, MapPin,
  NavigationArrow, Package, Phone, WarningCircle, X,
} from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import { getCourierAssignment, getCourierAssignmentRoute, updateCourierStatus, uploadCourierProof, type CourierAssignment, type CourierRoute } from '../../lib/api';
import { courierFailureFormReady, googleMapsDirectionsUrl, localPhoneNumber, resolveCourierDestination, type CourierPlace } from '../../lib/courier-task';
import { getDeviceDisplayName } from '../../lib/mappers';
import CourierTaskMap, { type MapPoint } from '../../components/courier/CourierTaskMap';

const nextStatus: Record<string, string> = {
  KURIR_DITUGASKAN: 'MENUJU_LOKASI', MENUNGGU_PICKUP: 'MENUJU_LOKASI', MENUJU_LOKASI: 'TIBA_DI_LOKASI',
  TIBA_DI_LOKASI: 'PERANGKAT_DIJEMPUT', PERANGKAT_DIJEMPUT: 'MENUJU_TOKO', MENUJU_TOKO: 'PERANGKAT_TIBA_DI_WORKSHOP',
  SIAP_DIANTAR: 'MENUJU_CUSTOMER', MENUJU_CUSTOMER: 'SAMPAI_DI_LOKASI', SAMPAI_DI_LOKASI: 'PERANGKAT_DISERAHKAN',
  PERANGKAT_DISERAHKAN: 'SELESAI',
};
const statusLabels: Record<string, string> = {
  KURIR_DITUGASKAN: 'Kurir Ditugaskan', MENUJU_LOKASI: 'Menuju Lokasi', TIBA_DI_LOKASI: 'Tiba di Lokasi',
  PERANGKAT_DIJEMPUT: 'Perangkat Dijemput', MENUJU_TOKO: 'Menuju Toko', PERANGKAT_TIBA_DI_WORKSHOP: 'Perangkat Tiba di Toko',
  SIAP_DIANTAR: 'Siap Diantar', MENUJU_CUSTOMER: 'Menuju Pelanggan', SAMPAI_DI_LOKASI: 'Tiba di Pelanggan',
  PERANGKAT_DISERAHKAN: 'Perangkat Diserahkan', SELESAI: 'Tugas Selesai', PICKUP_FAILED: 'Pickup Gagal', DELIVERY_FAILED: 'Delivery Gagal',
  CUSTOMER_NOT_HOME: 'Pelanggan tidak di rumah', CUSTOMER_CANCELLED: 'Pelanggan menolak', WRONG_ADDRESS: 'Alamat tidak ditemukan', UNREACHABLE: 'Nomor tidak bisa dihubungi', OTHER: 'Lainnya',
};
const failureReasons = [
  ['CUSTOMER_NOT_HOME', 'Pelanggan tidak di rumah'],
  ['WRONG_ADDRESS', 'Alamat tidak ditemukan'],
  ['CUSTOMER_CANCELLED', 'Pelanggan menolak / membatalkan'],
  ['UNREACHABLE', 'Nomor tidak bisa dihubungi'],
  ['OTHER', 'Lainnya'],
] as const;
const labelStatus = (status: string) => statusLabels[status] ?? status.replaceAll('_', ' ').toLowerCase();
const errorText = (error: any, fallback: string) => error?.response?.data?.error || error?.message || fallback;

function placePoint(place: CourierPlace, fallbackName: string): MapPoint | null {
  if (place.latitude === null || place.longitude === null) return null;
  return { name: place.name || fallbackName, label: place.label, latitude: place.latitude, longitude: place.longitude };
}

function formatSchedule(task: CourierAssignment) {
  if (!task.schedule_date) return 'Jadwal belum ditentukan';
  const date = new Date(`${String(task.schedule_date).slice(0, 10)}T00:00:00+08:00`);
  return `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }).format(date)} · ${task.schedule_time || '--:--'} WITA`;
}

function formatRouteDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

function formatRouteDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam${minutes % 60 ? ` ${minutes % 60} menit` : ''}`;
}

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Perangkat ini tidak mendukung lokasi GPS.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 });
  });
}

export default function CourierTaskDetailPage() {
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<{ id: string; task: CourierAssignment | null; error: string } | null>(null);
  const current = loaded?.id === id ? loaded : null;
  const task = current?.task ?? null;
  const loading = current === null;
  const loadError = current?.error ?? '';
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [failureOpen, setFailureOpen] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [failureNotes, setFailureNotes] = useState('');
  const [failureError, setFailureError] = useState('');
  const [failureBusy, setFailureBusy] = useState(false);
  const failureLock = useRef(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [courierPoint, setCourierPoint] = useState<MapPoint | null>(null);
  const [routeState, setRouteState] = useState<{ key: string; data: CourierRoute } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const refresh = async () => {
    const data = await getCourierAssignment(id);
    setLoaded({ id, task: data, error: '' });
    return data;
  };

  useEffect(() => {
    let active = true;
    void getCourierAssignment(id).then((data) => { if (active) setLoaded({ id, task: data, error: '' }); }).catch((error) => {
      if (active) setLoaded({ id, task: null, error: error?.response?.status === 404 ? 'Tugas tidak ditemukan atau bukan milik akun Anda.' : errorText(error, 'Tugas belum dapat dimuat.') });
    });
    return () => { active = false; };
  }, [id]);

  const destination = useMemo(() => task ? resolveCourierDestination(task) : null, [task]);
  const customerPlace = useMemo(() => task ? resolveCourierDestination({ ...task, assignment_type: 'delivery', status: 'SIAP_DIANTAR' }) : null, [task]);
  const storePlace = useMemo(() => task ? resolveCourierDestination({ ...task, assignment_type: 'pickup', status: 'PERANGKAT_DIJEMPUT', device_picked_up: true }) : null, [task]);
  const pickedUp = destination?.label === 'Alamat toko';
  const pickupPoint = useMemo(() => {
    if (!task || !customerPlace || !storePlace) return null;
    if (task.assignment_type === 'delivery') return placePoint(storePlace, 'Toko');
    if (pickedUp) return placePoint(customerPlace, 'Pelanggan');
    return courierPoint ?? placePoint(storePlace, 'Toko');
  }, [task, customerPlace, storePlace, pickedUp, courierPoint]);
  const destinationPoint = useMemo(() => destination ? placePoint(destination, destination.label === 'Alamat toko' ? 'Toko' : 'Pelanggan') : null, [destination]);
  const mapsUrl = destination ? googleMapsDirectionsUrl(destination) : null;
  const routeTaskId = task?.id;
  const routeKey = JSON.stringify([id, routeTaskId, task?.status, task?.device_picked_up, task?.assignment_type]);
  const route = routeState?.key === routeKey ? routeState.data : null;

  useEffect(() => {
    if (!routeTaskId) return;
    const controller = new AbortController();
    let active = true;
    void getCourierAssignmentRoute(id, controller.signal).then((result) => {
      if (active) setRouteState({ key: routeKey, data: result });
    }).catch(() => {});
    return () => { active = false; controller.abort(); };
  }, [id, routeTaskId, routeKey]);

  const phone = localPhoneNumber(task?.customer_phone);
  const next = task ? nextStatus[task.status] : null;
  const invoiceBlocked = Boolean(task && task.assignment_type === 'delivery' && task.invoice_status !== 'paid' && next);
  const reference = task?.ticket_code || task?.booking_code || task?.reference || 'Belum tersedia';
  const canSendFailure = courierFailureFormReady(failureReason, failureNotes, failureBusy);

  const doAction = async () => {
    if (!task || !next || invoiceBlocked || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      const position = await currentPosition();
      await updateCourierStatus(task.id, { status: next, latitude: position.coords.latitude, longitude: position.coords.longitude });
      await refresh();
    } catch (error: any) {
      setActionError(error?.code === 1
        ? 'Izinkan akses lokasi untuk mencatat perjalanan, lalu coba lagi.'
        : error?.code === 3
          ? 'Lokasi belum ditemukan. Coba lagi di area terbuka.'
          : errorText(error, 'Gagal memperbarui tugas. Coba lagi.'));
    } finally {
      setActionBusy(false);
    }
  };

  const submitFailure = async (event: FormEvent) => {
    event.preventDefault();
    if (!task || failureLock.current || !canSendFailure) return;
    failureLock.current = true;
    setFailureBusy(true);
    setFailureError('');
    try {
      await updateCourierStatus(task.id, {
        status: task.assignment_type === 'pickup' ? 'PICKUP_FAILED' : 'DELIVERY_FAILED',
        failure_reason: failureReason,
        failure_notes: failureNotes.trim() || undefined,
      });
      setFailureOpen(false);
      setFailureReason('');
      setFailureNotes('');
      await refresh();
    } catch (error: any) {
      setFailureError(errorText(error, 'Gagal menyimpan alasan. Periksa koneksi lalu coba lagi.'));
    } finally {
      failureLock.current = false;
      setFailureBusy(false);
    }
  };

  const uploadProof = async (event: FormEvent) => {
    event.preventDefault();
    if (!task || !proofFile || proofBusy) return;
    setProofBusy(true);
    setActionError('');
    try {
      const position = await currentPosition().catch(() => null);
      await uploadCourierProof(task.id, {
        type: task.assignment_type,
        photo: proofFile,
        notes: proofNotes.trim(),
        ...(position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : {}),
      });
      setProofFile(null);
      setProofNotes('');
      await refresh();
    } catch (error: any) {
      setActionError(errorText(error, 'Bukti belum berhasil diunggah. Coba lagi.'));
    } finally {
      setProofBusy(false);
    }
  };

  const showCourierLocation = () => {
    if (!navigator.geolocation) { setLocationMessage('Browser tidak mendukung lokasi otomatis.'); return; }
    setLocating(true);
    setLocationMessage('Meminta izin lokasi…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCourierPoint({ name: 'Posisi kurir', label: 'Kurir', latitude: coords.latitude, longitude: coords.longitude });
      setLocationMessage('Posisi kurir hanya ditampilkan di peta ini.');
      setLocating(false);
    }, () => {
      setLocationMessage('Izin lokasi tidak diberikan. Peta dan detail tugas tetap dapat digunakan.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
  };

  if (loading) return <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-50 px-6 text-sm font-medium text-stone-600 lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] lg:bg-transparent">Memuat detail tugas…</div>;
  if (!task || !destination) return <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-50 px-6 lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] lg:bg-transparent">
    <div className="max-w-sm text-center"><WarningCircle size={34} className="mx-auto text-rose-600" /><h1 className="mt-3 text-xl font-bold text-zinc-950">Detail tugas tidak tersedia</h1><p className="mt-2 text-sm text-stone-600">{loadError || 'Tugas tidak ditemukan.'}</p><Link to="/courier/tasks" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-600 px-5 text-sm font-bold text-white">Kembali ke tugas</Link></div>
  </div>;

  const originTitle = 'Lokasi Jemput';
  const originPlace = task.assignment_type === 'delivery' ? storePlace : pickedUp ? customerPlace : storePlace;
  const originIsCourier = task.assignment_type === 'pickup' && !pickedUp && Boolean(courierPoint);
  const originName = originIsCourier ? 'Posisi kurir' : task.assignment_type === 'delivery' || !pickedUp ? (originPlace?.name || 'Toko') : (originPlace?.name || 'Pelanggan');
  const originAddress = originIsCourier ? 'Lokasi kurir saat ini' : originPlace?.address;
  const destinationName = destination.name || (destination.label === 'Alamat toko' ? 'Toko' : 'Pelanggan');
  const actionLabel = invoiceBlocked ? 'Invoice belum lunas' : next ? (statusLabels[next] || labelStatus(next)) : 'Tugas selesai';
  const ticketCode = task.ticket_code || task.booking_code || task.reference;

  return <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-stone-50 text-zinc-950 lg:relative lg:inset-auto lg:z-auto lg:h-auto lg:min-h-0 lg:overflow-visible lg:bg-transparent lg:text-zinc-900">
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:mb-6 lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0">
      <Link to="/courier/tasks" aria-label="Kembali ke daftar tugas" className="grid size-10 place-items-center rounded-full text-zinc-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"><ArrowLeft size={20} weight="bold" /></Link>
      <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold lg:text-2xl lg:leading-8 lg:tracking-tight">Detail tugas</h1><p className="truncate text-xs text-stone-500 lg:mt-1 lg:text-xs lg:leading-4">{reference}</p></div>
      <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide ${task.assignment_type === 'pickup' ? 'bg-violet-50 text-violet-800' : 'bg-sky-50 text-sky-800'}`}>{task.assignment_type.toUpperCase()}</span>
    </header>

    <main className="flex-1 overflow-y-auto pb-32 lg:flex-none lg:overflow-visible lg:pb-0">
      <div className="lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.9fr)] lg:items-start lg:gap-6">
      <section aria-label="Peta perjalanan" className="relative h-[34vh] min-h-56 max-h-[390px] bg-slate-100 lg:sticky lg:top-24 lg:h-[calc(100vh-14rem)] lg:min-h-[460px] lg:max-h-[780px] lg:overflow-hidden lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        {pickupPoint && destinationPoint ? <CourierTaskMap pickup={pickupPoint} destination={destinationPoint} courier={courierPoint} route={route} /> : <div className="grid h-full place-items-center px-8 text-center">
          <div><MapPin size={30} className="mx-auto text-sky-700" /><p className="mt-2 text-sm font-semibold text-zinc-800">Peta belum dapat menampilkan kedua titik</p><p className="mt-1 max-w-sm text-xs leading-5 text-stone-600">Koordinat jemput atau tujuan belum tersedia. Detail alamat dan tugas tetap ditampilkan di bawah.</p></div>
        </div>}
        <button type="button" onClick={showCourierLocation} disabled={locating} className="absolute bottom-3 left-3 z-[500] inline-flex min-h-10 items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-3 text-xs font-semibold text-zinc-800 shadow-sm disabled:opacity-60"><Crosshair size={16} />{locating ? 'Mencari lokasi…' : 'Posisi saya'}</button>
        <span className="absolute right-3 top-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-stone-700 shadow-sm">Jemput <span className="mx-1 text-stone-400">—</span> Tujuan</span>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6 lg:mx-0 lg:max-w-none lg:gap-4 lg:px-0 lg:py-0">
        {locationMessage && <p role="status" className="text-xs text-stone-600">{locationMessage}</p>}
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 lg:rounded-xl lg:border-black/10 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{task.assignment_type.toUpperCase()}</p><h2 className="mt-1 truncate text-xl font-bold tracking-tight text-zinc-950">{task.customer_name || 'Belum tersedia'}</h2></div>
            <span className="max-w-40 rounded-full bg-amber-50 px-3 py-1.5 text-center text-xs font-bold text-amber-900 lg:rounded-sm lg:outline lg:outline-1 lg:outline-amber-200">{labelStatus(task.status)}</span>
          </div>
          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm text-zinc-800"><Package size={18} className="shrink-0 text-sky-700" /><span className="truncate">{!task.device_model || task.device_model.trim() === '-' ? 'Belum tersedia' : getDeviceDisplayName(task.device_model)}</span></p>
            <p className="flex items-center gap-2 text-sm text-zinc-800"><CalendarBlank size={18} className="shrink-0 text-sky-700" /><span>{formatSchedule(task)}</span></p>
            <div className="flex items-center gap-2 text-sm text-zinc-800"><Phone size={18} className="shrink-0 text-sky-700" />{phone ? <a href={`tel:${phone}`} className="font-semibold underline decoration-stone-300 underline-offset-4 hover:text-sky-800">{phone}</a> : <span className="text-stone-600">Belum tersedia</span>}</div>
            <p className="flex items-center gap-2 text-sm text-zinc-800"><span className="grid size-[18px] shrink-0 place-items-center rounded border border-stone-400 text-[9px] font-bold text-stone-600">#</span><span className="truncate">{ticketCode || 'Belum tersedia'}</span></p>
          </div>
          {task.failure_reason && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"><p className="font-semibold">{statusLabels[task.failure_reason] || task.failure_reason}</p>{task.failure_notes && <p className="mt-1 whitespace-pre-wrap text-rose-800">{task.failure_notes}</p>}</div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:rounded-xl lg:border-black/10 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]" aria-label="Detail lokasi">
          <LocationBlock title={originTitle} name={originName} address={originAddress} icon="pickup" routeSummary={route ? `${formatRouteDistance(route.distance)} · ${formatRouteDuration(route.duration)}` : undefined} />
          <div className="ml-[31px] h-4 border-l-2 border-dashed border-stone-300" />
          <LocationBlock title="Lokasi Tujuan" name={destinationName} address={destination.address} icon="destination" />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 lg:rounded-xl lg:border-black/10 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-bold text-zinc-950">Bukti serah terima</h2>
          <p className="mt-1 text-sm text-stone-600">Tambahkan foto kondisi perangkat atau bukti pengantaran.</p>
          {task.proofs?.length ? <p className="mt-2 text-xs font-medium text-emerald-800">{task.proofs.length} bukti tersimpan</p> : null}
          <form onSubmit={uploadProof} className="mt-4 flex flex-col gap-3">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 text-sm font-semibold text-zinc-800 hover:bg-stone-100 focus-within:ring-2 focus-within:ring-sky-600">
              <Camera size={19} />{proofFile?.name || 'Pilih foto bukti'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
            </label>
            <textarea value={proofNotes} onChange={(event) => setProofNotes(event.target.value)} rows={2} placeholder="Catatan kondisi / serah terima (opsional)" className="w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm text-zinc-900 placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" />
            {proofFile && <button type="submit" disabled={proofBusy} className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60">{proofBusy ? 'Mengunggah…' : 'Upload bukti'}</button>}
          </form>
        </section>
        {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">{actionError}</p>}

      <footer className="fixed inset-x-0 bottom-0 z-[600] border-t border-stone-200 bg-white/95 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:sticky lg:inset-auto lg:z-auto lg:mx-0 lg:mt-1 lg:w-full lg:rounded-xl lg:border-black/10 lg:bg-white lg:p-4 lg:pb-4 lg:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] lg:backdrop-blur-none">
      <div className="mx-auto grid max-w-3xl grid-cols-[0.9fr_1.4fr_0.9fr] gap-2 lg:hidden">
        {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-sky-700 px-2 text-xs font-bold text-sky-800 hover:bg-sky-50 sm:text-sm"><NavigationArrow size={18} weight="fill" />Rute</a>
          : <button type="button" disabled className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-2 text-xs font-semibold text-stone-500 sm:text-sm"><NavigationArrow size={18} />Rute</button>}
        <button type="button" onClick={() => void doAction()} disabled={!next || actionBusy || Boolean(invoiceBlocked)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-2 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:text-sm">
          {actionBusy ? <span className="animate-pulse">Memperbarui…</span> : invoiceBlocked ? <><WarningCircle size={17} />Invoice belum lunas</> : next ? <><CheckCircle size={17} weight="fill" />{actionLabel}</> : actionLabel}
        </button>
        <button type="button" onClick={() => { setFailureOpen(true); setFailureError(''); }} disabled={!next || actionBusy} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"><WarningCircle size={18} />Gagal</button>
      </div>
      <div className="hidden grid-cols-[0.9fr_1.4fr_0.9fr] gap-2 lg:grid">
        {mapsUrl ? <Button asChild variant="outline" className="h-11 w-full gap-1.5 border-sky-200 px-2 text-xs text-sky-800 hover:bg-sky-50"><a href={mapsUrl} target="_blank" rel="noreferrer"><NavigationArrow weight="fill" />Rute</a></Button>
          : <Button type="button" variant="outline" disabled className="h-11 w-full gap-1.5 px-2 text-xs"><NavigationArrow />Rute</Button>}
        <Button type="button" onClick={() => void doAction()} disabled={!next || actionBusy || Boolean(invoiceBlocked)} className="h-11 w-full gap-2 px-2 text-xs font-bold">
          {actionBusy ? 'Memperbarui…' : invoiceBlocked ? <><WarningCircle size={17} />Invoice belum lunas</> : next ? <><CheckCircle size={17} weight="fill" />{actionLabel}</> : actionLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => { setFailureOpen(true); setFailureError(''); }} disabled={!next || actionBusy} className="h-11 w-full gap-1.5 border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50"><WarningCircle size={18} />Gagal</Button>
      </div>
    </footer>
      </div>
      </div>
    </main>

    {failureOpen && <div className="fixed inset-0 z-[700] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !failureBusy) setFailureOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="failure-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl sm:rounded-3xl sm:p-6 lg:rounded-xl lg:border lg:border-black/10 lg:shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-4"><div><h2 id="failure-title" className="text-lg font-bold text-zinc-950">Laporkan kendala</h2><p className="mt-1 text-sm text-stone-600">Pilih alasan agar riwayat tugas tercatat dengan jelas.</p></div><button type="button" aria-label="Tutup form" disabled={failureBusy} onClick={() => setFailureOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-stone-100 disabled:opacity-50"><X size={19} /></button></div>
        <form onSubmit={submitFailure} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-800">Alasan gagal
            <select value={failureReason} onChange={(event) => { setFailureReason(event.target.value); setFailureError(''); }} className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
              <option value="">Pilih alasan</option>{failureReasons.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-800">Catatan{failureReason === 'OTHER' ? ' (wajib)' : ' (opsional)'}
            <textarea value={failureNotes} onChange={(event) => setFailureNotes(event.target.value)} rows={3} required={failureReason === 'OTHER'} placeholder={failureReason === 'OTHER' ? 'Jelaskan kendala yang terjadi' : 'Tambahkan konteks bila diperlukan'} className="resize-y rounded-xl border border-stone-300 p-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" />
          </label>
          {failureError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{failureError}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" disabled={failureBusy} onClick={() => setFailureOpen(false)} className="min-h-12 rounded-xl border border-stone-300 px-4 text-sm font-bold text-zinc-800 hover:bg-stone-50 disabled:opacity-60">Batal</button>
            <button type="submit" disabled={!canSendFailure || failureBusy} className="min-h-12 rounded-xl bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600">{failureBusy ? 'Mengirim…' : 'Kirim'}</button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}

function LocationBlock({ title, name, address, icon, routeSummary }: { title: string; name: string; address?: string | null; icon: 'pickup' | 'destination'; routeSummary?: string }) {
  return <div className="flex gap-3 px-4 py-3.5 sm:px-5">
    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${icon === 'pickup' ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-800'}`}><MapPin size={18} weight="fill" /></span>
    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p><p className="mt-0.5 truncate text-sm font-bold text-zinc-950">{name || 'Belum tersedia'}</p><p className="mt-1 text-sm leading-5 text-stone-700">{address || 'Belum tersedia'}</p>{routeSummary && <p className="mt-2 text-xs font-semibold text-sky-800">Rute ke tujuan · {routeSummary}</p>}</div>
  </div>;
}
