import { EnvelopeSimple, MapPin, Phone } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { PUBLIC_CONTACT } from '../data/contact';

export default function PublicFooter() {
  return (
    <footer className="w-full overflow-hidden bg-stone-100 border-t border-black/5 flex flex-col items-center pt-12 pb-6 px-4 md:px-8">
      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-center gap-2">
            <img src="/logos.webp" alt="ServiTrack Logo" className="w-5 h-5 object-contain" />
            <span className="text-neutral-900 text-lg font-bold">ServiTrack</span>
          </div>
          <p className="text-stone-600 text-sm leading-relaxed">Pusat reparasi elektronik modern bersertifikasi teknisi spesialis dengan telemetri live tracking pengerjaan.</p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-neutral-900 text-sm font-bold">Fitur Utama</h2>
          <ul className="text-sm text-stone-600 space-y-2">
            <li><Link to="/tracking" className="hover:text-sky-600 transition">Live Tracking ID Resi</Link></li>
            <li><Link to="/kapasitas" className="hover:text-sky-600 transition">Cek Kapasitas Antrian</Link></li>
            <li><Link to="/booking" className="hover:text-sky-600 transition">Booking Servis</Link></li>
            <li><a href="#" className="hover:text-sky-600 transition">Quotation Approval</a></li>
            <li><a href="#" className="hover:text-sky-600 transition">Katalog Suku Cadang</a></li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-neutral-900 text-sm font-bold">Sumber Daya</h2>
          <ul className="text-sm text-stone-600 space-y-2">
            <li>Pusat Bantuan</li>
            <li><Link to="/faq" className="hover:text-sky-600 transition">FAQ</Link></li>
            <li><Link to="/about" className="hover:text-sky-600 transition">Tentang Kami</Link></li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-neutral-900 text-sm font-bold">Kontak</h2>
          <ul className="text-sm text-stone-600 space-y-2">
            <li className="flex items-center gap-2">
              <MapPin aria-hidden="true" size={18} weight="regular" className="shrink-0 text-sky-600" />
              <span>Bali, Indonesia</span>
            </li>
            <li className="flex items-center gap-2">
              <EnvelopeSimple aria-hidden="true" size={18} weight="regular" className="shrink-0 text-sky-600" />
              <a href="mailto:servitrack.official@gmail.com" className="hover:text-sky-600 transition">servitrack.official@gmail.com</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone aria-hidden="true" size={18} weight="regular" className="shrink-0 text-sky-600" />
              <a href={PUBLIC_CONTACT.whatsappUrl} className="hover:text-sky-600 transition">{PUBLIC_CONTACT.whatsappDisplay}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="w-full max-w-7xl pt-6 border-t border-stone-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <span className="text-stone-500 text-xs">© 2026 ServiTrack. All rights reserved. Made with ❤️ in Indonesia</span>
        <div className="flex justify-start gap-4 text-xs text-stone-500">
          <a href="#" className="hover:text-stone-800 transition">Keamanan</a>
          <a href="#" className="hover:text-stone-800 transition">Kebijakan Privasi</a>
          <a href="#" className="hover:text-stone-800 transition">Ketentuan Layanan</a>
        </div>
      </div>

      <div className="relative h-20 lg:h-50 w-full max-w-7xl">
        <p aria-hidden="true" className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[60%] lg:translate-y-[40%] whitespace-nowrap select-none pointer-events-none font-['Pinyon_Script',cursive]" style={{ fontSize: 'clamp(5rem, 18vw, 16rem)', lineHeight: 1, color: 'var(--mv-text, #a8a29e)', opacity: 0.7 }}>
          servitrack
        </p>
      </div>
    </footer>
  );
}
