import { List, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-stone-100/90 shadow-[0px_1px_8px_0px_rgba(0,0,0,0.04)] backdrop-blur-[6px] flex flex-col items-center">
      <div className="w-full h-20 max-w-[1280px] px-4 md:px-8 flex justify-between items-center">
        
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logos.webp" alt="ServiTrack Logo" className="w-12 h-12 object-contain" />
          <span className="text-zinc-900 text-xl font-semibold leading-7">ServiTrack</span>
        </a>

        <nav className="hidden md:flex items-center gap-4">
          <NavLink to="/layanan" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Layanan & Fitur</NavLink>
          <NavLink to="/kapasitas" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Cek Kapasitas Antrian</NavLink>
          <NavLink to="/tracking" className={({ isActive }) => `px-2 py-1 text-sm font-medium transition-colors ${isActive ? 'text-sky-600 font-semibold' : 'text-gray-700 hover:text-sky-600'}`}>Live Tracking</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <a href="/login" className="hidden sm:block px-3 py-1.5 text-gray-700 text-sm font-medium hover:text-sky-600 transition-colors">Login</a>
          
          <a href="/booking" className="px-4 py-1.5 bg-sky-600 rounded-lg text-white text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm">
            Booking Servis
          </a>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden ml-1 p-1.5 text-gray-700 hover:text-sky-600 focus:outline-none transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="w-full bg-stone-100 border-t border-black/5 md:hidden shadow-lg">
          <nav className="flex flex-col px-4 py-4 gap-3">
            <NavLink to="/layanan" className={({ isActive }) => `px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Layanan & Fitur</NavLink>
            <NavLink to="/kapasitas" className={({ isActive }) => `px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Cek Kapasitas Antrian</NavLink>
            <NavLink to="/tracking" className={({ isActive }) => `px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Live Tracking</NavLink>

            <div className="h-px bg-black/5 my-1"></div>

            <NavLink to="/login" className={({ isActive }) => `px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-stone-200 text-sky-600 font-semibold' : 'text-gray-700 hover:bg-stone-200'}`}>Login</NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
