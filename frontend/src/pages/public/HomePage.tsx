import { Wrench, Microscope, Devices, ShieldCheck, Speedometer, Truck, Scroll, Kanban, Handshake, Motorcycle, Check, Alarm, ShieldCheckered, Star, Ticket, MagnifyingGlass, CalendarDots, ListPlus, MapPinArea, ChatText, Eye, SealCheck, Headset, CalendarPlus, Lock, QrCode, X } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { useEffect, useState } from 'react';
import { getPublicCapacity, TENANT_SLUG, type PublicCapacityResult } from '../../lib/api';

function getForecastDates(capacityData: PublicCapacityResult | null) {
  const today = new Date();
  const slots = new Map((capacityData?.slots ?? []).map((slot) => [String(slot.slot_date).slice(0, 10), slot]));

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const slot = slots.get(iso);
    const capacity = Number(slot?.capacity ?? 25);
    const bookedCount = Number(slot?.booked_count ?? 0);
    const availableSlots = Math.max(0, capacity - bookedCount);
    const isOpen = slot?.is_open ?? date.getDay() !== 0;
    const status = !isOpen ? 'OFF' : availableSlots === 0 ? 'Penuh' : availableSlots <= 3 ? 'Sisa Sedikit' : 'Tersedia';
    const card = status === 'Penuh'
      ? { box: 'p-3 bg-rose-50 border border-rose-100 rounded-lg flex flex-col gap-3', label: 'text-red-600 text-xs font-bold', dot: 'bg-red-500', slots: 'text-stone-500' }
      : status === 'Sisa Sedikit'
        ? { box: 'p-3 bg-amber-50 border border-amber-100 rounded-lg flex flex-col gap-3', label: 'text-amber-700 text-xs font-semibold', dot: 'bg-amber-500', slots: 'text-stone-600' }
        : status === 'OFF'
          ? { box: 'p-3 bg-stone-50 border border-stone-200 rounded-lg flex flex-col gap-3', label: 'text-stone-500 text-xs font-semibold', dot: 'bg-stone-400', slots: 'text-stone-500' }
          : { box: 'p-3 bg-sky-50 border border-sky-100 rounded-lg flex flex-col gap-3', label: 'text-sky-700 text-xs font-semibold', dot: 'bg-sky-600', slots: 'text-stone-600' };

    return {
      iso,
      date,
      status,
      availableSlots,
      card,
      title: index === 0 ? 'Hari Ini' : index === 1 ? 'Besok' : index === 2 ? 'Lusa' : date.toLocaleDateString('id-ID', { weekday: 'long' }),
      dateLabel: date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }),
    };
  });
}

export default function HomePage() {
  const [capacityData, setCapacityData] = useState<PublicCapacityResult | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5);
    Promise.all([...new Set([month(now), month(nextMonthDate)])].map((value) => getPublicCapacity(TENANT_SLUG, value)))
      .then((results) => setCapacityData({ ...results[0], slots: results.flatMap((result) => result.slots) }))
      .catch(() => setCapacityData(null));
  }, []);

  const today = capacityData?.today;
  const todayCapacity = Number(today?.capacity ?? 25);
  const todayBooked = Number(today?.booked_count ?? 0);
  const todayAvailable = Math.max(0, todayCapacity - todayBooked);
  const todayLoad = todayCapacity ? Math.round((todayBooked / todayCapacity) * 100) : 0;
  const forecastDates = getForecastDates(capacityData);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full bg-white flex flex-col items-center overflow-hidden pt-12">

      {/* 1. HERO SECTION */}
      <section className="w-full max-w-7xl px-4 md:px-8 py-12 md:py-20 flex flex-col items-center page-enter">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
          <div className="flex -space-x-3 pop-in">
            <div className="w-10 h-10 rounded-full bg-sky-600 border-2 border-white flex justify-center items-center text-white text-sm shadow-sm z-40"><Wrench weight="fill" /></div>
            <div className="w-10 h-10 rounded-full bg-red-500 border-2 border-white flex justify-center items-center text-white text-sm shadow-sm z-30"><Microscope weight="fill" /></div>
            <div className="w-10 h-10 rounded-full bg-amber-500 border-2 border-white flex justify-center items-center text-white text-sm shadow-sm z-20"><Devices weight="fill" /></div>
            <div className="w-10 h-10 rounded-full bg-blue-400 border-2 border-white flex justify-center items-center text-white text-sm shadow-sm z-10"><ShieldCheck weight="fill" /></div>
          </div>
          <div className="flex flex-col text-center sm:text-left">
            <span className="text-neutral-900 text-xs font-semibold">38+ Teknisi Terverifikasi</span>
            <span className="text-stone-500 text-[11px]">Apple, Lenovo, Asus, Samsung Certified</span>
          </div>
        </div>

        <div className="max-w-4xl text-center mb-6 page-enter page-enter-delay">
          <h1 className="text-black font-bold text-4xl sm:text-5xl lg:text-7xl leading-tight sm:leading-[1.15]">
            Perbaikan perangkat kini<br/>
            <span className="inline-block px-4 py-1 mt-2 mb-2 bg-rose-200 text-amber-800 rounded-lg shadow-sm -rotate-1">
              transparan
            </span>,
            cepat, dan terpercaya.
          </h1>
        </div>


        {/* Subheadline */}
        <p className="max-w-2xl text-center text-stone-600 text-base md:text-lg leading-relaxed mb-10">
          Pantau setiap tahapan servis secara real-time langsung dari genggaman Anda. Dari penjemputan unit, papan kerja teknisi, hingga nota digital otomatis via WhatsApp Business.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16 w-full sm:w-auto">
          <a href="/booking" className="w-full sm:w-auto px-8 py-3.5 bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm text-white text-sm font-semibold flex items-center justify-center gap-2 transition">
            <CalendarDots weight="fill" /> Booking Servis Sekarang
          </a>
          <a href="/kapasitas" className="w-full sm:w-auto px-8 py-3.5 bg-sky-50 border border-sky-100 hover:bg-sky-100 text-sky-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition">
            <ListPlus weight="bold" /> Cek Kuota Antrian Hari Ini
          </a>
        </div>

        {/* Tracking Input Box */}
        <div className="w-full max-w-2xl p-4 md:p-6 bg-white rounded-2xl shadow-lg border border-black/5 flex flex-col gap-4 float-soft page-enter page-enter-delay-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sky-600 text-xs font-bold uppercase tracking-wide">
              <MagnifyingGlass weight="bold" /> Lacak Resi & Diagnostic Cepat
            </div>
            <div className="hidden sm:flex text-xs text-stone-500 items-center gap-1.5">
              Contoh: <span className="px-2 py-0.5 bg-zinc-100 text-neutral-800 rounded font-medium">SRV4829103756</span>
            </div>
          </div>
          
          <form action="/tracking" method="GET" className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input type="text" name="resi" required placeholder="Masukkan ID Resi (SRV + 10 digit)" className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 transition" />
            </div>
            <button type="submit" className="px-6 py-3 bg-neutral-900 hover:bg-black rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition">
              Lacak
            </button>
          </form>
        </div>
      </section>

      {/* 2. CAPACITY BAROMETER */}
      <section className="w-full max-w-7xl px-4 md:px-8 py-6 reveal-up">
        <div className="p-6 md:p-8 bg-white rounded-2xl shadow-sm border border-stone-100 flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            
            <div className="flex flex-col gap-2 max-w-lg">
              <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full w-max flex items-center gap-2 text-xs font-semibold">
                <Speedometer weight="fill" /> Real-time Capacity Barometer
              </div>
              <h2 className="text-black text-2xl font-bold mt-1">Kapasitas Antrian Servis Hari Ini</h2>
              <p className="text-stone-600 text-sm leading-relaxed">Sistem load-balancing workshop mencegah pengerjaan tertunda & memastikan SLA waktu terjamin.</p>
            </div>
            
            <div className="px-6 py-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center gap-6">
              <div className="flex flex-col items-end">
                <div className="flex items-baseline">
                   <span className="text-black text-4xl font-bold">{todayBooked}</span>
                   <span className="text-stone-400 text-xl font-medium">/{todayCapacity}</span>
                </div>
                <span className="text-stone-500 text-xs">Slot Terisi Hari Ini</span>
              </div>
              <div className="w-px h-12 bg-stone-200"></div>
              <div className="flex flex-col gap-1.5">
                <div className="px-2.5 py-1 bg-sky-100 text-sky-700 rounded w-max flex items-center gap-1.5 text-xs font-bold">
                   <CalendarDots weight="fill" /> {todayAvailable} Slot Tersedia
                </div>
                <span className="text-stone-500 text-xs">Estimasi pengerjaan hari yang sama</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-stone-500 font-medium">
               <span>Tingkat Kepadatan: {todayLoad}% ({todayLoad <= 75 ? 'Optimal' : 'Padat'})</span>
               <span>Batas Maksimum Harian: {todayCapacity} Unit</span>
            </div>
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
               <div className="h-full bg-gradient-to-r from-sky-500 via-sky-600 to-amber-500 rounded-full" style={{width: `${todayLoad}%`}}></div>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex flex-col gap-4">
            <span className="text-neutral-900 text-sm font-semibold">Prakiraan Ketersediaan 5 Hari Ke Depan</span>
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
               {forecastDates.map((item) => (
                 <div key={item.iso} className={item.card.box}>
                   <div className="flex justify-between items-center"><span className="text-neutral-900 text-xs font-semibold">{item.title}</span><span className={`w-2 h-2 ${item.card.dot} rounded-full`}></span></div>
                   <span className="text-neutral-900 text-sm font-bold capitalize">{item.dateLabel}</span>
                   <div className="flex justify-between items-center mt-1"><span className={item.card.label}>{item.status}</span><span className={`px-1.5 py-0.5 bg-white rounded ${item.card.slots} text-[11px]`}>{item.status === 'OFF' ? 'OFF' : `${item.availableSlots} Slot`}</span></div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </section>

      {/* 3. SOP 4 LANGKAH */}
      <section className="w-full bg-stone-50 py-16 flex flex-col items-center border-y border-black/5 mt-8 reveal-up">
        <div className="w-full max-w-7xl px-4 md:px-8 flex flex-col items-center">
          
          <div className="text-center max-w-2xl flex flex-col items-center gap-3 mb-12">
            <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold uppercase tracking-wide">SOP Reparasi Berstandar Industri</span>
            <h2 className="text-black text-3xl md:text-4xl font-bold leading-tight">Alur Servis Tanpa Cemas dalam 4 Langkah</h2>
            <p className="text-stone-600 text-base">Transparan sejak detik pertama Anda mendaftar hingga perangkat kembali prima dengan segel garansi resmi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col justify-between h-full gap-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="w-9 h-9 bg-sky-50 text-sky-700 font-bold rounded-lg flex justify-center items-center text-sm">01</span>
                  <Truck className="text-stone-400 text-2xl" />
                </div>
                <h3 className="text-neutral-900 text-lg font-bold mb-2">Booking & Pilihan Kedatangan</h3>
                <p className="text-sm text-stone-600">Tentukan metode: <strong>Pickup Kurir</strong> langsung jemput ke rumah/kantor, atau <strong>Dropoff</strong> mandiri ke workshop.</p>
              </div>
              <div className="inline-flex items-center gap-2 text-sky-700 text-xs font-semibold pt-4 border-t border-stone-100">
                <MapPinArea weight="fill" /> Penjemputan dalam 60 Menit
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col justify-between h-full gap-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="w-9 h-9 bg-rose-100 text-amber-800 font-bold rounded-lg flex justify-center items-center text-sm">02</span>
                  <Scroll className="text-stone-400 text-2xl" />
                </div>
                <h3 className="text-neutral-900 text-lg font-bold mb-2">Check-in Digital & Nota Otomatis</h3>
                <p className="text-sm text-stone-600">Foto kondisi fisik awal terunggah aman. Tanda terima resmi & tracking link otomatis ke WhatsApp.</p>
              </div>
              <div className="inline-flex items-center gap-2 text-amber-700 text-xs font-semibold pt-4 border-t border-stone-100">
                <ChatText className="text-sm" weight="fill" /> WhatsApp API Verified
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col justify-between h-full gap-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="w-9 h-9 bg-slate-100 text-gray-900 font-bold rounded-lg flex justify-center items-center text-sm">03</span>
                  <Kanban className="text-stone-400 text-2xl" />
                </div>
                <h3 className="text-neutral-900 text-lg font-bold mb-2">Transparansi Kanban Pengerjaan</h3>
                <p className="text-sm text-stone-600">Pantau pergerakan status: Diagnostik → Eksekusi Servis → Quality Check bersama catatan foto perbaikan.</p>
              </div>
              <div className="inline-flex items-center gap-2 text-sky-600 text-xs font-semibold pt-4 border-t border-stone-100">
                <Eye weight="fill" /> Telemetri Real-time 24/7
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col justify-between h-full gap-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="w-9 h-9 bg-zinc-100 text-neutral-900 font-bold rounded-lg flex justify-center items-center text-sm">04</span>
                  <Handshake className="text-stone-400 text-2xl" />
                </div>
                <h3 className="text-neutral-900 text-lg font-bold mb-2">Persetujuan Biaya (Quotation)</h3>
                <p className="text-sm text-stone-600">Tidak ada tagihan membengkak. Penggantian part wajib disetujui konsumen via 1-click digital approval.</p>
              </div>
              <div className="inline-flex items-center gap-2 text-neutral-900 text-xs font-semibold pt-4 border-t border-stone-100">
                <SealCheck weight="fill" /> Zero Hidden Fee Guarantee
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TIERED SUBSCRIPTION SECTION */}
      <section className="w-full max-w-7xl px-4 md:px-8 py-20 reveal-up">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold uppercase tracking-wide inline-block mb-4">Paket Langganan Multi-Tenant</span>
          <h2 className="text-black text-3xl md:text-4xl font-bold leading-tight mb-4">Pilih Paket Sesuai Skala Operasional Workshop Anda</h2>
          <p className="text-stone-600 text-base">Sistem berbasis SaaS dengan fitur modular. Upgrade kapan saja tanpa downtime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Starter */}
          <div className="p-6 bg-white rounded-2xl shadow-sm border-2 border-stone-200 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 bg-stone-100 text-stone-700 rounded-full text-xs font-bold">STARTER</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-black text-4xl font-bold">Rp 299k</span>
                <span className="text-stone-500 text-sm">/bulan</span>
              </div>
              <p className="text-stone-600 text-sm">Untuk workshop kecil dengan tim minimal</p>
            </div>

            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Maksimal 3 user (Admin, Frontdesk, Teknisi)</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Kuota 100 tiket servis per bulan</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Fitur operasional dasar</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Notifikasi WhatsApp otomatis</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Quotation approval digital</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Multi-Branch</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Modul kurir lapangan</span></li>
            </ul>

            <button className="w-full px-6 py-3 bg-stone-100 hover:bg-stone-200 text-neutral-900 rounded-lg text-sm font-semibold transition mt-auto">
              Pilih Starter
            </button>
          </div>

          {/* Pro */}
          <div className="p-6 bg-sky-50 rounded-2xl shadow-lg border-2 border-sky-600 flex flex-col gap-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-600 text-white rounded-full text-xs font-bold">
              PALING POPULER
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 bg-sky-600 text-white rounded-full text-xs font-bold">PRO</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-black text-4xl font-bold">Rp 599k</span>
                <span className="text-stone-500 text-sm">/bulan</span>
              </div>
              <p className="text-stone-600 text-sm">Untuk workshop menengah dengan volume tinggi</p>
            </div>

            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">User tidak terbatas</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Tiket servis tidak terbatas</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Fitur operasional lengkap</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700 font-semibold">Notifikasi WhatsApp otomatis</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700 font-semibold">Quotation approval digital</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Multi-Branch</span></li>
              <li className="flex items-start gap-2"><X className="text-stone-300 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-400 line-through">Modul kurir lapangan</span></li>
            </ul>

            <button className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition mt-auto">
              Pilih Pro
            </button>
          </div>

          {/* Advance */}
          <div className="p-6 bg-white rounded-2xl shadow-sm border-2 border-stone-200 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">ADVANCE</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-black text-4xl font-bold">Rp 1.5jt</span>
                <span className="text-stone-500 text-sm">/bulan</span>
              </div>
              <p className="text-stone-600 text-sm">Untuk enterprise dengan multi-cabang</p>
            </div>

            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Semua fitur Pro</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700 font-semibold">Multi-Branch tanpa batas</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700 font-semibold">Modul kurir lapangan</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Pickup/dropoff tracking GPS</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Prioritas support 24/7</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">Custom branding & domain</span></li>
              <li className="flex items-start gap-2"><Check className="text-sky-600 shrink-0 mt-0.5" weight="bold" size={18} /><span className="text-stone-700">API access untuk integrasi</span></li>
            </ul>

            <button className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition mt-auto">
              Pilih Advance
            </button>
          </div>
        </div>

        <div className="mt-12 p-6 bg-stone-50 rounded-xl border border-stone-200 text-center">
          <div className="flex flex-wrap justify-center gap-4 text-xs font-medium text-stone-500">
            <div className="flex items-center gap-1.5"><Lock className="text-sky-600" size={16} weight="fill" /> Enkripsi end-to-end</div>
            <div className="flex items-center gap-1.5"><SealCheck className="text-sky-600" size={16} weight="fill" /> Garansi uptime 99.9%</div>
            <div className="flex items-center gap-1.5"><ChatText className="text-sky-600" size={16} weight="fill" /> Support teknis responsif</div>
          </div>
        </div>
      </section>

      {/* 5. COURIER SECTION */}
      <section className="w-full max-w-7xl px-4 md:px-8 py-20 reveal-up">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          
          <div className="flex-1 flex flex-col gap-5">
            <span className="px-3 py-1 bg-rose-100 text-amber-800 rounded-full w-max text-xs font-semibold flex items-center gap-1.5">
              <Motorcycle weight="fill" /> Armada Penjemputan Resmi ServiTrack
            </span>
            <h2 className="text-black text-3xl md:text-5xl font-bold leading-tight">Tidak sempat keluar rumah?<br/>Kurir kami yang jemput.</h2>
            <p className="text-stone-600 text-base leading-relaxed max-w-xl">
              Nikmati pengalaman reparasi gadget layaknya layanan hospitality. Kurir berseragam resmi dilengkapi kotak transportasi anti-statis akan mengambil unit langsung dari meja Anda.
            </p>

            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-full flex justify-center items-center shrink-0"><Check weight="bold" /></div>
                <div>
                  <h4 className="text-neutral-900 font-semibold mb-1">Inspeksi Fisik di Tempat</h4>
                  <p className="text-stone-600 text-sm">Kurir memotret kelengkapan & kondisi awal di depan Anda sebelum masuk kantong segel tamper-proof.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-full flex justify-center items-center shrink-0"><Check weight="bold" /></div>
                <div>
                  <h4 className="text-neutral-900 font-semibold mb-1">Asuransi Perjalanan Penuh</h4>
                  <p className="text-stone-600 text-sm">Transit unit diproteksi asuransi pengiriman hingga nilai penuh perangkat selama perjalanan.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-6 border-t border-stone-100">
              <p className="text-neutral-900 text-sm font-semibold mb-3">Wilayah Cakupan Jemput (Instant &lt; 60 Menit):</p>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-neutral-800">
                <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm">Denpasar Selatan</span>
                <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm">Denpasar Barat</span>
                <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm">Denpasar Timur</span>
                <span className="px-3 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm">Denpasar Utara</span>
                <span className="px-3 py-1.5 bg-zinc-100 text-stone-600 rounded-full border border-stone-200">Luar Kota via Logistik</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col gap-4">
            <div className="w-full rounded-2xl overflow-hidden shadow-sm border border-stone-200">
              <img src="/home.png" alt="Kurir ServiTrack menjemput perangkat" className="w-full h-auto" loading="lazy" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 p-5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col">
                <Alarm className="text-sky-700 text-2xl mb-3" weight="fill" />
                <span className="text-neutral-900 text-xl font-bold mb-1">45 Menit</span>
                <span className="text-stone-500 text-xs">Rata-rata kedatangan kurir ke titik jemput</span>
              </div>
              <div className="flex-1 p-5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col">
                <ShieldCheckered className="text-sky-700 text-2xl mb-3" weight="fill" />
                <span className="text-neutral-900 text-xl font-bold mb-1">Anti-Static Bag</span>
                <span className="text-stone-500 text-xs">Proteksi ESD mil-spec saat pengiriman ke lab</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 6. STATS & TESTIMONIALS */}
      <section className="w-full bg-white pt-8 pb-16 flex flex-col items-center border-t border-stone-100">
        <div className="w-full max-w-7xl px-4 md:px-8">
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
            <div className="p-6 bg-white border border-stone-100 rounded-xl shadow-sm text-center flex flex-col items-center">
              <span className="text-black text-4xl md:text-5xl font-bold mb-2">12k+</span>
              <span className="text-stone-500 text-xs font-medium">Perangkat Tertangani</span>
            </div>
            <div className="p-6 bg-white border border-stone-100 rounded-xl shadow-sm text-center flex flex-col items-center">
              <span className="text-sky-600 text-4xl md:text-5xl font-bold mb-2">99.2%</span>
              <span className="text-stone-500 text-xs font-medium">Kepuasan Pelanggan</span>
            </div>
            <div className="p-6 bg-white border border-stone-100 rounded-xl shadow-sm text-center flex flex-col items-center">
              <span className="text-black text-4xl md:text-5xl font-bold mb-2">90 Hari</span>
              <span className="text-stone-500 text-xs font-medium">Garansi Resmi Servis</span>
            </div>
            <div className="p-6 bg-white border border-stone-100 rounded-xl shadow-sm text-center flex flex-col items-center">
              <span className="text-amber-600 text-4xl md:text-5xl font-bold mb-2">100%</span>
              <span className="text-stone-500 text-xs font-medium">Suku Cadang Orisinal</span>
            </div>
          </div>

          <div className="text-center mb-12 flex flex-col items-center gap-2">
            <span className="text-stone-500 text-xs font-bold uppercase tracking-widest">Ulasan Nyata Pelanggan</span>
            <h2 className="text-black text-3xl md:text-4xl font-bold">Transparansi yang Menenangkan</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm flex flex-col justify-between gap-6 hover:-translate-y-1 transition duration-300">
              <div>
                <div className="flex text-amber-400 text-sm mb-4 gap-1">
                  <Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" />
                </div>
                <p className="text-neutral-800 text-base italic leading-relaxed">Biasanya ke tempat servis elektronik rasanya was-was. Di ServiTrack, saya dikirimi foto IC yang terbakar via WA, rincian harganya transparan, dan pengerjaan bisa dilacak menit demi menit.</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-stone-100">
                <div className="w-10 h-10 bg-sky-100 text-sky-700 font-bold rounded-full flex justify-center items-center">AN</div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-bold">Aditya Nugroho</span>
                  <span className="text-stone-500 text-xs">Product Lead • MacBook Pro M1</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm flex flex-col justify-between gap-6 hover:-translate-y-1 transition duration-300">
              <div>
                <div className="flex text-amber-400 text-sm mb-4 gap-1">
                  <Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" />
                </div>
                <p className="text-neutral-800 text-base italic leading-relaxed">Layanan kurir jemputnya sangat tepat waktu. Kurirnya datang pakai boks khusus dan cek fisik langsung di depan saya. Sangat membantu untuk yang jadwal kantornya padat di Sudirman.</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-stone-100">
                <div className="w-10 h-10 bg-rose-100 text-amber-800 font-bold rounded-full flex justify-center items-center">CL</div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-bold">Clarissa Larasati</span>
                  <span className="text-stone-500 text-xs">Financial Analyst • ThinkPad X1</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm flex flex-col justify-between gap-6 hover:-translate-y-1 transition duration-300">
              <div>
                <div className="flex text-amber-400 text-sm mb-4 gap-1">
                  <Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" /><Star weight="fill" />
                </div>
                <p className="text-neutral-800 text-base italic leading-relaxed">Kapasitas antriannya jujur. Kalau penuh ya dibilang penuh, jadi tidak ada cerita laptop menginap berminggu-minggu tanpa kabar. Dua hari langsung kelar ganti baterai dan thermal paste.</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-stone-100">
                <div className="w-10 h-10 bg-slate-100 text-slate-700 font-bold rounded-full flex justify-center items-center">MR</div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-bold">M. Rizky Pratama</span>
                  <span className="text-stone-500 text-xs">Content Creator • Sony A7IV</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. BOTTOM CTA */}
      <section className="w-full bg-white px-4 md:px-8 py-16 flex flex-col items-center">
        <div className="w-full max-w-4xl p-10 md:p-14 bg-stone-50 rounded-3xl border border-stone-200 text-center flex flex-col items-center gap-4">
          <span className="px-4 py-1.5 bg-sky-100 text-sky-700 rounded-full text-xs font-bold inline-flex items-center gap-2">
            <Headset weight="fill" /> Konsultasi Gratis & Tanpa Komitmen
          </span>
          <h2 className="text-black text-3xl md:text-5xl font-bold mt-2 leading-tight">Punya gadget bermasalah atau<br className="hidden md:block"/>butuh estimasi biaya cepat?</h2>
          <p className="text-stone-600 text-base max-w-xl mx-auto mb-4">Tim diagnostik ServiTrack siap memeriksa gejala awal kerusakan perangkat Anda secara daring dalam hitungan menit.</p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <a href="/booking" className="w-full sm:w-auto px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              <CalendarPlus weight="fill" /> Jadwalkan Servis Sekarang
            </a>
            <a href="#" className="w-full sm:w-auto px-8 py-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-neutral-900 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              <ChatText className="text-green-500 text-lg" weight="fill" /> WhatsApp Toko
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-8 text-stone-500 text-xs font-medium">
            <div className="flex items-center gap-1.5"><SealCheck className="text-sky-600" weight="fill" /> Garansi Servis 90 Hari</div>
            <div className="flex items-center gap-1.5"><QrCode className="text-sky-600" weight="fill" /> Pembayaran QRIS / VA</div>
            <div className="flex items-center gap-1.5"><Lock className="text-sky-600" weight="fill" /> Segel Anti-Tamper</div>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="w-full bg-stone-100 border-t border-black/5 flex flex-col items-center pt-12 pb-6 px-4 md:px-8">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          
          <div className="flex flex-col gap-4 pr-4">
            <div className="flex items-center gap-2">
              <img src="/logos.webp" alt="ServiTrack Logo" className="w-5 h-5 object-contain" />
              <span className="text-neutral-900 text-lg font-bold">ServiTrack</span>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">Pusat reparasi elektronik modern bersertifikasi teknisi spesialis dengan telemetri live tracking pengerjaan.</p>
            <div className="text-xs text-stone-500 mt-2">
              <strong>Workshop Utama:</strong><br/>Jl. Kampus Bukit Jimbaran,<br/>Computer Science Building, Bali
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-neutral-900 text-sm font-bold">Jam Operasional</h4>
            <ul className="text-sm text-stone-600 space-y-2">
              <li>Senin - Jumat: 08:30 - 19:00 WITA</li>
              <li>Sabtu: 09:00 - 17:00 WITA</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-neutral-900 text-sm font-bold">Cakupan Jemput Antar</h4>
            <ul className="text-sm text-stone-600 space-y-2">
              <li>Kota Denpasar (1 Jam)</li>
              <li>Kabupaten Badung</li>
              <li>Luar Kota: Ekspedisi Partner</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-neutral-900 text-sm font-bold">Pusat Akses & Bantuan</h4>
            <ul className="text-sm text-stone-600 space-y-2">
              <li><a href="#" className="hover:text-sky-600 transition">Tracking ID Resi</a></li>
              <li><a href="/kapasitas" className="hover:text-sky-600 transition">Cek Antrian Teknisi Hari Ini</a></li>
              <li><a href="#" className="hover:text-sky-600 transition">Katalog Suku Cadang & Garansi</a></li>
            </ul>
          </div>
        </div>

        <div className="w-full max-w-7xl pt-6 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-stone-500 text-xs">© 2026 ServiTrack. Hak Cipta Dilindungi.</span>
          <div className="flex items-center gap-4 text-xs text-stone-500">
            <a href="#" className="hover:text-stone-800 transition">Syarat & Ketentuan Servis</a>
            <a href="#" className="hover:text-stone-800 transition">Kebijakan Privasi</a>
            <a href="#" className="hover:text-stone-800 transition">SOP Penanganan Device</a>
          </div>
        </div>
      </footer>

      </main>
    </div>
  );
}
