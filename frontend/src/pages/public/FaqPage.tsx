import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import PublicFooter from '../../components/PublicFooter';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { PUBLIC_CONTACT } from '../../data/contact';
import { faqCategories } from '../../data/faq';

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<string>(faqCategories[0].id);

  useEffect(() => {
    const sections = faqCategories
      .map(({ id }) => document.getElementById(`faq-${id}`))
      .filter((section): section is HTMLElement => section !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibleSections[0]) setActiveCategory(visibleSections[0].target.id.replace('faq-', ''));
      },
      { rootMargin: '-112px 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="flex w-full flex-col items-center bg-white pt-16">
        <header className="w-full px-4 pb-10 pt-8 md:px-8 md:pb-14 md:pt-12">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
              Pertanyaan yang Sering Ditanyakan
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-slate-600 md:text-right md:text-base">
              Tidak menemukan jawaban yang Anda cari?{' '}
              <a className="font-semibold text-sky-700 underline decoration-sky-200 underline-offset-4 transition-colors hover:text-sky-800" href={PUBLIC_CONTACT.whatsappUrl} target="_blank" rel="noreferrer">
                Hubungi kami via WhatsApp.
              </a>
            </p>
          </div>
        </header>

        <section className="w-full border-t border-stone-100 bg-stone-50/70 px-4 py-8 md:px-8 md:py-14">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-7 lg:grid-cols-[minmax(0,0.28fr)_minmax(0,0.72fr)] lg:gap-14">
            <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:mb-3 lg:text-sm lg:normal-case lg:tracking-normal lg:text-slate-900">Kategori</h2>
              <nav aria-label="Kategori FAQ" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
                {faqCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`#faq-${category.id}`}
                    aria-current={activeCategory === category.id ? 'location' : undefined}
                    onClick={() => setActiveCategory(category.id)}
                    className={`inline-flex min-h-10 shrink-0 items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 lg:w-full lg:border-transparent ${
                      activeCategory === category.id
                        ? 'border-sky-100 bg-sky-50 font-semibold text-sky-800 lg:bg-sky-50'
                        : 'border-stone-200 bg-white font-medium text-slate-600 hover:border-sky-100 hover:text-sky-700 lg:bg-transparent'
                    }`}
                  >
                    <span>{category.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">{category.questions.length}</span>
                  </a>
                ))}
              </nav>
            </aside>

            <div className="min-w-0 space-y-10 md:space-y-12">
              {faqCategories.map((category) => (
                <section key={category.id} id={`faq-${category.id}`} aria-labelledby={`heading-${category.id}`} className="scroll-mt-28">
                  <h2 id={`heading-${category.id}`} className="mb-4 text-xl font-bold leading-snug text-slate-900 md:mb-5 md:text-2xl">
                    {category.title}
                  </h2>
                  <Accordion type="single" collapsible className="flex flex-col gap-3">
                    {category.questions.map(({ id, question, answer }) => (
                      <AccordionItem key={id} value={id}>
                        <AccordionTrigger>{question}</AccordionTrigger>
                        <AccordionContent>{answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
          </div>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
