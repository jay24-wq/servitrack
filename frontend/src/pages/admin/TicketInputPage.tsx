import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlass,
  ArrowRight,
  ArrowLeft,
  Check,
  WarningCircle,
  Plus,
  Laptop,
  DeviceMobileCamera,
  GameController,
  DesktopTower,
  Thermometer,
  Power,
  Monitor,
  BatteryEmpty,
  Drop,
  UploadSimple,
  Printer,
  WhatsappLogo,
  QrCode,
  UserCirclePlus,
  Ticket,
  Clock,
  Barcode,
  Info,
  XCircle,
} from '@phosphor-icons/react';

import { TrackingCode } from '../../components/admin/TrackingCode';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { UserAvatar } from '../../components/ui/user-avatar';
import { cn } from '../../lib/utils';
import { initialsOf } from '../../lib/avatar';
import { invoiceFromTicket } from '../../lib/ticket-code';
import { formatRupiah } from '../../lib/ongkir';
import { useTicketStore, type QueueTicket } from '../../store';
import { createTicket, getBookings, updateBooking, type CreateTicketPayload } from '../../lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mapBookingRow, type BookingRow } from '../../lib/mappers';

type Kategori = 'laptop' | 'smartphone' | 'console' | 'workstation';

const KATEGORI_LIST: { value: Kategori; label: string; icon: React.ReactNode }[] = [
  { value: 'laptop', label: 'Laptop', icon: <Laptop size={22} /> },
  { value: 'smartphone', label: 'Smartphone', icon: <DeviceMobileCamera size={22} /> },
  { value: 'console', label: 'Konsol', icon: <GameController size={22} /> },
  { value: 'workstation', label: 'PC / Build', icon: <DesktopTower size={22} /> },
];

const GEJALA_LIST = [
  { value: 'overheat', label: 'Thermal Overheat', icon: <Thermometer size={12} weight="fill" /> },
  { value: 'mati_total', label: 'Mati Total / Short', icon: <Power size={12} weight="fill" /> },
  { value: 'layar', label: 'Kerusakan Layar / Flexgate', icon: <Monitor size={12} weight="fill" /> },
  { value: 'baterai', label: 'Baterai Drop / Kembung', icon: <BatteryEmpty size={12} weight="fill" /> },
  { value: 'air', label: 'Terkena Air / Liquid Spill', icon: <Drop size={12} weight="fill" /> },
];

const HANDOVER_FROM_METHOD = {
  mandiri: 'Drop-off',
  antar_jemput: 'Antar-Jemput',
  terjadwal: 'Pick-up',
} as const;

function angka(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

function stempelWaktu() {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function tambahMenit(menit: number) {
  const target = new Date(Date.now() + menit * 60_000);
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(target);
}

function normalisasiWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  if (digits.startsWith('62')) return `+62${digits.slice(2)}`;
  return `+62${digits}`;
}

export default function TicketInputPage() {
  const [searchParams] = useSearchParams();
  const modeScan = searchParams.get('mode') === 'scan';
  const bookingParam = searchParams.get('booking');

  const tickets = useTicketStore((s) => s.tickets);
  const tambahTiket = useTicketStore((s) => s.tambahTiket);
  const kuotaTerpakai = useTicketStore((s) => s.kuotaTerpakai);
  const kuotaBulanan = useTicketStore((s) => s.kuotaBulanan);

  const [cari, setCari] = useState('');
  const { data: bookingsRaw = [] } = useQuery<any[]>({
    queryKey: ['bookings'],
    queryFn: getBookings,
    refetchInterval: 15000,
  });
  const bookings: BookingRow[] = useMemo(() => bookingsRaw.map(mapBookingRow), [bookingsRaw]);
  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const pending = bookings.filter((booking) => booking.status === 'MENUNGGU_CHECKIN');
    if (!q) return pending;
    const digits = q.replace(/\D/g, '');
      return pending.filter((booking) => {
      const haystack = `${booking.name} ${booking.whatsapp} ${booking.code} ${booking.trackingCode ?? ''} ${booking.queueNumber ?? ''} ${
        booking.device?.model ?? ''
      } ${booking.device?.serial ?? ''}`.toLowerCase();
      return haystack.includes(q) || (digits.length >= 3 && booking.whatsapp.replace(/\D/g, '').includes(digits));
    });
  }, [bookings, cari]);

  const [step, setStep] = useState(1);
  const [terpilih, setTerpilih] = useState<BookingRow | null>(null);

  const [kategori, setKategori] = useState<Kategori>('laptop');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [pin, setPin] = useState('');
  const [pinRefused, setPinRefused] = useState(false);
  const [gejala, setGejala] = useState<string[]>([]);
  const [kronologi, setKronologi] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [nama, setNama] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [estimasiJasa, setEstimasiJasa] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasil, setHasil] = useState<{
    ticket: QueueTicket;
    invoice: string;
    booking?: BookingRow;
    trackingCode?: string;
  } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorSimpan, setErrorSimpan] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [membatalkan, setMembatalkan] = useState<string | null>(null);
  const [errorBooking, setErrorBooking] = useState('');
  const queryClient = useQueryClient();

  const serialRef = useRef<HTMLInputElement>(null);
  const autoBookingApplied = useRef(false);
  const kuotaPenuh = kuotaTerpakai >= kuotaBulanan;

  useEffect(() => {
    if (!bookingParam || autoBookingApplied.current) return;
    const target = bookings.find((booking) => booking.id === bookingParam);
    if (target && target.status === 'MENUNGGU_CHECKIN') {
      autoBookingApplied.current = true;
      pilihBooking(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingParam, bookings]);

  useEffect(() => {
    if (step === 2) serialRef.current?.focus();
  }, [step]);

  const serialTerpakai = useMemo(
    () => tickets.map((ticket) => ticket.serial?.toLowerCase()).filter(Boolean) as string[],
    [tickets]
  );

  function pilihBooking(booking: BookingRow) {
    setTerpilih(booking);
    setNama(booking.name);
    setWhatsapp(booking.whatsapp.replace(/^\+62/, ''));
    setKategori(booking.device?.category ?? 'laptop');
    setModel(booking.device?.model ?? '');
    setSerial(booking.device?.serial ?? '');
    setPin('');
    setPinRefused(false);
    setGejala(booking.device?.symptoms ?? []);
    setKronologi(booking.complaint ?? '');
    setFiles([]);
    setErrors({});
    setStep(2);
  }

  async function batalkanBooking(booking: BookingRow) {
    if (!window.confirm(`Batalkan booking ${booking.code} atas nama ${booking.name}?`)) return;

    setErrorBooking('');
    setMembatalkan(booking.id);
    try {
      await updateBooking(booking.id, { status: 'cancelled' });
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (detailId === booking.id) setDetailId(null);
    } catch (error: any) {
      setErrorBooking(error?.response?.data?.error || error?.message || 'Gagal membatalkan booking. Coba lagi.');
    } finally {
      setMembatalkan(null);
    }
  }

  const toggleGejala = (value: string) =>
    setGejala((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const daftar = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...daftar]);
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, item) => item !== index));

  const waDigits = whatsapp.replace(/\D/g, '');
  const waValid = waDigits.length >= 10 && waDigits.length <= 15;

  const cekForm = () => {
    const baru: Record<string, string> = {};
    if (nama.trim().length < 3) baru.nama = 'Nama pemilik minimal 3 karakter.';
    if (!waValid) baru.whatsapp = 'Nomor WhatsApp harus 10–15 digit.';
    if (model.trim().length < 2) baru.model = 'Merk & model perangkat wajib diisi.';
    if (serial.trim().length < 3) baru.serial = 'Nomor seri wajib diisi.';
    if (serialTerpakai.includes(serial.trim().toLowerCase())) {
      baru.serial = 'Nomor seri ini sudah punya tiket aktif — periksa tiket lama sebelum membuat baru.';
    }
    if (gejala.length === 0) baru.gejala = 'Pilih minimal satu kategori gejala.';
    if (kronologi.trim().length < 20) baru.kronologi = 'Kronologi minimal 20 karakter.';
    if (pin.trim().length < 4 && !pinRefused) baru.pin = 'Isi PIN atau centang “pelanggan menolak memberi PIN”.';
    return baru;
  };

  const simpan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (kuotaPenuh || menyimpan) return;
    const baru = cekForm();
    setErrors(baru);
    if (Object.keys(baru).length > 0) return;

    const slaMenit = 120;
    const labelGejala = gejala
      .map((value) => GEJALA_LIST.find((item) => item.value === value)?.label ?? value)
      .join(' · ');

    const payload: CreateTicketPayload = {
      branch_id: terpilih?.raw?.branch_id ?? undefined,
      booking_id: terpilih?.id,
      customer_id: terpilih?.raw?.customer_id ?? undefined,
      device_id: terpilih?.raw?.device_id ?? undefined,
      service_method: terpilih?.raw?.service_method ?? 'dropoff',
      complaint: `${labelGejala} — ${kronologi.trim()}`,
      customer_name: nama.trim(),
      customer_phone: normalisasiWhatsapp(whatsapp),
      device_category: kategori,
      device_brand: terpilih?.device?.brand || model.trim().split(' ')[0] || model.trim(),
      device_model: model.trim(),
      device_serial: serial.trim(),
      initial_estimate_cost: estimasiJasa.trim() ? Number(estimasiJasa.replace(/\D/g, '')) : null,
    };

    setErrorSimpan('');
    setMenyimpan(true);
    try {
      const tiketDb = await createTicket(payload);
      const kode = String(tiketDb?.ticket_code ?? '');
      const assignedTechnician = String(tiketDb?.technician_name ?? '').trim();
      const assignedInitials = assignedTechnician
        ? assignedTechnician
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
        : '?';

      const tiket: QueueTicket = {
        id: kode,
        time: `${stempelWaktu()} WIB`,
        customer: nama.trim(),
        phone: normalisasiWhatsapp(whatsapp),
        handover: terpilih ? HANDOVER_FROM_METHOD[terpilih.method] : 'Drop-off',
        device: model.trim(),
        diagnosis: `${labelGejala} — ${kronologi.trim().slice(0, 60)}`,
        technician: assignedTechnician || 'Belum ditugaskan',
        technicianInitials: assignedInitials,
        status: 'Antrian',
        slaPrimary: `SLA: ${slaMenit} menit berjalan`,
        slaTone: 'text-amber-500',
        slaSecondary: `Batas SLA: ${tambahMenit(slaMenit)} WIB`,
        serial: serial.trim(),
      };

      tambahTiket(tiket);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setHasil({
        ticket: tiket,
        invoice: invoiceFromTicket(kode),
        booking: terpilih ?? undefined,
        trackingCode: String(tiketDb?.tracking_code ?? terpilih?.trackingCode ?? ''),
      });
    } catch (error: any) {
      setErrorSimpan(error?.response?.data?.error || error?.message || 'Gagal menyimpan tiket. Coba lagi.');
    } finally {
      setMenyimpan(false);
    }
  };

  const resetForm = () => {
    setHasil(null);
    setStep(1);
    setCari('');
    setTerpilih(null);
    setKategori('laptop');
    setModel('');
    setSerial('');
    setPin('');
    setPinRefused(false);
    setGejala([]);
    setKronologi('');
    setFiles([]);
    setNama('');
    setWhatsapp('');
    setEstimasiJasa('');
    setErrors({});
    setErrorSimpan('');
    setDetailId(null);
    setErrorBooking('');
  };

  if (hasil) {
    const jasa = Number(estimasiJasa.replace(/\D/g, '')) || 0;
    return (
      <div className="page-enter flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Check weight="bold" className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-6 text-neutral-900">Tiket {hasil.ticket.id} berhasil dibuat</h1>
              <p className="text-xs leading-5 text-stone-600">
                {hasil.booking ? `Booking ${hasil.booking.code} ditandai check-in. ` : 'Tiket walk-in dibuat tanpa booking. '}
                Unit {hasil.ticket.device} masuk antrean dengan status Antrian
                {hasil.ticket.technician !== 'Belum ditugaskan'
                  ? ` dan otomatis ditugaskan ke ${hasil.ticket.technician}.`
                  : '. Belum ada teknisi aktif untuk ditugaskan.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-auto px-3 py-2 text-xs" onClick={() => window.print()}>
              <Printer weight="bold" className="size-3.5" /> Cetak nota
            </Button>
            <Button variant="outline" size="sm" className="h-auto px-3 py-2 text-xs" asChild>
              <a href="#">
                <WhatsappLogo weight="fill" className="size-3.5 text-emerald-600" /> Kirim nota WA
              </a>
            </Button>
            <Button size="sm" className="h-auto px-3 py-2 text-xs" asChild>
              <Link to="/queue">
                <Ticket weight="fill" className="size-3.5" /> Buka di antrean
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl rounded-xl border border-black/10 bg-white p-6">
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-stone-300 pb-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="ServiTrack" className="size-8 object-contain" />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-5 text-neutral-900">ServiTrack Workshop</span>
                <span className="block text-[11px] leading-4 text-stone-500">Jl. Radio Dalam Raya No. 42, Jakarta Selatan</span>
              </span>
            </div>
            <div className="text-right">
              <span className="block font-mono text-xs font-bold text-neutral-900">{hasil.ticket.id}</span>
              <span className="block text-[11px] leading-4 text-stone-500">{hasil.invoice}</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed border-stone-300 py-4 text-xs">
            <div>
              <dt className="text-stone-500">Waktu check-in</dt>
              <dd className="font-semibold tabular-nums text-neutral-900">{hasil.ticket.time}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Sumber unit</dt>
              <dd className="text-neutral-900">
                {hasil.booking ? `Booking ${hasil.booking.code}` : 'Walk-in tanpa booking'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Pemilik</dt>
              <dd className="font-semibold text-neutral-900">{hasil.ticket.customer}</dd>
            </div>
            <div>
              <dt className="text-stone-500">WhatsApp</dt>
              <dd className="font-mono text-neutral-900">{hasil.ticket.phone}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Perangkat</dt>
              <dd className="text-neutral-900">{KATEGORI_LIST.find((item) => item.value === kategori)?.label} · {hasil.ticket.device}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Nomor seri</dt>
              <dd className="font-mono text-neutral-900">{hasil.ticket.serial}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-stone-500">Nomor resi pelacakan</dt>
              <dd className="font-mono font-semibold text-emerald-700">{hasil.trackingCode || '�?"'}</dd>
            </div>
          </dl>

          <div className="border-b border-dashed border-stone-300 py-4 text-xs">
            <span className="block text-stone-500">Keluhan</span>
            <span className="mt-1 block leading-5 text-neutral-900">{hasil.ticket.diagnosis}</span>
            {files.length > 0 && (
              <span className="mt-2 block text-[11px] text-stone-500">
                Foto kondisi: {files.map((file) => file.name).join(', ')}
              </span>
            )}
          </div>

          <div className="border-b border-dashed border-stone-300 py-4 text-xs">
            <span className="block text-stone-500">PIN perangkat</span>
            <span className="mt-1 block font-mono text-neutral-900">
              {pinRefused ? '— pelanggan menolak memberi PIN' : pin || '—'}
            </span>
          </div>

          <dl className="flex flex-col gap-1.5 border-b border-dashed border-stone-300 py-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-stone-500">Estimasi jasa awal</dt>
              <dd className="tabular-nums text-neutral-900">Rp {angka(jasa)}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-between gap-3 py-4">
            <span className="flex items-center gap-2 text-xs">
              <Clock weight="fill" className="size-4 text-stone-400" />
              <span>
                <span className="block font-semibold text-neutral-900">{hasil.ticket.slaPrimary}</span>
                <span className="block text-[11px] text-stone-500">
                  {hasil.ticket.slaSecondary}
                </span>
              </span>
            </span>
            <Badge variant="warning">{hasil.ticket.status}</Badge>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-dashed border-stone-300 pt-4">
            <span className="text-[11px] leading-4 text-stone-500">
              Garansi servis 90 hari · biaya final dikonfirmasi setelah diagnosa & approval quotation
            </span>
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-sky-700 print:hidden" onClick={resetForm}>
              Transaksi baru
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-2 text-[11px] leading-4 text-stone-500">
            <QrCode weight="fill" className="size-3.5" /> Nota demo: belum tersambung gateway/WhatsApp — status
            pengiriman dicatat manual oleh frontdesk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-neutral-900">Check-in Servis</h1>
          <p className="mt-0.5 text-xs leading-5 text-stone-600">
            Kelola booking yang menunggu check-in. Proses check-in untuk membuat service ticket, atau buat tiket
            walk-in baru. Tiket baru masuk antrean dengan status{' '}
            <span className="font-semibold text-neutral-900">Antrian</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium tabular-nums text-stone-600">
            <Ticket weight="fill" className="size-3.5 text-stone-500" /> Kuota tiket bulan ini {kuotaTerpakai}/{kuotaBulanan}
          </span>
          <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-2 text-xs font-medium text-stone-600" asChild>
            <Link to="/queue">
              <ArrowLeft weight="bold" className="size-3.5" /> Kembali ke antrean
            </Link>
          </Button>
        </div>
      </div>

      {kuotaPenuh && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <WarningCircle weight="bold" className="size-3.5" />
          </span>
          <p className="text-xs leading-4 text-neutral-700">
            <span className="font-bold text-neutral-900">Kuota 100 tiket/bulan paket Starter sudah tercapai.</span>{' '}
            Upgrade ke Pro untuk melanjutkan pembuatan tiket. Data lama tetap bisa diakses.
          </p>
        </div>
      )}

      {modeScan && step === 2 && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs text-sky-800">
          <Barcode weight="bold" className="size-4" /> Mode scan aktif — pindai barcode perangkat, nomor seri terisi otomatis.
        </div>
      )}

      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {[
          { nomor: 1, label: 'Cari pelanggan' },
          { nomor: 2, label: 'Perangkat & diagnosa' },
        ].map((item, index) => {
          const selesai = item.nomor < step;
          const aktif = item.nomor === step;
          return (
            <li key={item.nomor} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-bold',
                  selesai
                    ? 'bg-sky-600 text-white'
                    : aktif
                      ? 'bg-sky-50 text-sky-700 outline outline-1 outline-sky-300'
                      : 'bg-stone-100 text-stone-400'
                )}
              >
                {selesai ? <Check weight="bold" size={13} /> : item.nomor}
              </span>
              <span className={cn('text-xs font-semibold', aktif ? 'text-neutral-900' : 'text-stone-500')}>
                {item.label}
              </span>
              {index === 0 && <span className="mx-1 hidden h-px w-8 bg-stone-200 sm:block" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-md">
              <MagnifyingGlass weight="bold" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={cari}
                onChange={(event) => setCari(event.target.value)}
                aria-label="Cari nama pelanggan, nomor WhatsApp, kode booking, nomor resi, atau perangkat"
                 placeholder="Cari nama / antrian / kode booking / resi / perangkat"
                className="h-11 rounded-lg border-black/10 bg-stone-50 pl-10 pr-4 text-sm text-neutral-900 caret-sky-600 shadow-none placeholder:text-stone-400 focus-visible:border-sky-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-11 gap-1.5 px-4 text-xs font-medium text-stone-600"
              onClick={() => {
                setTerpilih(null);
                setErrors({});
                setStep(2);
              }}
            >
              <UserCirclePlus weight="bold" className="size-4" /> Buat tiket walk-in baru
            </Button>
          </div>

          <div className="border-t border-black/5 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Pelanggan menunggu check-in</h2>
              <span className="text-[11px] tabular-nums text-stone-500">{hasilCari.length} booking</span>
            </div>
            {errorBooking && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                {errorBooking}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {hasilCari.map((booking) => {
                const detailTerbuka = detailId === booking.id;
                const sedangDibatalkan = membatalkan === booking.id;
                return (
                  <li key={booking.id} className="rounded-lg border border-black/10 bg-white">
                    <div className="flex flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 items-center gap-3 xl:w-64">
                        <UserAvatar
                          seed={booking.whatsapp}
                          initials={initialsOf(booking.name)}
                          alt={`Avatar ${booking.name}`}
                          className="size-9"
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{booking.name}</span>
                          <span className="block truncate font-mono text-[11px] text-stone-500">
                            {booking.code} �� {booking.whatsapp}
                          </span>
                           <TrackingCode code={booking.trackingCode} />
                           {booking.queueNumber && <span className="mt-1 block font-mono text-xs font-bold text-sky-700">Antrian {booking.queueNumber}</span>}
                        </div>
                      </div>
                      <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                        <div>
                          <dt className="text-stone-500">Nomor Antrian</dt>
                          <dd className="mt-0.5 font-mono font-bold text-sky-700">{booking.queueNumber || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">WhatsApp</dt>
                          <dd className="mt-0.5 font-mono text-neutral-900">{booking.whatsapp || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Perangkat</dt>
                          <dd className="mt-0.5 font-medium text-neutral-900">
                            {booking.device?.model || 'Belum dicatat'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Metode</dt>
                          <dd className="mt-0.5 text-neutral-900">
                            {booking.method === 'mandiri'
                              ? 'Datang mandiri'
                              : booking.method === 'antar_jemput'
                                ? 'Antar-Jemput'
                                : 'Terjadwal'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Jadwal</dt>
                          <dd className="mt-0.5 text-neutral-900">{booking.slotDate}</dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <Badge variant="warning">Menunggu Check-in</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700"
                          aria-expanded={detailTerbuka}
                          onClick={() => setDetailId(detailTerbuka ? null : booking.id)}
                        >
                          <Info weight="bold" className="size-3.5" /> Detail Booking
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700"
                          disabled={sedangDibatalkan}
                          onClick={() => batalkanBooking(booking)}
                        >
                          <XCircle weight="bold" className="size-3.5" />
                          {sedangDibatalkan ? 'Membatalkan...' : 'Batalkan Booking'}
                        </Button>
                        <Button
                          size="sm"
                          className="h-auto gap-1.5 px-3 py-1.5 text-xs"
                          onClick={() => pilihBooking(booking)}
                        >
                          Check-in <ArrowRight weight="bold" className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {detailTerbuka && (
                      <div className="border-t border-black/5 bg-stone-50/70 px-3.5 py-4">
                        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <dt className="text-stone-500">Kode booking</dt>
                            <dd className="mt-0.5 font-mono font-semibold text-neutral-900">{booking.code}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Nomor resi</dt>
                            <dd className="mt-0.5 font-mono font-semibold text-neutral-900">
                              {booking.trackingCode || '-'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Slot</dt>
                            <dd className="mt-0.5 text-neutral-900">{booking.slotDate}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Ongkir pickup</dt>
                            <dd className="mt-0.5 text-neutral-900">{formatRupiah(booking.pickupFee)}</dd>
                          </div>
                          {booking.raw.pickup_area && (
                            <div className="sm:col-span-2">
                              <dt className="text-stone-500">Area pickup</dt>
                              <dd className="mt-0.5 text-neutral-900">{booking.raw.pickup_area}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-stone-500">Nama pelanggan</dt>
                            <dd className="mt-0.5 font-semibold text-neutral-900">{booking.name}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">WhatsApp</dt>
                            <dd className="mt-0.5 font-mono text-neutral-900">{booking.whatsapp || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Metode</dt>
                            <dd className="mt-0.5 text-neutral-900">
                              {booking.method === 'mandiri'
                                ? 'Datang mandiri'
                                : booking.method === 'antar_jemput'
                                  ? 'Antar-Jemput'
                                  : 'Penjemputan terjadwal'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Perangkat</dt>
                            <dd className="mt-0.5 text-neutral-900">{booking.device?.model || 'Belum dicatat'}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Nomor seri</dt>
                            <dd className="mt-0.5 font-mono text-neutral-900">{booking.device?.serial || '-'}</dd>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-1">
                            <dt className="text-stone-500">Keluhan</dt>
                            <dd className="mt-0.5 leading-5 text-neutral-900">{booking.complaint || '-'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </li>
                );
              })}
              {hasilCari.length === 0 && (
                <li className="rounded-lg border border-dashed border-stone-300 bg-stone-50/70 px-4 py-8 text-center">
                  <span className="block text-sm font-semibold text-neutral-900">Tidak ada booking yang cocok</span>
                  <span className="mt-1 block text-xs text-stone-500">
                    Periksa ejaan nama/nomor, atau lanjutkan dengan membuat tiket walk-in baru.
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <form onSubmit={simpan} className="grid gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
            {terpilih && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <span className="flex items-center gap-3">
                  <UserAvatar
                    seed={terpilih.whatsapp}
                    initials={initialsOf(terpilih.name)}
                    alt={`Avatar ${terpilih.name}`}
                    className="size-9"
                  />
                  <span>
                    <span className="block text-xs font-bold text-neutral-900">Check-in dari booking {terpilih.code}</span>
                    <span className="block text-[11px] text-stone-600">
                      {terpilih.name} · {terpilih.whatsapp} · {terpilih.slotDate}
                    </span>
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto px-3 py-1.5 text-xs"
                  onClick={() => {
                    setTerpilih(null);
                    setStep(1);
                  }}
                >
                  Ganti pelanggan
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Identitas pemilik</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="nama" className="text-xs font-bold text-neutral-900">
                    Nama lengkap pemilik <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="nama"
                    value={nama}
                    onChange={(event) => setNama(event.target.value)}
                    placeholder="Sesuai kartu identitas"
                    className="h-11 rounded-lg border-black/10 bg-stone-50 text-sm shadow-none focus-visible:border-sky-500"
                  />
                  {errors.nama && <span className="text-[11px] font-medium text-red-600">{errors.nama}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="whatsapp" className="text-xs font-bold text-neutral-900">
                    Nomor WhatsApp aktif <span className="text-red-500">*</span>
                  </label>
                  <span className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-bold text-stone-500">+62</span>
                    <Input
                      id="whatsapp"
                      value={whatsapp}
                      onChange={(event) => setWhatsapp(event.target.value)}
                      placeholder="81234567890"
                      className="h-11 rounded-lg border-black/10 bg-stone-50 pl-12 text-sm shadow-none focus-visible:border-sky-500"
                    />
                  </span>
                  {errors.whatsapp && <span className="text-[11px] font-medium text-red-600">{errors.whatsapp}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Identitas perangkat &amp; diagnosa</h2>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-neutral-900">
                  Kategori perangkat <span className="text-red-500">*</span>
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {KATEGORI_LIST.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setKategori(item.value)}
                      aria-pressed={kategori === item.value}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                        kategori === item.value
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                      )}
                    >
                      {item.icon}
                      <span className="text-xs font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="model" className="text-xs font-bold text-neutral-900">
                  Merk &amp; model lengkap <span className="text-red-500">*</span>
                </label>
                <Input
                  id="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="Contoh: Asus ROG Zephyrus / iPad Pro"
                  className="h-11 rounded-lg border-black/10 bg-stone-50 text-sm shadow-none focus-visible:border-sky-500"
                />
                {errors.model && <span className="text-[11px] font-medium text-red-600">{errors.model}</span>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="serial" className="text-xs font-bold text-neutral-900">
                    Nomor seri / IMEI <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="serial"
                    ref={serialRef}
                    value={serial}
                    onChange={(event) => setSerial(event.target.value)}
                    placeholder="Contoh: G14 2024 / M2"
                    className="h-11 rounded-lg border-black/10 bg-stone-50 font-mono text-sm shadow-none focus-visible:border-sky-500"
                  />
                  <span className="text-[10px] leading-tight text-stone-500">
                    Membantu otentikasi status garansi dan deteksi tiket ganda.
                  </span>
                  {errors.serial && <span className="text-[11px] font-medium text-red-600">{errors.serial}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="pin" className="text-xs font-bold text-neutral-900">
                    PIN / password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="pin"
                    value={pin}
                    disabled={pinRefused}
                    onChange={(event) => setPin(event.target.value)}
                    placeholder="Contoh: 123456"
                    className="h-11 rounded-lg border-black/10 bg-stone-50 text-sm shadow-none focus-visible:border-sky-500"
                  />
                  <label className="flex items-start gap-2 text-[11px] text-stone-600">
                    <input
                      type="checkbox"
                      checked={pinRefused}
                      onChange={(event) => {
                        setPinRefused(event.target.checked);
                        if (event.target.checked) setPin('');
                      }}
                      className="mt-0.5 size-3.5 accent-sky-600"
                    />
                    Pelanggan menolak memberi PIN (pengujian tanpa akses OS)
                  </label>
                  {errors.pin && <span className="text-[11px] font-medium text-red-600">{errors.pin}</span>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-neutral-900">
                  Kategori gejala <span className="text-red-500">*</span>
                </span>
                <span className="-mt-1 text-[11px] text-stone-500">Boleh pilih lebih dari 1.</span>
                <div className="flex flex-wrap gap-2">
                  {GEJALA_LIST.map((item) => {
                    const aktif = gejala.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleGejala(item.value)}
                        aria-pressed={aktif}
                        className={cn(
                          'flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                          aktif
                            ? 'border-sky-300 bg-sky-50 text-sky-700'
                            : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {errors.gejala && <span className="text-[11px] font-medium text-red-600">{errors.gejala}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="kronologi" className="text-xs font-bold text-neutral-900">
                  Kronologi &amp; gejala spesifik <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="kronologi"
                  rows={4}
                  value={kronologi}
                  onChange={(event) => setKronologi(event.target.value.slice(0, 500))}
                  placeholder="Catat keterangan pelanggan apa adanya: sejak kapan, setelah kejadian apa, sudah dicoba apa saja..."
                  className="w-full resize-none rounded-lg border border-black/10 bg-stone-50 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>Minimal 20 karakter.</span>
                  <span className="tabular-nums">{kronologi.length} / 500</span>
                </div>
                {errors.kronologi && <span className="text-[11px] font-medium text-red-600">{errors.kronologi}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-neutral-900">
                  Foto kondisi unit <span className="font-normal text-stone-400">(opsional)</span>
                </span>
                <input type="file" multiple accept="image/*" onChange={onFileChange} className="hidden" id="foto-unit" />
                <label
                  htmlFor="foto-unit"
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 transition hover:bg-stone-100"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
                    <UploadSimple weight="fill" className="size-5" />
                  </span>
                  <span className="text-xs font-bold text-neutral-900">Ambil / unggah foto kondisi di depan pelanggan</span>
                  <span className="text-[11px] text-stone-500">JPG atau PNG, maks. 25MB per file</span>
                </label>
                {files.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex flex-col gap-2">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Pratinjau ${file.name}`}
                          className="h-24 w-full rounded-lg border border-black/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-[11px] font-bold text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          Hapus {file.name.length > 14 ? `${file.name.slice(0, 14)}…` : file.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Estimasi biaya awal</h2>
              <div className="flex flex-col gap-2">
                <label htmlFor="estimasi" className="text-xs font-bold text-neutral-900">Estimasi jasa awal</label>
                <Input
                  id="estimasi"
                  inputMode="numeric"
                  value={estimasiJasa}
                  onChange={(event) => setEstimasiJasa(event.target.value)}
                  placeholder="150000"
                  className="h-11 rounded-lg border-black/10 bg-stone-50 font-mono text-sm tabular-nums shadow-none focus-visible:border-sky-500"
                />
                <span className="text-[10px] text-stone-500">Opsional — biaya final lewat quotation.</span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Ringkasan check-in</h2>
              <dl className="mt-3 flex flex-col gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Pelanggan</dt>
                  <dd className="text-right font-semibold text-neutral-900">{nama.trim() || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">WhatsApp</dt>
                  <dd className="text-right font-mono text-neutral-900">{waValid ? normalisasiWhatsapp(whatsapp) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Sumber</dt>
                  <dd className="text-right text-neutral-900">
                    {terpilih ? `Booking ${terpilih.code}` : 'Walk-in'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Perangkat</dt>
                  <dd className="text-right text-neutral-900">
                    {model.trim() ? model.trim() : '—'}
                    <span className="block text-[11px] text-stone-500">
                      {KATEGORI_LIST.find((item) => item.value === kategori)?.label}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-black/5 pt-2">
                  <dt className="text-stone-500">Status awal</dt>
                  <dd className="text-right">
                    <Badge variant="warning">Antrian</Badge>
                  </dd>
                </div>
              </dl>

              {errorSimpan && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                  {errorSimpan}
                </p>
              )}

              <Button type="submit" className="mt-4 w-full" disabled={kuotaPenuh || menyimpan}>
                {menyimpan ? (
                  <>
                    <Clock weight="bold" className="size-4 animate-spin" /> Menyimpan tiket...
                  </>
                ) : (
                  <>
                    <Plus weight="bold" className="size-4" /> Simpan &amp; buat nota
                  </>
                )}
              </Button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-stone-600" onClick={() => setStep(1)}>
                  <ArrowLeft weight="bold" className="size-3.5" /> Kembali
                </Button>
                <span className="text-[11px] leading-4 text-stone-500">
                  Tercatat oleh Andra Wijaya · frontdesk
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">Kode &amp; nota</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-4 text-stone-600">
                <li>
                  Kode tiket dibuat otomatis <span className="font-mono font-semibold text-neutral-900">SRV</span> + 10
                  digit acak (tidak berpola tanggal, aman dipublikasikan untuk tracking).
                </li>
                <li>
                  Nomor nota memakai 10 digit yang sama:{' '}
                  <span className="font-mono font-semibold text-neutral-900">INV</span> + digit tiketnya.
                </li>
                <li>Garansi servis 90 hari berlaku setelah pembayaran &amp; serah terima unit.</li>
              </ul>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
