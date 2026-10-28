import { Link } from 'react-router-dom';
import { ArrowRight, CalendarBlank } from '@phosphor-icons/react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { BookingRow } from '../../lib/mappers';

interface BookingSummaryCardProps {
  bookings: BookingRow[];
  isLoading: boolean;
}

export function BookingSummaryCard({ bookings, isLoading }: BookingSummaryCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold leading-5 text-neutral-900">Booking Menunggu Check-in</h2>
          <p className="mt-0.5 text-xs leading-5 text-stone-500">
            Booking terbaru yang perlu diproses menjadi service ticket.
          </p>
        </div>
        <Badge variant="warning">{bookings.length} booking</Badge>
      </div>

      <ul className="divide-y divide-black/5">
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="flex items-center justify-between gap-4 px-5 py-4" aria-hidden="true">
              <span className="flex flex-col gap-2">
                <span className="block h-4 w-28 animate-pulse rounded bg-stone-100" />
                <span className="block h-3 w-40 animate-pulse rounded bg-stone-100" />
              </span>
              <span className="block h-4 w-24 animate-pulse rounded bg-stone-100" />
            </li>
          ))}

        {!isLoading &&
          bookings.slice(0, 5).map((booking) => (
            <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <span className="block font-mono text-xs font-semibold text-sky-700">{booking.code}</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-neutral-900">{booking.name}</span>
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <span className="block truncate text-xs font-medium text-neutral-900">
                  {booking.device?.model || 'Perangkat belum dicatat'}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500 sm:justify-end">
                  <CalendarBlank weight="bold" className="size-3.5 text-stone-400" />
                  {booking.slotDate}
                </span>
              </div>
            </li>
          ))}

        {!isLoading && bookings.length === 0 && (
          <li className="px-5 py-10 text-center">
            <span className="block text-sm font-semibold text-neutral-900">Tidak ada booking menunggu check-in</span>
            <span className="mt-1 block text-xs leading-5 text-stone-500">
              Booking baru akan tampil di sini setelah pelanggan memesan slot.
            </span>
          </li>
        )}
      </ul>

      <div className="border-t border-black/5 bg-stone-50/60 px-5 py-3">
        <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3 py-2 text-xs font-semibold" asChild>
          <Link to="/queue/new">
            Lihat Semua Booking <ArrowRight weight="bold" className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
