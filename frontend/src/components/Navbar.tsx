import { CaretDown, List, X } from '@phosphor-icons/react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const RESOURCE_LINKS = [
  { to: '/faq', title: 'FAQ', description: 'Pusat bantuan dan pertanyaan umum' },
  { to: '/about', title: 'Tentang Kami', description: 'Pelajari lebih lanjut tentang ServiTrack' },
] as const;

function ResourceMenuItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {RESOURCE_LINKS.map(({ to, title, description }, index) => (
        <Fragment key={to}>
          {index > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem asChild className="h-auto min-h-16 items-start px-3 py-2.5 text-gray-800">
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) => `flex w-full flex-col items-start gap-1 whitespace-normal ${isActive ? 'text-sky-700' : ''}`}
            >
              <span className="font-semibold">{title}</span>
              <span className="text-xs font-normal leading-4 text-stone-500">{description}</span>
            </NavLink>
          </DropdownMenuItem>
        </Fragment>
      ))}
    </>
  );
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopResourcesOpen, setDesktopResourcesOpen] = useState(false);
  const desktopResourcesRef = useRef<HTMLDivElement>(null);
  const desktopResourcesTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelDesktopClose = () => {
    if (desktopCloseTimer.current) clearTimeout(desktopCloseTimer.current);
    desktopCloseTimer.current = null;
  };

  const openDesktopResources = () => {
    cancelDesktopClose();
    setDesktopResourcesOpen(true);
  };

  const closeDesktopResourcesSoon = () => {
    cancelDesktopClose();
    desktopCloseTimer.current = setTimeout(() => {
      setDesktopResourcesOpen(false);
      desktopCloseTimer.current = null;
    }, 120);
  };

  const closeDesktopResources = () => {
    cancelDesktopClose();
    setDesktopResourcesOpen(false);
  };

  useEffect(() => () => cancelDesktopClose(), []);

  useEffect(() => {
    if (!desktopResourcesOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!desktopResourcesRef.current?.contains(event.target as Node | null)) {
        closeDesktopResources();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [desktopResourcesOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    desktopQuery.addEventListener('change', closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      desktopQuery.removeEventListener('change', closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-stone-100/90 shadow-[0px_1px_8px_0px_rgba(0,0,0,0.04)] backdrop-blur-[6px] flex flex-col items-center">
      <div className="w-full h-16 max-w-[1280px] px-4 md:px-8 flex justify-between items-center">
        
        <a href="/" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity">
          <img src="/logos.webp" alt="ServiTrack Logo" className="w-8 h-8 sm:w-12 sm:h-12 object-contain" />
          <span className="text-zinc-900 text-xm sm:text-xl font-semibold leading-7">ServiTrack</span>
        </a>

        <nav className="hidden lg:flex items-center gap-4">
          <NavLink to="/layanan" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Layanan & Fitur</NavLink>
          <NavLink to="/kapasitas" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Cek Kapasitas Antrian</NavLink>
          <NavLink to="/tracking" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Live Tracking</NavLink>
          <div
            ref={desktopResourcesRef}
            className="relative"
            onMouseLeave={closeDesktopResourcesSoon}
            onFocusCapture={openDesktopResources}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeDesktopResourcesSoon();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeDesktopResources();
                desktopResourcesTriggerRef.current?.focus();
              }
            }}
          >
            <button
              ref={desktopResourcesTriggerRef}
              type="button"
              aria-expanded={desktopResourcesOpen}
              aria-controls="desktop-resource-menu"
              onMouseEnter={openDesktopResources}
              onClick={openDesktopResources}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              Sumber Daya
              <CaretDown
                size={14}
                weight="bold"
                className={`transition-transform duration-150 ease-out ${desktopResourcesOpen ? 'rotate-180' : 'rotate-0'}`}
              />
            </button>
            <div
              onMouseEnter={openDesktopResources}
              className={`absolute left-0 top-full z-50 w-80 pt-2 transition-[visibility] duration-150 ${desktopResourcesOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}
            >
              <div
                id="desktop-resource-menu"
                aria-hidden={!desktopResourcesOpen}
                inert={!desktopResourcesOpen}
                className={`origin-top-left rounded-xl border border-stone-200 bg-white p-1.5 text-neutral-900 shadow-lg shadow-black/5 transition-[opacity,scale] duration-150 ease-out ${desktopResourcesOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
              >
                {RESOURCE_LINKS.map(({ to, title, description }, index) => (
                  <Fragment key={to}>
                    {index > 0 && <div className="mx-1.5 my-1.5 h-px bg-stone-100" />}
                    <NavLink
                      to={to}
                      onClick={closeDesktopResources}
                      className={({ isActive }) => `flex min-h-16 w-full flex-col items-start justify-center gap-1 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-stone-100 focus-visible:bg-stone-100 ${isActive ? 'text-sky-700' : 'text-gray-800'}`}
                    >
                      <span className="font-semibold">{title}</span>
                      <span className="text-xs leading-4 text-stone-500">{description}</span>
                    </NavLink>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center sm:gap-2">
          <a href="/login" className="hidden sm:block px-3 py-1.5 text-gray-700 text-sm font-medium hover:text-sky-600 transition-colors">Masuk</a>
          
          <a href="/booking" className="min-h-8 px-3 sm:px-4 py-2 bg-sky-600 rounded-lg text-white text-xs sm:text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm inline-flex items-center">
            Booking Servis
          </a>

          <button 
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="lg:hidden ml-1 size-11 shrink-0 grid place-items-center text-gray-700 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="w-full bg-stone-100 border-t border-black/5 lg:hidden shadow-lg">
          <nav id="mobile-navigation" className="flex flex-col px-4 py-4 gap-1">
            <NavLink to="/layanan" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Layanan & Fitur</NavLink>
            <NavLink to="/kapasitas" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Cek Kapasitas Antrian</NavLink>
            <NavLink to="/tracking" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Live Tracking</NavLink>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  Sumber Daya
                  <CaretDown size={16} weight="bold" className="transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={0}
                className="origin-[var(--radix-dropdown-menu-content-transform-origin)] w-[calc(100vw-2rem)] max-w-[360px] p-1.5 data-[state=open]:[animation-duration:180ms] data-[state=closed]:[animation-duration:180ms] data-[state=closed]:zoom-out-95"
              >
                <ResourceMenuItems onNavigate={() => setMobileMenuOpen(false)} />
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-px bg-black/5 my-1"></div>

            <NavLink to="/login" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Masuk</NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
