import { Microscope, Wind, SealCheck, ShieldCheckered, VideoCamera, ListMagnifyingGlass, UserCheck, QrCode } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import PublicFooter from '../../components/PublicFooter';

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full bg-white flex flex-col items-center overflow-hidden pt-21">

        {/* SECTION 1: HERO & BREADCRUMB */}
        <section className="w-full bg-white border-b border-black/5 flex justify-center page-enter">
          <div className="w-full max-w-7xl px-4 md:px-8 pb-14 flex flex-col gap-6">
            
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-xs">
                <a href="/" className="text-stone-600 hover:text-stone-900 transition">Beranda</a>
                <span className="text-neutral-400">/</span>
                <span className="text-neutral-900 font-medium">Layanan & Fitur</span>
              </div>
            </div>

            <div className="max-w-4xl flex flex-col gap-4">
              <h1 className="text-neutral-900 text-2xl md:text-4xl font-bold leading-tight">
                Layanan Reparasi Presisi &<br className="hidden md:block" /> Fitur Monitoring Terbuka.
              </h1>
              <p className="text-gray-700 text-sm md:text-lg leading-relaxed max-w-2xl">
                Dari penanganan mikrosolder chip logic board hingga streaming telemetri mikroskop 45x langsung ke dashboard Anda. Standar Cleanroom ISO Kelas 7 dengan transparansi komponen OEM 100% tanpa biaya siluman.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 reveal-up">
              <div className="p-3.5 bg-white rounded-lg border border-black/10 flex items-center gap-3 shadow-sm hover:shadow-md transition">
                <div className="w-9 h-9 bg-sky-100 text-sky-700 rounded-md flex justify-center items-center text-sm"><Microscope weight="fill" /></div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-semibold">0.1 mm Micro-Pitch</span>
                  <span className="text-neutral-500 text-xs tracking-tight">Toleransi Intervensi Board</span>
                </div>
              </div>
              <div className="p-3.5 bg-white rounded-lg border border-black/10 flex items-center gap-3 shadow-sm hover:shadow-md transition">
                <div className="w-9 h-9 bg-amber-50 text-amber-500 rounded-md flex justify-center items-center text-sm"><Wind weight="fill" /></div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-semibold">Partikel &lt; 352k/m³</span>
                  <span className="text-neutral-500 text-xs tracking-tight">ISO 14644-1 Kelas 7</span>
                </div>
              </div>
              <div className="p-3.5 bg-white rounded-lg border border-black/10 flex items-center gap-3 shadow-sm hover:shadow-md transition">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-md flex justify-center items-center text-sm"><SealCheck weight="fill" /></div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-semibold">100% Terverifikasi</span>
                  <span className="text-neutral-500 text-xs tracking-tight">Barcode Komponen OEM</span>
                </div>
              </div>
              <div className="p-3.5 bg-white rounded-lg border border-black/10 flex items-center gap-3 shadow-sm hover:shadow-md transition">
                <div className="w-9 h-9 bg-sky-100 text-sky-700 rounded-md flex justify-center items-center text-sm"><ShieldCheckered weight="fill" /></div>
                <div className="flex flex-col">
                  <span className="text-neutral-900 text-sm font-semibold">Zero-Access Audit</span>
                  <span className="text-neutral-500 text-xs tracking-tight">Proteksi Data ISO 27001</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: KATALOG REPARASI */}
        <section className="w-full bg-stone-100 py-16 flex justify-center reveal-up">
          <div className="w-full max-w-7xl px-4 md:px-8 flex flex-col gap-8">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sky-700 text-xs font-semibold uppercase tracking-wider">MODUL SPESIALISASI TERJADWAL</span>
                <h2 className="text-neutral-900 text-2xl md:text-4xl font-semibold">Katalog Reparasi Bersertifikasi Industri</h2>
              </div>
              <p className="text-stone-600 text-sm max-w-sm md:text-right">
                Seluruh pengerjaan terekam dalam log audit digital. Anda memegang kendali penuh melalui otorisasi biaya satu atap.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {[
                { title: 'Micro-Soldering Logic Board', desc: 'Perbaikan IC Power, short circuit, dan trace board presisi 0.1mm.', tag: 'Level 3', time: '24–48 Jam', warranty: '180 Hari Garansi' },
                { title: 'Layar & Baterai Original', desc: 'Penggantian Retina Display dan baterai OEM berkalibrasi resmi pabrikan.', tag: 'Cepat', time: '2–4 Jam', warranty: '90 Hari Garansi' },
                { title: 'Thermal & Cleaning ISO-7', desc: 'Repaste Honeywell PTM7950 dan pembersihan ruang hampa cleanroom.', tag: 'Perawatan', time: 'Turun 12°–20°C', warranty: '2 Jam Selesai' },
                { title: 'Data Recovery Forensik', desc: 'Penyelamatan NAND, SSD, HDD terdampak air dengan zero-knowledge privacy.', tag: 'Forensik', time: '94.8% Sukses', warranty: 'ISO 27001' },
                { title: 'Kurir ESD Pickup', desc: 'Penjemputan berkoper anti-statis tersegel barcode langsung dari meja Anda.', tag: 'Kurir Khusus', time: 'Siap 60 Menit', warranty: 'Gratis Booking' },
                { title: 'Diagnosa Thermal FLIR', desc: 'Audit menyeluruh 32 sensor kelistrikan dan inframerah tanpa biaya pembatalan.', tag: 'Audit Cepat', time: '60 Menit Lab', warranty: 'PDF Report' },
              ].map((item, idx) => (
                <div key={idx} className="p-6 bg-white rounded-xl shadow-sm border border-black/5 flex flex-col justify-between gap-4 hover:shadow-md transition reveal-up">
                  <div>
                    <div className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full inline-flex items-center text-xs font-medium mb-3">
                      {item.tag}
                    </div>
                    <h3 className="text-neutral-900 text-base md:text-xl font-semibold leading-tight mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-zinc-100 rounded text-stone-600 text-xs font-medium">{item.time}</span>
                    <span className="px-2 py-1 bg-zinc-100 rounded text-stone-600 text-xs font-medium">{item.warranty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: FITUR EKOSISTEM */}
        <section className="w-full bg-stone-50 py-16 border-y border-black/5 flex justify-center reveal-up">
          <div className="w-full max-w-7xl px-4 md:px-8 flex flex-col gap-12 items-center">
            
            <div className="text-center max-w-2xl flex flex-col items-center gap-3">
              <div className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold uppercase tracking-wide">Transparansi Proses 100%</div>
              <h2 className="text-neutral-900 text-2xl md:text-4xl font-semibold leading-tight">Fitur Ekosistem: Standar Baru<br className="hidden md:block"/> Kepercayaan Servis</h2>
              <p className="text-stone-600 text-sm leading-relaxed">Tidak ada rahasia di balik pintu lab kami. Seluruh siklus hidup perangkat dipantau secara obyektif melalui telemetri digital.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
              {[
                { icon: <VideoCamera size={24} />, title: 'Live Microscopic Telemetri', desc: 'Feed mikroskop optik 45x terhubung langsung ke dashboard live tracking Anda. Saksikan proses pemasangan komponen mikro.', badge: '1080p 60FPS Low-Latency' },
                { icon: <ListMagnifyingGlass size={24} />, title: 'Kapasitas Kuota Real-Time', desc: 'Pantau beban 12 meja kerja aktif lab kami per jam. Booking slot tepat waktu dengan estimasi penyelesaian SLA yang presisi.', badge: 'Sinkronisasi Tiap 60 Detik' },
                { icon: <UserCheck size={24} />, title: 'Persetujuan Biaya 1-Click', desc: 'Rincian harga suku cadang dan jasa dijabarkan transparan. Tidak ada penggantian suku cadang sebelum persetujuan resmi (OTP).', badge: 'Tidak Ada Biaya Siluman' },
                { icon: <QrCode size={24} />, title: 'Garansi Digital Terenkripsi', desc: 'Klaim tanpa nota kertas. Garansi otomatis tersimpan di cloud ServiTrack, tersinkronisasi dengan SN motherboard & segel QR.', badge: 'Klaim Instant Paperless' },
              ].map((feature, idx) => (
                <div key={idx} className="p-6 bg-white rounded-xl border border-black/10 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition reveal-up">
                  <div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-sky-50 text-sky-600 rounded-lg flex justify-center items-center text-xl mb-4">{feature.icon}</div>
                    <h3 className="text-neutral-900 text-base md:text-lg font-semibold mb-2 leading-snug">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.desc}</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-2">
                    <span className="text-sky-700 text-xs font-medium">{feature.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: FAQ & CTA */}
        <section className="w-full bg-stone-50 pt-16 pb-24 flex flex-col items-center reveal-up">
          <div className="w-full max-w-7xl px-4 md:px-8">
            <div className="w-full relative bg-slate-900 rounded-2xl shadow-xl border border-black/10 p-8 md:p-12 overflow-hidden flex flex-col lg:flex-row justify-between items-center gap-8">
              
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_white_7%,_transparent_70%)]"></div>
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-sky-600/30 rounded-full blur-[60px]"></div>

              <div className="relative z-10 flex flex-col gap-4 text-center lg:text-left max-w-2xl">
                <h2 className="text-white text-2xl md:text-4xl font-semibold leading-tight">Perangkat Bermasalah? <br/>Amankan Slot Pengerjaan Hari Ini.</h2>
                <p className="text-stone-400 text-sm md:text-lg">Pilih kemudahan antar-jemput kurir khusus ESD gratis atau bawa langsung unit ke Cleanroom Lab ServiTrack terdekat untuk diagnosa instan.</p>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <a href="/booking" className="px-6 py-3 bg-sky-600 hover:bg-sky-500 rounded-lg text-white text-sm font-semibold text-center transition">Booking Servis Sekarang</a>
                <a href="/kapasitas" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium text-center transition">Cek Kapasitas Slot</a>
              </div>

            </div>
          </div>
        </section>

        <PublicFooter />
      </main>
    </div>
  );
}
