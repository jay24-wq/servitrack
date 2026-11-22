import { UsersThree } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import PublicFooter from '../../components/PublicFooter';

const VALUES = [
  {
    number: '01',
    title: 'Fokus pada Operasional',
    description: 'Kami membangun fitur yang benar-benar dibutuhkan dalam operasional workshop sehari-hari.',
  },
  {
    number: '02',
    title: 'Mudah Digunakan',
    description: 'Dirancang agar mudah digunakan oleh admin, frontdesk, teknisi, maupun kurir.',
  },
  {
    number: '03',
    title: 'Transparan & Terpercaya',
    description: 'Memberikan visibilitas proses servis yang jelas untuk pelanggan maupun tim internal.',
  },
  {
    number: '04',
    title: 'Tumbuh Bersama Bisnis',
    description: 'ServiTrack dikembangkan untuk membantu workshop berkembang tanpa proses yang rumit.',
  },
] as const;

const TEAM_DATA = {
  lead: { title: 'Founder & Lead Developer', division: 'Renggana Jaya' },
  members: [
    { name: 'Claude Sonnet', role: 'Lead Developer 1' },
    { name: 'Panendra Soma', role: 'Product Development' },
    { name: 'Andhika Rai', role: 'Quality Assurance' },
    { name: 'Richardo Raphael', role: 'Support' },
  ],
} as const;

const RESPONSIBLE_PERSON = 'Dr. Ir. I Gusti Agung Gede Arya Kadyanan, S.Kom, M.Kom';

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-8">
      <h2 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-slate-600 md:text-right md:text-base">{description}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full bg-white flex flex-col items-center overflow-hidden pt-12">
        <header className="w-full px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
            <div>
              <span className="mb-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Tentang Kami</span>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">Tentang ServiTrack</h1>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600 md:text-right md:text-base">
              Platform manajemen servis dan operasional workshop yang membantu proses booking, check-in, tracking, inventaris, teknisi, kurir, hingga pelaporan dalam satu sistem terintegrasi.
            </p>
          </div>
        </header>

        <section className="w-full border-t border-stone-100 bg-stone-50/70 px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeading title="Ke Mana Kami Menuju" description="Alasan ServiTrack dibangun, dan arah yang kami tuju." />
            <div className="grid overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:grid-cols-2">
              <article className="p-6 md:p-8 lg:p-10">
                <span className="mb-3 block text-sm font-semibold text-sky-700">Visi</span>
                <p className="text-lg font-semibold leading-relaxed text-slate-900 md:text-xl">
                  Menjadi platform manajemen workshop modern yang membantu bisnis servis elektronik bekerja lebih cepat, lebih terorganisir, dan lebih terpercaya.
                </p>
              </article>
              <article className="border-t border-stone-200 p-6 md:border-l md:border-t-0 md:p-8 lg:p-10">
                <span className="mb-3 block text-sm font-semibold text-sky-700">Misi</span>
                <p className="text-sm leading-relaxed text-slate-600 md:text-base">
                  ServiTrack dibangun untuk menyederhanakan operasional workshop melalui digitalisasi proses servis. Mulai dari booking pelanggan, check-in perangkat, assignment teknisi, pickup &amp; delivery, inventaris sparepart, hingga live tracking pelanggan, semuanya terhubung dalam satu sistem.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="w-full px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeading title="Nilai Kami" description="Prinsip yang menjadi dasar dalam setiap pengembangan fitur ServiTrack." />
            <div className="grid overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((value, index) => (
                <article
                  className={`border-b border-slate-200 p-5 last:border-b-0 md:border-b-0 md:p-6 ${index < 2 ? 'md:border-b lg:border-b-0' : ''} ${index % 2 === 0 ? 'md:border-r' : ''} lg:not-last:border-r`}
                  key={value.number}
                >
                  <span className="mb-3 block text-xs font-semibold tracking-wide text-sky-700">{value.number}</span>
                  <h3 className="mb-2 text-base font-semibold text-slate-900">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full border-y border-stone-100 bg-stone-50/70 px-4 py-20 md:px-8 md:py-28">
          <div className="mx-auto w-full max-w-7xl">
            <blockquote className="w-full text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl md:text-4xl">
              “Teknologi yang baik bukan hanya canggih, tetapi mampu menyederhanakan pekerjaan sehari-hari.”
            </blockquote>
            <p className="mt-5 text-sm text-slate-500">Prinsip yang menjadi dasar pengembangan ServiTrack.</p>
          </div>
        </section>

        <section className="w-full px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeading title="Tim Kami" description="Orang-orang yang merancang dan mengembangkan ServiTrack." />
            <div className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="flex min-h-64 flex-col justify-between border-b border-stone-200 bg-stone-50 p-6 md:border-b-0 md:border-r md:p-8">
                  <div role="img" aria-label="Avatar tim ServiTrack" className="grid size-24 place-items-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-700">
                    <UsersThree aria-hidden="true" size={44} weight="duotone" />
                  </div>
                  <div className="mt-10">
                    <h3 className="text-lg font-bold text-slate-900">{TEAM_DATA.lead.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{TEAM_DATA.lead.division}</p>
                  </div>
                </div>

                <div className="px-6 md:px-8">
                  <h3 className="border-b border-stone-100 py-5 text-sm font-semibold text-slate-700">Tim Inti</h3>
                  <ul>
                    {TEAM_DATA.members.map(({ name, role }) => (
                      <li className="flex items-center justify-between gap-4 border-b border-stone-100 py-4 last:border-b-0" key={name}>
                        <span className="text-sm text-slate-700">{name}</span>
                        <span className="shrink-0 text-right text-xs text-slate-500 sm:text-sm">{role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="border-t border-stone-200 px-4 py-4 text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
                Penanggung jawab: <strong className="font-semibold text-slate-700">{RESPONSIBLE_PERSON}</strong>
              </div>
            </div>
          </div>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
