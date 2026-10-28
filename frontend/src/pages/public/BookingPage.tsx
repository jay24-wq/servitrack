import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  SealCheck,
  LockKey,
  LockSimpleOpen,
  MapPin,
  CalendarBlank,
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
  Truck,
  ClockCountdown,
  Storefront,
  ShieldCheck,
  CalendarCheck,
  DoorOpen,
  Headset,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  WarningCircle,
} from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { useBookingStore, type HandoverMethod } from '../../store';
import { STORE_LOCATION, hitungOngkir, formatRupiah } from '../../lib/ongkir';
import { getDrivingRoute, type DrivingRoute } from '../../lib/routing';
import { usePublicBooking } from '../../hooks/usePublicBooking';
import { TENANT_SLUG } from '../../lib/api';
import PickupLocationPicker, { type PickupLocation } from '../../components/public/PickupLocationPicker';

const gejalaList = [
  { value: 'overheat', label: 'Thermal Overheat', icon: <Thermometer size={12} weight="fill" /> },
  { value: 'mati_total', label: 'Mati Total / Short', icon: <Power size={12} weight="fill" /> },
  { value: 'layar', label: 'Kerusakan Layar / Flexgate', icon: <Monitor size={12} weight="fill" /> },
  { value: 'baterai', label: 'Baterai Drop / Kembung', icon: <BatteryEmpty size={12} weight="fill" /> },
  { value: 'air', label: 'Terkena Air / Liquid Spill', icon: <Drop size={12} weight="fill" /> },
];

const kategoriList = [
  { value: 'laptop', label: 'Laptop', icon: <Laptop size={22} /> },
  { value: 'smartphone', label: 'Smartphone', icon: <DeviceMobileCamera size={22} /> },
  { value: 'console', label: 'Konsol', icon: <GameController size={22} /> },
  { value: 'workstation', label: 'PC / Build', icon: <DesktopTower size={22} /> },
] as const;

type Kategori = (typeof kategoriList)[number]['value'];

const metodeList: { value: HandoverMethod; title: string; icon: React.ReactNode; desc: string; foot: string; footIcon: React.ReactNode }[] = [
  {
    value: 'antar_jemput',
    title: 'Antar-Jemput',
    icon: <Truck className="text-sky-600" size={18} weight="bold" />,
    desc: 'Kurir kami menjemput perangkat Anda, lalu mengantarkannya kembali setelah selesai.',
    foot: 'Asuransi transit s/d Rp 35 Jt',
    footIcon: <ShieldCheck size={12} weight="fill" />,
  },
  {
    value: 'terjadwal',
    title: 'Penjemputan Terjadwal',
    icon: <ClockCountdown size={18} weight="bold" />,
    desc: 'Tentukan sendiri jam penjemputan yang paling nyaman untuk Anda.',
    foot: 'Kompensasi tepat waktu',
    footIcon: <CalendarCheck size={12} weight="fill" />,
  },
  {
    value: 'mandiri',
    title: 'Datang Mandiri ke Lab',
    icon: <Storefront size={18} weight="bold" />,
    desc: 'Datang ke outlet, perangkat & diagnosa dicatat petugas saat Anda tiba.',
    foot: 'Resepsi 08:30 - 20:00 WIB',
    footIcon: <DoorOpen size={12} weight="fill" />,
  },
];

function normalisasiWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  if (digits.startsWith('62')) return `+62${digits.slice(2)}`;
  return `+62${digits}`;
}

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [kategori, setKategori] = useState<Kategori>('laptop');
  const [gejala, setGejala] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<HandoverMethod>('antar_jemput');
  const [kronologi, setKronologi] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [nama, setNama] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [pin, setPin] = useState('');
  const [pinRefused, setPinRefused] = useState(false);
  const [waktu, setWaktu] = useState('');
  const [pickupLocation, setPickupLocation] = useState<PickupLocation | null>(null);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [instruksi, setInstruksi] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sisaDetik, setSisaDetik] = useState(15 * 60);
  const [bookingSelesai, setBookingSelesai] = useState<{ trackingCode: string; queueNumber?: string | null; name: string; method: HandoverMethod } | null>(null);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedDate = useBookingStore((s) => s.selectedDate);
  const setPreserveOnExit = useBookingStore((s) => s.setPreserveOnExit);
  const navigate = useNavigate();
  const bookingMutation = usePublicBooking();

  const ubahTanggal = () => {
    setPreserveOnExit(true);
    navigate('/kapasitas');
  };

  const dateObj = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.iso.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : null;
  const jadwalLabel = dateObj?.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const bulanBadge = dateObj?.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '').toUpperCase();

  useEffect(() => {
    if (!selectedDate) return;
    const id = setInterval(() => setSisaDetik((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const lockActive = Boolean(selectedDate) && sisaDetik > 0;
  const sisaWaktu = `${String(Math.floor(sisaDetik / 60)).padStart(2, '0')}:${String(sisaDetik % 60).padStart(2, '0')}`;

  const waDigits = whatsapp.replace(/\D/g, '');
  const waValid = waDigits.length >= 10 && waDigits.length <= 15;
  const mandiri = delivery === 'mandiri';

  useEffect(() => {
    let active = true;
    if (!pickupLocation) { setDrivingRoute(null); return () => { active = false; }; }
    setDrivingRoute(null);
    void getDrivingRoute(pickupLocation.latitude, pickupLocation.longitude).then((route) => {
      if (active) setDrivingRoute(route);
    });
    return () => { active = false; };
  }, [pickupLocation]);

  const distanceKm = drivingRoute?.distanceKm ?? 0;
  const ongkirVal = mandiri || !drivingRoute ? 0 : hitungOngkir(distanceKm);

  const locationValid = mandiri || Boolean(pickupLocation);
  const routeReady = mandiri || Boolean(drivingRoute);

  const step1Valid = Boolean(selectedDate);
  const step2Valid = nama.trim().length >= 3 && waValid && (mandiri || (Boolean(waktu) && locationValid && routeReady));
  const step3Valid =
    mandiri ||
    (model.trim().length >= 2 &&
      serial.trim().length >= 3 &&
      gejala.length > 0 &&
      kronologi.trim().length >= 20 &&
      (pin.trim().length >= 4 || pinRefused));
  const semuaValid = step1Valid && step2Valid && step3Valid;

  const punyaDataPerangkat =
    model.trim() !== '' ||
    serial.trim() !== '' ||
    pin.trim() !== '' ||
    gejala.length > 0 ||
    kronologi.trim() !== '' ||
    files.length > 0;

  const toggleGejala = (value: string) =>
    setGejala((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const daftar = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...daftar]);
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const pilihMetode = (value: HandoverMethod) => {
    if (!mandiri && value === 'mandiri' && punyaDataPerangkat) {
      const lanjut = window.confirm(
        'Data perangkat & diagnosa akan dibuang karena metode berubah ke Datang Mandiri. Lanjutkan?'
      );
      if (!lanjut) return;
      setKategori('laptop');
      setGejala([]);
      setKronologi('');
      setFiles([]);
      setModel('');
      setSerial('');
      setPin('');
      setPinRefused(false);
       setPickupLocation(null);
    }
    setDelivery(value);
    if (value === 'mandiri' && step > 2) setStep(2);
  };

  const lanjut = (target: number) => {
    const baru: Record<string, string> = {};
    if (target > 1 && !step1Valid) baru.jadwal = 'Pilih jadwal reservasi terlebih dahulu.';
    if (target > 2) {
      if (nama.trim().length < 3) baru.nama = 'Nama pemilik minimal 3 karakter.';
      if (!waValid) baru.whatsapp = 'Nomor WhatsApp harus 10–15 digit.';
      if (!mandiri && !waktu) baru.waktu = 'Pilih jam penjemputan.';
       if (!mandiri && !pickupLocation) baru.region = 'Gunakan lokasi saat ini atau pilih titik alamat di peta.';
       else if (!mandiri && !routeReady) baru.region = 'Menghitung rute jalan, tunggu sebentar.';
    }
    setErrors(baru);
    if (Object.keys(baru).length === 0) setStep(target);
  };

  const kirimBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || bookingMutation.isPending) return;
    const baru: Record<string, string> = {};
    if (!step1Valid) baru.jadwal = 'Pilih jadwal reservasi terlebih dahulu.';
    if (nama.trim().length < 3) baru.nama = 'Nama pemilik minimal 3 karakter.';
    if (!waValid) baru.whatsapp = 'Nomor WhatsApp harus 10-15 digit.';
    if (!mandiri && !waktu) baru.waktu = 'Pilih jam penjemputan.';
    if (!mandiri && !pickupLocation) baru.region = 'Gunakan lokasi saat ini atau pilih titik alamat di peta.';
    else if (!mandiri && !routeReady) baru.region = 'Menghitung rute jalan, tunggu sebentar.';
    if (!mandiri) {
      if (model.trim().length < 2) baru.model = 'Merk & model perangkat wajib diisi.';
      if (serial.trim().length < 3) baru.serial = 'Nomor seri wajib diisi.';
      if (gejala.length === 0) baru.gejala = 'Pilih minimal satu kategori gejala.';
      if (kronologi.trim().length < 20) baru.kronologi = 'Kronologi minimal 20 karakter.';
      if (pin.trim().length < 4 && !pinRefused) baru.pin = 'Isi PIN atau centang "pelanggan menolak memberi PIN".';
    }
    setErrors(baru);
    if (Object.keys(baru).length > 0) {
      setStep(!step1Valid ? 1 : !step2Valid ? 2 : 3);
      return;
    }

    setSubmitting(true);
    try {
      const res = await bookingMutation.mutateAsync({
        slug: TENANT_SLUG,
        name: nama.trim(),
        phone_wa: normalisasiWhatsapp(whatsapp),
        category: mandiri ? undefined : kategori,
        brand: mandiri ? undefined : model.trim().split(' ')[0] || model.trim(),
        model: mandiri ? undefined : model.trim(),
        serial_number: mandiri ? undefined : serial.trim() || undefined,
        complaint: mandiri ? undefined : kronologi.trim(),
        symptoms: mandiri ? undefined : gejala,
        service_method: delivery,
        slot_date: selectedDate?.iso,
        pickup_time: mandiri ? undefined : waktu,
         pickup_address: mandiri ? undefined : pickupLocation?.address,
         pickup_latitude: mandiri ? undefined : pickupLocation?.latitude,
         pickup_longitude: mandiri ? undefined : pickupLocation?.longitude,
         pickup_area: mandiri ? undefined : pickupLocation?.area,
      });
      setBookingSelesai({ trackingCode: res.tracking_code, queueNumber: res.queue_number, name: nama.trim(), method: delivery });
    } catch (err: any) {
      setErrors({ submit: err?.response?.data?.error ?? 'Gagal membuat booking. Coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = mandiri
    ? [
        { nomor: 1, label: 'Jadwal reservasi' },
        { nomor: 2, label: 'Metode & data kontak' },
      ]
    : [
        { nomor: 1, label: 'Jadwal reservasi' },
        { nomor: 2, label: 'Metode & data kontak' },
        { nomor: 3, label: 'Perangkat & diagnosa' },
      ];

  if (bookingSelesai) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="flex flex-col items-center pt-20 pb-16">
          <section className="w-full max-w-3xl px-4 md:px-8 py-16 page-enter">
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <SealCheck weight="fill" size={28} />
              </span>
              <div>
                 <h1 className="text-2xl font-bold text-neutral-900">Booking Berhasil Dibuat</h1>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {bookingSelesai.method === 'mandiri'
                    ? 'Simpan nomor resi ini. Tunjukkan di resepsionis (08:30-20:00 WIB) agar petugas mencatat identitas perangkat dan keluhan Anda.'
                    : 'Kurir kami akan menjemput perangkat sesuai jadwal. Nomor resi ini juga dikirim ke WhatsApp Anda.'}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-4">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">
                  Nomor Resi
                </span>
                <span className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-bold tracking-wider text-neutral-900">
                  {bookingSelesai.trackingCode}
                  </span>
                  <button
                    type="button"
                    aria-label="Salin nomor resi"
                    title="Salin nomor resi"
                    onClick={() => {
                      navigator.clipboard.writeText(bookingSelesai.trackingCode).then(() => {
                        setTrackingCopied(true);
                        window.setTimeout(() => setTrackingCopied(false), 1500);
                      }).catch(() => setTrackingCopied(false));
                    }}
                    className="rounded-md p-1.5 text-stone-500 transition hover:bg-white hover:text-sky-600"
                  >
                    {trackingCopied ? <Check size={16} weight="bold" className="text-emerald-600" /> : <Copy size={16} weight="bold" />}
                  </button>
                </span>
              </div>
              {bookingSelesai.queueNumber && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-4">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">Nomor Antrian</span>
                  <span className="block font-mono text-2xl font-bold tracking-wider text-sky-900">{bookingSelesai.queueNumber}</span>
                </div>
              )}
              <Link
                to={`/tracking?resi=${encodeURIComponent(bookingSelesai.trackingCode)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Lacak Status Servis
              </Link>
              <dl className="grid w-full gap-3 border-t border-black/5 pt-5 text-left text-xs sm:grid-cols-2">
                <div>
                   <dt className="text-stone-500">Tanggal Booking</dt>
                  <dd className="font-semibold text-neutral-900">{jadwalLabel ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Metode penyerahan</dt>
                  <dd className="font-semibold text-neutral-900">
                    {delivery === 'antar_jemput' ? 'Antar-Jemput' : delivery === 'terjadwal' ? 'Penjemputan Terjadwal' : 'Datang Mandiri ke Lab'}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Estimasi diagnosa</dt>
                  <dd className="text-neutral-900">120 menit pasca unit diterima</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Garansi servis</dt>
                  <dd className="text-neutral-900">90 hari</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
                >
                  Booking lagi
                </button>
                <Link
                  to="/"
                  className="rounded-xl border border-stone-200 px-6 py-3 text-sm font-bold text-neutral-900 transition hover:bg-stone-50"
                >
                  Kembali ke beranda
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full min-h-screen pb-16 flex flex-col items-center pt-20 bg-white">
        <section className="w-full bg-stone-100 py-8 px-4 md:px-8 border-b border-black/5 flex justify-center page-enter">
          <div className="w-full max-w-7xl px-4 md:px-8 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a href="/" className="text-stone-500 hover:text-stone-800 transition">Beranda</a>
              <span className="text-stone-300">/</span>
              <span className="text-stone-600 font-medium">Booking Servis</span>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="flex flex-col gap-3 max-w-3xl">
                <div className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full w-max text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 bg-sky-600 rounded-full animate-pulse"></span>
                  Penerimaan Unit Terstandarisasi Lab ESD Class 100
                </div>
                <h1 className="text-black text-3xl md:text-5xl font-bold leading-tight">Formulir Reservasi Servis Terjadwal</h1>
                <p className="text-stone-500 text-sm md:text-base leading-relaxed">
                  Pilih jadwal kedatangan dulu. Setelah itu lengkapi metode penyerahan dan — untuk penjemputan kurir —
                  data perangkat serta gejalanya.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-white border border-stone-200 rounded-full flex justify-center items-center text-sky-600 shadow-sm">
                  <SealCheck weight="fill" />
                </div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-bold">ESD Safe & Cleanroom 100</span>
                  <span className="text-stone-500 text-xs font-medium">Prosedur ISO 9001:2015</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`w-full py-3 flex justify-center border-b transition-colors ${lockActive ? 'bg-sky-100 border-sky-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="w-full max-w-7xl px-4 md:px-8 flex justify-center">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className={`w-8 h-8 rounded-full shadow-sm flex justify-center items-center text-sm shrink-0 ${lockActive ? 'bg-white text-sky-600' : 'bg-amber-100 text-amber-700'}`}>
                {lockActive ? <LockKey size={14} weight="bold" /> : <LockSimpleOpen size={14} weight="bold" />}
              </div>
              <div className="text-sm">
                {lockActive ? (
                  <>
                    <span className="text-sky-700 font-bold">Slot meja lab dikunci sementara:</span>
                    <span className="text-neutral-900 font-medium"> sisa waktu </span>
                    <span className="px-2 py-0.5 bg-white rounded shadow-sm text-sky-700 font-mono font-bold tracking-widest mx-1">{sisaWaktu}</span>
                    <span className="text-neutral-900 font-medium">menit. Kuota aman.</span>
                  </>
                ) : selectedDate ? (
                  <button type="button" onClick={() => setSisaDetik(15 * 60)} className="text-amber-800 font-medium hover:underline inline-flex items-center gap-1.5">
                    <LockKey size={14} weight="bold" /> Masa tahan slot berakhir. Klik untuk mengunci slot lagi (15 menit).
                  </button>
                ) : (
                  <span className="text-amber-800 font-medium inline-flex items-center gap-1.5">
                    Pilih jadwal reservasi dulu untuk mengunci slot meja lab.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-7xl px-4 md:px-8 pt-8 relative">
          <ol className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            {steps.map((item, index) => {
              const selesai = item.nomor < step;
              const aktif = item.nomor === step;
              return (
                <li key={item.nomor} className="flex items-center gap-2">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                      selesai
                        ? 'bg-sky-600 text-white'
                        : aktif
                          ? 'bg-sky-50 text-sky-700 outline outline-1 outline-sky-300'
                          : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {selesai ? <Check weight="bold" size={13} /> : item.nomor}
                  </span>
                  <span className={`text-xs font-semibold ${aktif ? 'text-neutral-900' : 'text-stone-500'}`}>{item.label}</span>
                  {index < steps.length - 1 && <span className="mx-1 hidden h-px w-8 bg-stone-200 sm:block" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          <form onSubmit={kirimBooking} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-8">
              {/* SECTION A: JADWAL */}
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-200 flex flex-col gap-6 reveal-up">
                <div className="flex justify-between items-start md:items-center pb-4 border-b border-stone-100 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-100 text-sky-700 text-lg font-bold rounded-xl flex justify-center items-center shrink-0">A</div>
                    <div>
                      <h2 className="text-neutral-900 text-lg font-bold">Jadwal Reservasi & Alokasi Sesi</h2>
                      <p className="text-stone-500 text-xs mt-1">Langkah 1 — pilih jendela waktu kedatangan unit di meja diagnosa awal</p>
                    </div>
                  </div>
                  {selectedDate && (
                    <button type="button" onClick={ubahTanggal} className="text-sky-700 text-sm font-bold flex items-center gap-1.5 hover:text-sky-800 transition">
                      <CalendarBlank weight="bold" /> <span className="hidden sm:inline">Ubah tanggal</span>
                    </button>
                  )}
                </div>

                {selectedDate ? (
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white border border-stone-200 rounded-xl shadow-sm flex flex-col justify-center items-center shrink-0">
                        <span className="text-sky-700 text-[10px] font-bold uppercase">{bulanBadge}</span>
                        <span className="text-neutral-900 text-lg font-bold leading-tight">{dateObj?.getDate()}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-neutral-900 text-sm font-bold capitalize">{jadwalLabel}</h3>
                        <p className="text-stone-500 text-xs flex items-center gap-1.5">
                          <MapPin className="text-sky-600" size={14} weight="fill" /> {STORE_LOCATION.name}, {STORE_LOCATION.address}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white border border-stone-200 rounded-full shadow-sm text-sky-600 text-[11px] font-bold">
                      {selectedDate.slots} Slot Ideal Tersedia
                    </div>
                  </div>
                ) : (
                  <Link to="/kapasitas" className="p-6 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center gap-3 text-center hover:border-sky-400 hover:bg-sky-50/50 transition group">
                    <div className="w-11 h-11 bg-stone-100 group-hover:bg-white rounded-full flex justify-center items-center text-sky-600 shadow-sm transition">
                      <CalendarBlank weight="bold" size={22} />
                    </div>
                    <div>
                      <p className="text-neutral-900 text-sm font-bold">Belum ada jadwal dipilih</p>
                      <p className="text-stone-500 text-xs mt-1">Langkah berikutnya baru terbuka setelah Anda memilih tanggal & slot.</p>
                    </div>
                    <span className="px-4 py-2 bg-sky-600 group-hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition">Pilih jadwal</span>
                  </Link>
                )}

                {errors.jadwal && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <WarningCircle weight="fill" size={14} /> {errors.jadwal}
                  </p>
                )}

                {!selectedDate && (
                  <button
                    type="button"
                    onClick={() => lanjut(2)}
                    className="w-full py-3 bg-stone-100 text-stone-400 rounded-xl text-sm font-bold cursor-not-allowed"
                    disabled
                  >
                    Lanjut: metode & data kontak
                  </button>
                )}
                {selectedDate && step === 1 && (
                  <button
                    type="button"
                    onClick={() => lanjut(2)}
                    className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition"
                  >
                    Lanjut: metode & data kontak <ArrowRight weight="bold" size={16} />
                  </button>
                )}
              </div>

              {/* SECTION B: METODE & KONTAK */}
              {step >= 2 && (
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-200 flex flex-col gap-8 reveal-up">
                  <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
                    <div className="w-10 h-10 bg-sky-100 text-sky-700 text-lg font-bold rounded-xl flex justify-center items-center shrink-0">B</div>
                    <div>
                      <h2 className="text-neutral-900 text-lg font-bold">Metode Penyerahan Unit & Data Kontak</h2>
                      <p className="text-stone-500 text-xs mt-1">
                        Pilih penjemputan berkoper anti-statis, atau datang langsung ke counter teknisi
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {metodeList.map((metode) => (
                      <label key={metode.value} className="relative cursor-pointer h-full">
                        <input
                          type="radio"
                          name="delivery"
                          value={metode.value}
                          checked={delivery === metode.value}
                          onChange={() => pilihMetode(metode.value)}
                          className="peer sr-only"
                        />
                        <div className={`h-full p-5 border-2 rounded-xl flex flex-col gap-3 transition ${delivery === metode.value ? 'bg-sky-50/50 border-sky-500' : 'border-stone-100 hover:border-sky-200'}`}>
                          <h3 className="font-bold text-sm flex items-center gap-2 text-neutral-900">{metode.icon} {metode.title}</h3>
                          <p className="text-stone-500 text-xs flex-1">{metode.desc}</p>
                          <div className="pt-3 border-t border-stone-200 mt-auto">
                            <span className="text-[10px] font-bold flex items-center gap-1.5 text-stone-500">
                              {metode.footIcon} {metode.foot}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {mandiri && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-5 text-sky-800">
                      <span className="font-bold">Datang mandiri:</span> identitas perangkat & diagnosa tidak perlu diisi
                      sekarang. Petugas akan mencatatnya saat Anda tiba di toko, supaya antrean tidak menumpuk.
                    </div>
                  )}

                  <div className="flex flex-col gap-5">
                    {!mandiri && (
                      <div className="flex flex-col gap-2">
                        <label htmlFor="waktu" className="text-neutral-900 text-sm font-bold">Waktu Penjemputan <span className="text-red-500">*</span></label>
                        <select
                          id="waktu"
                          value={waktu}
                          onChange={(event) => setWaktu(event.target.value)}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 transition"
                        >
                          <option value="" disabled>Masukkan waktu</option>
                          {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        {errors.waktu && <span className="text-[11px] font-medium text-red-600">{errors.waktu}</span>}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="nama" className="text-neutral-900 text-sm font-bold">Nama Lengkap Pemilik <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          id="nama"
                          value={nama}
                          onChange={(event) => setNama(event.target.value)}
                          placeholder="Sesuai kartu identitas"
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                        />
                        {errors.nama && <span className="text-[11px] font-medium text-red-600">{errors.nama}</span>}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="whatsapp" className="text-neutral-900 text-sm font-bold">Nomor WhatsApp Aktif <span className="text-red-500">*</span></label>
                        <div className="relative flex items-center">
                          <span className="absolute left-4 text-stone-500 text-sm font-bold">+62</span>
                          <input
                            type="tel"
                            id="whatsapp"
                            value={whatsapp}
                            onChange={(event) => setWhatsapp(event.target.value)}
                            placeholder="81234567890"
                            className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                          />
                        </div>
                        <span className="text-[10px] text-stone-500 leading-tight">Untuk bot live telemetri status & otorisasi biaya.</span>
                        {errors.whatsapp && <span className="text-[11px] font-medium text-red-600">{errors.whatsapp}</span>}
                      </div>
                    </div>

                     {!mandiri && (
                       <div className="flex flex-col gap-5">
                         <div className="flex flex-col gap-2">
                           <div className="flex items-center justify-between gap-2">
                             <label className="flex items-center gap-1.5 text-sm font-bold text-neutral-900"><MapPin className="text-sky-600" size={15} weight="fill" /> Lokasi Penjemputan <span className="text-red-500">*</span></label>
                             {drivingRoute && <span className="hidden rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 sm:inline-flex">{distanceKm.toFixed(1)} km via jalan</span>}
                           </div>
                           <p className="text-[11px] leading-tight text-stone-500">Pilih titik rumah atau lokasi penjemputan. Alamat, jarak, dan ongkir akan diperbarui otomatis.</p>
                           <PickupLocationPicker value={pickupLocation} onChange={setPickupLocation} error={errors.region} />
                         </div>
                        <div className="flex flex-col gap-2">
                          <label htmlFor="instruksi" className="text-neutral-900 text-sm font-bold">Instruksi Khusus Kurir <span className="text-stone-400 font-normal">(Opsional)</span></label>
                          <textarea
                            id="instruksi"
                            rows={3}
                            value={instruksi}
                            onChange={(event) => setInstruksi(event.target.value)}
                            placeholder="Misal: bertemu di lobby barat, titip security..."
                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-neutral-900 transition hover:bg-stone-50"
                    >
                      <ArrowLeft weight="bold" size={16} /> Kembali
                    </button>
                    {!mandiri && (
                      <button
                        type="button"
                        onClick={() => lanjut(3)}
                        disabled={!step2Valid}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                          step2Valid ? 'bg-sky-600 text-white hover:bg-sky-700' : 'cursor-not-allowed bg-stone-100 text-stone-400'
                        }`}
                      >
                        Lanjut: identitas perangkat <ArrowRight weight="bold" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION C: PERANGKAT & DIAGNOSA (courier) / RINGKASAN (mandiri) */}
              {step >= 3 && (
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-200 flex flex-col gap-8 reveal-up">
                  <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
                    <div className="w-10 h-10 bg-sky-100 text-sky-700 text-lg font-bold rounded-xl flex justify-center items-center shrink-0">C</div>
                    <div>
                      <h2 className="text-neutral-900 text-lg font-bold">
                        {mandiri ? 'Ringkasan Booking Datang Mandiri' : 'Identitas Perangkat & Diagnosa Kendala'}
                      </h2>
                      <p className="text-stone-500 text-xs mt-1">
                        {mandiri
                          ? 'Tidak ada data perangkat yang perlu diisi — petugas mencatatnya saat Anda tiba di toko'
                          : 'Informasi akurat membantu persiapan suku cadang presisi sebelum unit tiba'}
                      </p>
                    </div>
                  </div>

                  {mandiri ? (
                    <ul className="flex flex-col gap-3 text-sm">
                      <li className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <Check weight="bold" className="mt-0.5 shrink-0 text-sky-600" size={16} />
                        <span className="text-stone-600">
                          Identitas perangkat, nomor seri, PIN, dan diagnosa dicatat <span className="font-semibold text-neutral-900">langsung oleh petugas frontdesk</span> saat check-in di toko.
                        </span>
                      </li>
                      <li className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <Check weight="bold" className="mt-0.5 shrink-0 text-sky-600" size={16} />
                        <span className="text-stone-600">
                          Nomor resi dan tautan tracking langsung aktif setelah booking, lalu dikirim ke WhatsApp Anda.
                        </span>
                      </li>
                    </ul>
                  ) : (
                    <>
                      <div className="flex flex-col gap-3">
                        <label className="text-neutral-900 text-sm font-bold">Kategori Perangkat <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {kategoriList.map((item) => (
                            <label key={item.value} className="relative cursor-pointer">
                              <input type="radio" name="kategori" value={item.value} checked={kategori === item.value} onChange={() => setKategori(item.value)} className="peer sr-only" />
                              <div className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition ${kategori === item.value ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                                {item.icon}
                                <span className="text-xs font-bold text-center">{item.label}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                          <label htmlFor="model" className="text-neutral-900 text-sm font-bold">Merk & Model Lengkap <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            id="model"
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                            placeholder="Contoh: Asus ROG Zephyrus / iPad Pro"
                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                          />
                          {errors.model && <span className="text-[11px] font-medium text-red-600">{errors.model}</span>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="flex flex-col gap-2">
                            <label htmlFor="serial" className="text-neutral-900 text-sm font-bold">Nomor Seri <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              id="serial"
                              value={serial}
                              onChange={(event) => setSerial(event.target.value)}
                              placeholder="Contoh: G14 2024 / M2"
                              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                            />
                            <span className="text-[10px] text-stone-500 leading-tight">Membantu otentikasi status garansi dan suku cadang pabrikan.</span>
                            {errors.serial && <span className="text-[11px] font-medium text-red-600">{errors.serial}</span>}
                          </div>
                          <div className="flex flex-col gap-2">
                            <label htmlFor="pin" className="text-neutral-900 text-sm font-bold">PIN / Password <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              id="pin"
                              value={pin}
                              onChange={(event) => setPin(event.target.value)}
                              disabled={pinRefused}
                              placeholder="Contoh: 123456"
                              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition disabled:text-stone-400"
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
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-neutral-900 text-sm font-bold">Kategori Gejala & Keluhan Utama <span className="text-red-500">*</span></label>
                        <span className="text-[11px] text-stone-500 -mt-1">Boleh pilih lebih dari 1.</span>
                        <div className="flex flex-wrap gap-2">
                          {gejalaList.map((item) => {
                            const aktif = gejala.includes(item.value);
                            return (
                              <label key={item.value} className="relative cursor-pointer">
                                <input type="checkbox" checked={aktif} onChange={() => toggleGejala(item.value)} className="peer sr-only" />
                                <div className={`px-4 py-2 border rounded-full flex items-center gap-2 transition ${aktif ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                                  {item.icon}
                                  <span className="text-xs font-medium">{item.label}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        {errors.gejala && <span className="text-[11px] font-medium text-red-600">{errors.gejala}</span>}
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="kronologi" className="text-neutral-900 text-sm font-bold">Kronologi & Gejala Spesifik Kerusakan <span className="text-red-500">*</span></label>
                        <textarea
                          id="kronologi"
                          rows={4}
                          value={kronologi}
                          onChange={(event) => setKronologi(event.target.value.slice(0, 500))}
                          placeholder="Ceritakan riwayat kejadian: apakah terjadi setelah update OS, jatuh ringan, atau suhu mendadak melonjak? Sebutkan jika ada bau hangus..."
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition resize-none"
                        />
                        <div className="flex justify-between text-[10px] text-stone-400">
                          <span>Minimal 20 karakter agar teknisi menyiapkan skema yang tepat.</span>
                          <span>{kronologi.length} / 500</span>
                        </div>
                        {errors.kronologi && <span className="text-[11px] font-medium text-red-600">{errors.kronologi}</span>}
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-neutral-900 text-sm font-bold">Unggah Foto / Video Kendala <span className="text-stone-400 font-normal">(Opsional)</span></label>
                        <div className="w-full">
                          <input type="file" multiple accept="image/*,video/*" onChange={onFileChange} className="hidden" id="file-upload" />
                          <label htmlFor="file-upload" className="w-full p-8 bg-stone-50 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-stone-100 transition cursor-pointer">
                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex justify-center items-center text-sky-600 text-xl"><UploadSimple weight="fill" size={24} /></div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-neutral-900">Tarik & lepas atau klik untuk unggah</p>
                              <p className="text-[11px] text-stone-500 mt-1">Mendukung format JPG, PNG, MP4 maks. 25MB</p>
                            </div>
                          </label>
                          {files.length > 0 && (
                            <div className="mt-4 flex flex-col gap-2">
                              {files.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="flex justify-between items-center p-2 bg-stone-50 border border-stone-200 rounded text-xs">
                                  <span className="truncate max-w-[200px]">{file.name}</span>
                                  <button type="button" onClick={() => removeFile(index)} className="text-red-600 font-bold">Hapus</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex w-max items-center justify-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-neutral-900 transition hover:bg-stone-50"
                  >
                    <ArrowLeft weight="bold" size={16} /> Kembali
                  </button>
                </div>
              )}
            </div>

            {/* SIDEBAR */}
            <div className="lg:col-span-1 flex flex-col gap-6 relative">
              <div className="sticky top-28 flex flex-col gap-6 reveal-up">
                <div className="bg-white p-6 rounded-2xl shadow-lg shadow-black/5 border border-stone-200 flex flex-col gap-6">
                  <div className="flex justify-between items-center pb-4 border-b border-stone-100">
                    <h3 className="text-neutral-900 text-sm font-bold">Ringkasan Reservasi Servis</h3>
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] font-bold rounded-full">Slot Diamankan</span>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-white border border-stone-200 rounded-lg shadow-sm flex justify-center items-center text-sky-700 text-xl shrink-0">
                      {mandiri ? (
                        <Storefront weight="fill" />
                      ) : kategori === 'smartphone' ? (
                        <DeviceMobileCamera weight="fill" />
                      ) : kategori === 'console' ? (
                        <GameController weight="fill" />
                      ) : kategori === 'workstation' ? (
                        <DesktopTower weight="fill" />
                      ) : (
                        <Laptop weight="fill" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-stone-500 text-[10px] font-bold tracking-widest uppercase mb-0.5">Unit perangkat</span>
                      {mandiri ? (
                        <>
                          <span className="text-neutral-900 text-sm font-bold leading-tight">Diisi saat check-in</span>
                          <span className="text-stone-500 text-[11px] mt-0.5">Petugas mencatat perangkat di toko</span>
                        </>
                      ) : (
                        <>
                          <span className="text-neutral-900 text-sm font-bold leading-tight">Unit ServiTrack Anda</span>
                          <span className="text-stone-500 text-[11px] mt-0.5">
                            Kategori: {kategoriList.find((item) => item.value === kategori)?.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-stone-500">Jadwal Sesi:</span>
                      <span className={`text-right font-bold ${selectedDate ? 'text-neutral-900' : 'text-stone-400'}`}>
                        {jadwalLabel ?? 'Belum dipilih'}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-stone-500">Metode Penyerahan:</span>
                      <span className="text-neutral-900 font-medium text-right">
                        {delivery === 'antar_jemput' ? 'Antar-Jemput' : delivery === 'terjadwal' ? 'Penjemputan Terjadwal' : 'Datang Mandiri'}
                      </span>
                    </div>
                     <div className="flex justify-between items-start">
                        <span className="text-stone-500">Lokasi Penjemputan:</span>
                        <span className={`max-w-[60%] text-right font-medium ${pickupLocation ? 'text-neutral-900' : 'text-stone-400'}`}>
                          {pickupLocation ? pickupLocation.area || pickupLocation.address : mandiri ? 'Check-in di toko' : 'Belum dipilih'}
                       </span>
                     </div>
                     {!mandiri && pickupLocation && (
                       <div className="flex justify-between items-start">
                         <span className="text-stone-500">Rute ke Lab:</span>
                         <span className="text-right font-medium text-neutral-900">
                           {drivingRoute ? `${distanceKm.toFixed(1)} km${drivingRoute.durationMinutes ? ` · ${drivingRoute.durationMinutes} menit` : ''}` : 'Menghitung rute...'}
                         </span>
                       </div>
                     )}
                    <div className="flex justify-between items-start">
                      <span className="text-stone-500">Estimasi Diagnosa:</span>
                      <span className="text-neutral-900 font-medium text-right">120 Menit Pasca Diterima</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-stone-500">Jaminan Garansi:</span>
                      <span className="text-neutral-900 font-bold text-right">90 Hari Garansi Resmi</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex flex-col gap-2 text-xs">
                    {!mandiri ? (
                      <>
                        <div className="flex justify-between items-center text-stone-600">
                          <span className="flex items-center gap-1.5">
                             Ongkos Kirim
                             {drivingRoute && <span className="text-stone-400">({distanceKm.toFixed(1)} km)</span>}
                          </span>
                          <span className="text-neutral-900 font-medium">
                             {drivingRoute ? formatRupiah(ongkirVal) : <span className="text-stone-400 font-normal">Menghitung rute...</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600">
                          <span className="flex items-center gap-1.5">
                            Titik Antar
                             {pickupLocation && <span className="text-stone-400">(dari lab)</span>}
                          </span>
                          <span className="text-neutral-900 font-medium text-right">{STORE_LOCATION.name}</span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600">
                          <span>Hardcase Proteksi & Koper ESD</span>
                          <span className="text-emerald-600 font-bold">GRATIS</span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600">
                          <span>Asuransi Transit Elektronik</span>
                          <span className="text-neutral-900 font-medium">Termasuk</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-stone-100">
                          <span className="text-neutral-900 text-sm font-bold">Estimasi Biaya Kurir</span>
                            <span className="text-sky-600 text-lg font-bold">{drivingRoute ? formatRupiah(ongkirVal) : '—'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-stone-600">
                        <span>Check-in di toko</span>
                        <span className="text-emerald-600 font-bold">GRATIS</span>
                      </div>
                    )}
                    <p className="text-[10px] text-stone-400 leading-tight mt-1">
                      *Biaya servis perbaikan gawai dikonfirmasi teknisi setelah diagnosa awal.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || bookingMutation.isPending}
                    title={semuaValid ? undefined : 'Lengkapi data booking terlebih dahulu'}
                    className={`w-full py-4 mt-2 rounded-xl text-sm font-bold shadow-md transition flex justify-center items-center gap-2 ${
                      submitting || bookingMutation.isPending
                        ? 'bg-stone-100 text-stone-400 cursor-not-allowed shadow-none'
                        : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
                    }`}
                  >
                    {submitting || bookingMutation.isPending
                      ? 'Memproses booking...'
                      : mandiri
                        ? 'Konfirmasi Booking (Check-in di toko)'
                        : 'Konfirmasi & Amankan Slot Booking'}
                    <ArrowRight weight="bold" size={16} />
                  </button>
                  {errors.submit && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {errors.submit}
                    </p>
                  )}
                </div>

                <div className="bg-stone-100 p-5 rounded-2xl flex items-start gap-4 border border-stone-200">
                  <div className="w-10 h-10 bg-white rounded-full shadow-sm flex justify-center items-center text-black text-lg shrink-0">
                    <Headset weight="fill" size={20} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-neutral-900 text-sm font-bold">Konsultasi Teknis Cepat?</h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed mb-1">
                      Jika unit Anda terkena tumpahan air atau baterai melepuh, jangan dinyalakan. Tim Lab Emergency siap memandu.
                    </p>
                    <a href="#" className="text-sky-700 text-[11px] font-bold flex items-center gap-1 hover:underline">
                      Chat Hotline Lab Denpasar <ArrowRight size={9} weight="bold" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
