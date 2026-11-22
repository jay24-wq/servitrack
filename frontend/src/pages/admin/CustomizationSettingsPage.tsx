import { Link } from 'react-router-dom';
import { ArrowLeft, CaretRight, Gear, Storefront, type Icon } from '@phosphor-icons/react';

type CustomizationSection = 'profile' | 'operasional';

const groups: { title: string; items: { section: CustomizationSection; title: string; description: string; icon: Icon }[] }[] = [
  {
    title: 'Bisnis',
    items: [
      {
        section: 'profile',
        title: 'Profile Usaha',
        description: 'Kelola identitas dan informasi workshop yang ditampilkan kepada pelanggan',
        icon: Storefront,
      },
    ],
  },
  {
    title: 'Operasional',
    items: [
      {
        section: 'operasional',
        title: 'Pengaturan Operasional',
        description: 'Kelola konfigurasi operasional yang digunakan sistem booking dan tracking',
        icon: Gear,
      },
    ],
  },
];

const details: Record<CustomizationSection, { title: string; description: string; icon: Icon }> = {
  profile: groups[0].items[0],
  operasional: groups[1].items[0],
};

export default function CustomizationSettingsPage({ section }: { section?: CustomizationSection }) {
  if (section) {
    const detail = details[section];
    const Icon = detail.icon;

    return (
      <div className="page-enter flex flex-col gap-6">
        <div>
          <Link to="/settings/customization" className="inline-flex min-h-9 items-center gap-2 rounded-md text-xs font-medium text-stone-600 transition-colors hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <ArrowLeft weight="bold" className="size-3.5" /> Kembali ke Kustomisasi
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
              <h2 className="text-sm font-semibold leading-5 text-zinc-900">Pengaturan ini belum tersedia</h2>
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
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">Kustomisasi</h1>
        <p className="mt-1 text-xs leading-5 text-stone-600">Mengelola identitas dan konfigurasi Workshop/Tenant.</p>
      </header>

      {groups.map((group) => {
        const headingId = `customization-${group.title.toLowerCase()}`;
        return (
          <section key={group.title} aria-labelledby={headingId} className="flex flex-col gap-3">
            <h2 id={headingId} className="text-xs font-semibold uppercase leading-4 tracking-wide text-stone-500">{group.title}</h2>
            <div className="flex flex-col gap-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.section}
                    to={`/settings/customization/${item.section}`}
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
