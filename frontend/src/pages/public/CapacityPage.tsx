import { Speedometer } from '@phosphor-icons/react';
import Navbar from '../../components/Navbar';
import CalendarSection, { type CalendarDate } from '../../components/CalendarSection';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../../store';
import { getPublicCapacity, TENANT_SLUG, type PublicCapacityResult } from '../../lib/api';

export default function CapacityPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [capacityData, setCapacityData] = useState<PublicCapacityResult | null>(null);
  const navigate = useNavigate();
  const setSelectedDate = useBookingStore((s) => s.setSelectedDate);

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

  const pilihTanggal = (date: CalendarDate) => {
    const iso = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(`${iso}T00:00:00`);
    const lastBookable = new Date(today);
    lastBookable.setDate(today.getDate() + 5);
    if (selected < today || selected > lastBookable) return;
    setSelectedDate({ iso, slots: date.slots, openTime: date.openTime, closeTime: date.closeTime });
    navigate('/booking');
  };

  // Hari pertama bulan (0 = Minggu). Padding kolom dihitung di CalendarSection
  // karena desktop mulai dari Minggu, sedangkan mobile mulai dari Senin.
  const startWeekday = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const generateCalendar = (): CalendarDate[] => {
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const daysInMonth = end.getDate();

    const dates: CalendarDate[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingEnd = new Date(today);
    bookingEnd.setDate(today.getDate() + 5);
    const slotByDate = new Map(
      (capacityData?.slots ?? []).map((slot) => [String(slot.slot_date).slice(0, 10), slot]),
    );

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const slot = slotByDate.get(dateString);
      const capacity = Number(slot?.capacity ?? 25);
      const bookedCount = Number(slot?.booked_count ?? 0);
      const availableSlots = Math.max(0, capacity - bookedCount);
      date.setHours(0, 0, 0, 0);

      dates.push({
        day: i,
        isToday: date.toDateString() === new Date().toDateString(),
        isPast: date < today,
        isSunday: slot ? !slot.is_open : date.getDay() === 0,
        isExceptionClosed: slot?.exception_status === 'closed',
        exceptionTitle:
          slot?.exception_status === 'closed' ? slot.exception_title?.trim() || null : null,
        isNext5Days: date >= today && date <= bookingEnd,
        isFull: availableSlots === 0,
        slots: availableSlots,
        capacity,
        bookedCount,
        openTime: slot?.open_time ?? null,
        closeTime: slot?.close_time ?? null,
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
      <main className="w-full bg-white py-8 px-4 md:px-8 flex justify-center min-h-screen pt-21">
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
                <h1 className="text-slate-900 text-2xl md:text-4xl font-bold leading-tight">
                  Kapasitas Bengkel & Kalender <br className="hidden md:block" /> Booking Real-Time
                </h1>
                <p className="text-slate-600 text-sm md:text-lg leading-relaxed max-w-2xl">
                  Pantau beban kerja teknisi dan reservasi slot pengerjaan agar perangkat langsung ditangani tanpa menginap berhari-hari.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:flex-1">
                <div className="p-4 md:col-start-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 reveal-up">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-sky-100 text-sky-700 rounded-lg flex justify-center items-center text-sm md:text-lg">
                    <Speedometer weight="fill" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-stone-600 text-xs tracking-tight">Beban Hari Ini</span>
                    <div>
                      <span className="text-zinc-900 text-sm font-bold">{todayLoad}%</span>
                      <span className="text-neutral-500 text-sm font-semibold ml-1">({todayBooked}/{todayCapacity} Slot)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CALENDAR SECTION */}
          <CalendarSection
            monthName={monthName}
            dates={dates}
            startWeekday={startWeekday}
            ubahBulan={ubahBulan}
            kembaliHariIni={kembaliHariIni}
            pilihTanggal={pilihTanggal}
          />
        </div>
      </main>
    </div>
  );
}
