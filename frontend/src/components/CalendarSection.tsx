import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';

export type CalendarDate = {
  day: number;
  isToday: boolean;
  isPast: boolean;
  isSunday: boolean;
  isExceptionClosed: boolean;
  exceptionTitle: string | null;
  isNext5Days: boolean;
  isFull: boolean;
  slots: number;
  capacity: number;
  bookedCount: number;
  openTime?: string | null;
  closeTime?: string | null;
};

type Props = {
  monthName: string;
  /** Tanggal 1 sampai akhir bulan, TANPA padding kosong di awal */
  dates: CalendarDate[];
  /** new Date(tahun, bulan, 1).getDay() -> 0 = Minggu */
  startWeekday: number;
  ubahBulan: (offset: number) => void;
  kembaliHariIni: () => void;
  pilihTanggal: (date: CalendarDate) => void;
};

const HARI_DESKTOP = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
const HARI_MOBILE = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

type Status = 'off' | 'locked' | 'full' | 'low' | 'open';

const getStatus = (d: CalendarDate): Status => {
  if (d.isPast || d.isSunday) return 'off';
  if (!d.isNext5Days) return 'locked';
  if (d.isFull) return 'full';
  if (d.slots <= 3) return 'low';
  return 'open';
};

const DOT: Record<Status, string> = {
  open: 'bg-emerald-500',
  low: 'bg-amber-500',
  full: 'bg-red-500',
  off: 'bg-transparent',
  locked: 'bg-transparent',
};

const withPadding = (dates: CalendarDate[], pad: number) => [
  ...Array.from({ length: pad }, () => null),
  ...dates,
];

export default function CalendarSection({
  monthName,
  dates,
  startWeekday,
  ubahBulan,
  kembaliHariIni,
  pilihTanggal,
}: Props) {
  const [selected, setSelected] = useState<CalendarDate | null>(null);

  // Desktop: awal pekan Minggu. Mobile: awal pekan Senin.
  const datesDesktop = withPadding(dates, startWeekday);
  const datesMobile = withPadding(dates, (startWeekday + 6) % 7);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const handleKonfirmasi = () => {
    if (!selected) return;
    pilihTanggal(selected);
    setSelected(null);
  };

  const status = selected ? getStatus(selected) : null;
  const terisi = selected ? Math.min(selected.bookedCount, selected.capacity) : 0;
  const persen = selected && selected.capacity ? (terisi / selected.capacity) * 100 : 0;
  const warnaTeks =
    status === 'full' ? 'text-red-600' : status === 'low' ? 'text-amber-600' : 'text-emerald-600';
  const warnaBar =
    status === 'full' ? 'bg-red-500' : status === 'low' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-7 reveal-up">
      {/* ===================== DESKTOP (md ke atas): tampilan asli ===================== */}
      <div className="hidden md:flex flex-col gap-6">
        {/* Calendar Header */}
        <div className="pb-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <button type="button" aria-label="Bulan sebelumnya" onClick={() => ubahBulan(-1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"><CaretLeft className="text-slate-600 text-xs" /></button>
              <h2 className="px-4 text-slate-800 text-sm lg:text-lg font-bold capitalize">{monthName}</h2>
              <button type="button" aria-label="Bulan berikutnya" onClick={() => ubahBulan(1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"><CaretRight className="text-slate-600 text-xs" /></button>
            </div>
            <button type="button" onClick={kembaliHariIni} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 transition rounded-md text-slate-700 text-xs font-semibold">Hari Ini</button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[760px] flex flex-col gap-2">
            <div className="grid grid-cols-7 gap-2">
              {HARI_DESKTOP.map((day, idx) => (
                <div key={idx} className={`text-center text-xs font-bold tracking-wide ${idx === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {datesDesktop.map((date, idx) => {
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
                          <span className="px-2 py-0.5 bg-sky-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
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

      {/* ===================== MOBILE (di bawah md): grid ringkas + popup ===================== */}
      <div className="md:hidden flex flex-col gap-5">
        {/* Header bulan */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => ubahBulan(-1)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              <CaretLeft className="text-slate-600" />
            </button>
            <h2 className="min-w-[8.5rem] text-center text-base font-bold text-slate-800 capitalize">
              {monthName}
            </h2>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => ubahBulan(1)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              <CaretRight className="text-slate-600" />
            </button>
          </div>
          <button
            type="button"
            onClick={kembaliHariIni}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition text-slate-700 text-xs font-semibold"
          >
            Hari ini
          </button>
        </div>

        {/* Legenda */}
        <ul className="flex flex-wrap gap-2 text-xs text-slate-500">
          {[
            ['bg-emerald-500 border border-emerald-300', 'Slot luang'],
            ['bg-amber-500 border border-amber-300', 'Menipis'],
            ['bg-red-500 border border-red-300', 'Penuh'],
          ].map(([warna, label]) => (
            <li key={label} className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${warna}`} />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-500" />
            Hari ini
          </li>
        </ul>

        {/* Grid kalender */}
        <div className="rounded-3xl bg-slate-50/70 p-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {HARI_MOBILE.map((h) => (
              <div key={h} className="py-2 text-center text-[11px] font-semibold tracking-wide text-slate-500">
                {h}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {datesMobile.map((date, idx) => {
              if (!date) return <div key={idx} className="h-12" />;

              const st = getStatus(date);
              const disabled = st === 'off' || st === 'locked';
              const label = disabled
                ? st === 'locked'
                  ? 'belum dibuka'
                  : date.exceptionTitle || (date.isSunday && !date.isPast ? 'libur' : 'tidak tersedia')
                : `${date.slots} slot tersedia`;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  title={disabled ? label : undefined}
                  onClick={() => setSelected(date)}
                  aria-label={`Tanggal ${date.day}, ${label}`}
                  className={[
                    'h-12 rounded-xl flex flex-col items-center justify-center text-base font-bold transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                    disabled
                      ? st === 'locked'
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-900 hover:bg-white hover:shadow-sm cursor-pointer',
                    date.isToday ? 'bg-sky-100 border-2 border-sky-600 ring-4 ring-sky-200/70' : '',
                  ].join(' ')}
                >
                  <span>{date.day}</span>
                  <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${DOT[st]}`} />
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs italic text-slate-400">
          *Waktu reservasi mengikuti Waktu Indonesia Barat (WIB)
        </p>

        {/* Popup slot (bottom sheet) */}
        {selected && status && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 md:hidden"
            onClick={() => setSelected(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="judul-slot"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="judul-slot" className="text-lg font-bold text-slate-900">
                    {selected.day} <span className="capitalize">{monthName}</span>
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selected.isToday ? 'Hari ini' : 'Slot reservasi'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="text-slate-500" />
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${warnaTeks}`}>{selected.slots}</span>
                  <span className="text-sm text-slate-600">slot tersedia</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${warnaBar}`} style={{ width: `${persen}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {terisi} dari {selected.capacity} slot sudah terisi
                </p>
              </div>

              <button
                type="button"
                disabled={status === 'full'}
                onClick={handleKonfirmasi}
                className="mt-5 w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {status === 'full' ? 'Slot penuh' : 'Pilih'}
              </button>
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
