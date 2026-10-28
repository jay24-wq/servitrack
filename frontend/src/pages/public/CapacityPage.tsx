import { Speedometer, Timer, CaretLeft, CaretRight } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../../store';
import { getPublicCapacity, TENANT_SLUG, type PublicCapacityResult } from '../../lib/api';
import { useEffect } from 'react';

export default function CapacityPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [capacityData, setCapacityData] = useState<PublicCapacityResult | null>(null);
  const navigate = useNavigate();
  const setSelectedDate = useBookingStore(s => s.setSelectedDate);

  const ubahBulan = (offset: number) => {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const kembaliHariIni = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  useEffect(() => {
    const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    getPublicCapacity(TENANT_SLUG, month).then(setCapacityData).catch(() => setCapacityData(null));
  }, [currentMonth]);

  const pilihTanggal = (date: { day: number; slots: number }) => {
    const iso = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(`${iso}T00:00:00`);
    const lastBookable = new Date(today);
    lastBookable.setDate(today.getDate() + 5);
    if (selected < today || selected > lastBookable || selected.getDay() === 0) return;
    setSelectedDate({ iso, slots: date.slots });
    navigate('/booking');
  };
  
  // Generate calendar dates
  const generateCalendar = () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const startDay = start.getDay();
    const daysInMonth = end.getDate();
    
    const dates = [];
    for (let i = 0; i < startDay; i++) {
      dates.push(null);
    }
    
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     const bookingEnd = new Date(today);
     bookingEnd.setDate(today.getDate() + 5);
    const slotByDate = new Map((capacityData?.slots ?? []).map((slot) => [String(slot.slot_date).slice(0, 10), slot]));
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const slot = slotByDate.get(dateString);
      const exceptionDate = slot?.exception_status ? dateString : null;
      const foundException = slot?.exception_status === 'closed' ? slot.exception_title || 'Libur' : null;
      console.log({ day: i, dateString, exceptionDate, foundException });
      const capacity = Number(slot?.capacity ?? 25);
      const bookedCount = Number(slot?.booked_count ?? 0);
      const availableSlots = Math.max(0, capacity - bookedCount);
       date.setHours(0, 0, 0, 0);
      
      dates.push({
        day: i,
        isToday: date.toDateString() === new Date().toDateString(),
        isPast: date < today,
         isSunday: date.getDay() === 0 || slot?.is_open === false,
         isExceptionClosed: slot?.exception_status === 'closed',
         exceptionTitle: slot?.exception_status === 'closed' ? slot.exception_title?.trim() || null : null,
         isNext5Days: date >= today && date <= bookingEnd,
        isFull: availableSlots === 0,
        slots: availableSlots,
        capacity,
        bookedCount,
      });
    }
    
    return dates;
  };

  const dates = generateCalendar();
  const todayCapacity = Number(capacityData?.today?.capacity ?? 0);
  const todayBooked = Number(capacityData?.today?.booked_count ?? 0);
  const todayLoad = todayCapacity ? Math.round((todayBooked / todayCapacity) * 100) : 0;
  const monthName = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="w-full bg-white py-8 px-4 md:px-8 flex justify-center min-h-screen pt-28">
        <div className="w-full max-w-7xl flex flex-col gap-8">
          
          {/* BREADCRUMB & HEADER */}
          <div className="flex flex-col gap-6 page-enter">
            <div className="flex items-center gap-2 text-xs">
              <a href="/" className="text-slate-500 hover:text-slate-800 transition">Beranda</a>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Cek Kapasitas Antrian</span>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8">
              <div className="flex flex-col gap-3 md:max-w-xl">
                <h1 className="text-slate-900 text-3xl md:text-4xl font-bold leading-tight">Kapasitas Bengkel & Kalender <br className="hidden md:block"/> Booking Real-Time</h1>
                <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-2xl">Pantau beban kerja teknisi dan reservasi slot pengerjaan agar perangkat langsung ditangani tanpa menginap berhari-hari.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:flex-1">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 reveal-up">
                  <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-lg flex justify-center items-center text-lg"><Speedometer weight="fill" /></div>
                  <div className="flex flex-col">
                    <span className="text-stone-600 text-xs tracking-tight">Beban Hari Ini</span>
                    <div>
                       <span className="text-zinc-900 text-sm font-bold">{todayLoad}%</span>
                       <span className="text-neutral-500 text-sm font-semibold ml-1">({todayBooked}/{todayCapacity} Slot)</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 reveal-up">
                  <div className="w-10 h-10 bg-zinc-100 text-gray-600 rounded-lg flex justify-center items-center text-lg"><Timer weight="fill" /></div>
                  <div className="flex flex-col">
                    <span className="text-stone-600 text-xs tracking-tight">Rata-rata Turnaround SLA</span>
                     <span className="text-zinc-900 text-sm font-bold">{capacityData?.average_turnaround_days ? `${capacityData.average_turnaround_days.toFixed(1)} Hari Kerja` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CALENDAR SECTION */}
          <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-7 flex flex-col gap-6 reveal-up">
            
            {/* Calendar Header */}
            <div className="pb-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                   <button type="button" aria-label="Bulan sebelumnya" onClick={() => ubahBulan(-1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"><CaretLeft className="text-slate-600 text-xs" /></button>
                  <h2 className="px-4 text-slate-800 text-lg font-bold capitalize">{monthName}</h2>
                   <button type="button" aria-label="Bulan berikutnya" onClick={() => ubahBulan(1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"><CaretRight className="text-slate-600 text-xs" /></button>
                </div>
                 <button type="button" onClick={kembaliHariIni} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 transition rounded-md text-slate-700 text-xs font-semibold">Hari Ini</button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[760px] flex flex-col gap-2">
                
                <div className="grid grid-cols-7 gap-2">
                  {['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((day, idx) => (
                    <div key={idx} className={`text-center text-xs font-bold tracking-wide ${idx === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {dates.map((date, idx) => {
                    if (!date) {
                      return <div key={idx} className="h-24"></div>;
                    }

                    if (date.isPast) {
                      return (
                        <div key={idx} className="h-24 p-2 bg-slate-50/70 border border-slate-100 rounded-xl opacity-60 flex justify-between">
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded h-max">{date.isSunday ? 'OFF' : date.slots}</span>
                          <span className="text-slate-400 text-xs font-semibold">{date.day}</span>
                        </div>
                      );
                    }

                    if (date.isToday && !date.isSunday) {
                      return (
                        <div key={idx} onClick={() => pilihTanggal(date)} className="h-36 p-3 bg-blue-50 border-2 border-sky-500 rounded-xl shadow-md flex flex-col justify-between cursor-pointer hover:shadow-lg transition">
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span> HARI INI
                              </span>
                              <span className="text-sky-700 text-2xl font-bold">{date.day}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-sky-600 text-white text-xs font-bold rounded w-max">{date.slots} Slot</span>
                          </div>
                           <div className="pt-2 border-t border-blue-100 flex justify-between items-center">
                             <span className="text-sky-700 text-xs font-semibold">{date.bookedCount}/{date.capacity} Slot</span>
                            <span className="text-sky-700 text-xs font-bold flex items-center gap-0.5">Pilih <CaretRight weight="bold" /></span>
                          </div>
                        </div>
                      );
                    }

                    if (date.isSunday) {
                      return (
                        <div key={idx} className="h-36 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between opacity-80">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">OFF</span>
                            <span className="text-slate-700 text-xl font-bold">{date.day}</span>
                          </div>
                           <span className="max-w-full truncate text-slate-500 text-xs" title={date.exceptionTitle || (date.isExceptionClosed ? 'Libur' : undefined)}>{date.exceptionTitle || 'Libur'}</span>
                        </div>
                      );
                    }

                    if (date.isNext5Days) {
                      if (date.isFull) {
                        return (
                          <div key={idx} className="h-36 p-3 bg-red-50/30 border border-red-200 rounded-xl flex flex-col justify-between hover:border-red-500 transition group">
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded">0 Slot</span>
                                <span className="text-slate-800 text-xl font-bold">{date.day}</span>
                              </div>
                              <span className="text-red-600 text-xs font-bold">Penuh</span>
                            </div>
                            <div className="pt-2 border-t border-red-100 flex justify-between items-center">
                               <span className="text-red-500 text-xs font-semibold">{date.bookedCount}/{date.capacity} Slot</span>
                            </div>
                          </div>
                        );
                      }

return (
                        <div key={idx} onClick={() => pilihTanggal(date)} className="h-36 p-3 bg-white border border-slate-300 rounded-xl flex flex-col justify-between cursor-pointer hover:border-sky-500 transition group">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded">{date.slots} Slot</span>
                              <span className="text-slate-900 text-xl font-bold">{date.day}</span>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                             <span className="text-slate-600 text-xs font-semibold">{date.bookedCount}/{date.capacity} Slot</span>
                            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 group-hover:bg-sky-600 group-hover:text-white rounded text-sky-700 text-xs font-bold flex items-center gap-0.5">Pilih <CaretRight weight="bold" /></span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="h-36 p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl opacity-60 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded">{date.slots}</span>
                          <span className="text-slate-600 text-base font-semibold">{date.day}</span>
                        </div>
                        <span className="text-slate-400 text-xs">Belum Dibuka</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-sky-600 rounded-sm"></span> Hari Ini / Terpilih</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-sm"></span> Slot Luang (&gt;3)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm"></span> Slot Menipis (≤3)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm"></span> Slot Penuh</div>
              </div>
              <span className="text-slate-400 text-xs italic">*Waktu reservasi mengikuti Waktu Indonesia Barat (WIB)</span>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
