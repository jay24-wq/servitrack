import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CaretRight,
  Monitor,
  Palette,
  ShieldCheck,
  User,
  WhatsappLogo,
  CurrencyCircleDollar,
  type Icon,
} from '@phosphor-icons/react';

type SettingsSection = 'account' | 'appearance' | 'customization' | 'guide' | 'notifications' | 'whatsapp' | 'payments' | 'public-tracking';

const settingsGroups: { title: string; items: { section: SettingsSection; title: string; description: string; icon: Icon }[] }[] = [
  {
    title: 'AKUN',
    items: [
      { section: 'account', title: 'Profile Akun', description: 'Avatar, nama, email, password, dan informasi akun', icon: User },
    ],
  },
  {
    title: 'Personalisasi',
    items: [
      { section: 'appearance', title: 'Tampilan', description: 'Mode terang/gelap', icon: Monitor },
      { section: 'customization', title: 'Kustomisasi', description: 'Logo workshop, warna identitas, nama sistem, dan profil usaha', icon: Palette },
    ],
  },
  {
    title: 'Aplikasi',
    items: [
      { section: 'guide', title: 'Panduan', description: 'Panduan penggunaan ServiTrack dan dokumentasi fitur', icon: BookOpen },
      { section: 'notifications', title: 'Notifikasi', description: 'Preferensi event dan kanal notifikasi sistem', icon: Bell },
      { section: 'whatsapp', title: 'WhatsApp', description: 'Hubungkan nomor bengkel dan uji koneksi pengiriman', icon: WhatsappLogo },
      { section: 'payments', title: 'Petunjuk Pembayaran', description: 'Rekening bank, QRIS statis, dan akun e-wallet bengkel', icon: CurrencyCircleDollar },
    ],
  },
  {
    title: 'Privasi',
    items: [
      { section: 'public-tracking', title: 'Tracking Publik', description: 'Atur tampilan kontak petugas pada halaman tracking pelanggan', icon: ShieldCheck },
    ],
  },
];

const settingsDetails: Record<SettingsSection, { title: string; description: string; icon: Icon }> = {
  account: settingsGroups[0].items[0],
  appearance: settingsGroups[1].items[0],
  customization: settingsGroups[1].items[1],
  guide: settingsGroups[2].items[0],
  notifications: settingsGroups[2].items[1],
  whatsapp: settingsGroups[2].items[2],
  payments: settingsGroups[2].items[3],
  'public-tracking': settingsGroups[3].items[0],
};

export default function SettingsPage({ section }: { section?: SettingsSection }) {
  if (section) {
    const detail = settingsDetails[section];
    const Icon = detail.icon;

    return (
      <div className="page-enter flex flex-col gap-6">
        <div>
          <Link to="/settings" className="inline-flex min-h-9 items-center gap-2 rounded-md text-xs font-medium text-stone-600 transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <ArrowLeft weight="bold" className="size-3.5" /> Kembali ke Pengaturan
          </Link>
          <h1 className="mt-3 text-2xl font-bold leading-8 tracking-tight text-zinc-900">{detail.title}</h1>
          <p className="mt-1 text-xs leading-5 text-stone-600">{detail.description}</p>
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Icon weight="fill" className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-5 text-zinc-900">Pengaturan {detail.title} belum tersedia</h2>
              <p className="mt-1 text-xs leading-5 text-stone-600">Halaman ini disiapkan untuk konfigurasi {detail.title.toLowerCase()} pada tahap berikutnya.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-enter flex flex-col gap-7">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Pengaturan</h1>
        <p className="mt-1 text-xs leading-5 text-stone-600">
          Kelola Info Usaha, workshop, tampilan, notifikasi, dan konfigurasi ServiTrack.
        </p>
      </header>

      {settingsGroups.map((group) => {
        const headingId = `settings-${group.title.toLowerCase().replace(/\s+/g, '-')}`;
        return (
          <section key={group.title} aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-500">
              {group.title}
            </h2>
            <div className="flex flex-col gap-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.section}
                    to={`/settings/${item.section}`}
                    className="group flex min-h-[76px] w-full items-center gap-4 rounded-xl border border-black/10 bg-white px-4 py-3.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] transition-colors hover:border-sky-200 hover:bg-sky-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:px-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 transition-colors group-hover:text-sky-700">
                      <Icon weight="fill" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-zinc-900">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-stone-600">{item.description}</span>
                    </span>
                    <CaretRight weight="bold" className="size-4 shrink-0 text-stone-400 transition-colors group-hover:text-sky-700" />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
