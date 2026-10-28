import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarBlank,
  CheckCircle,
  Money,
  Queue,
  Receipt,
  UserPlus,
  Wrench,
} from '@phosphor-icons/react';

import { BookingSummaryCard } from '../../components/frontdesk/BookingSummaryCard';
import { OverviewMetric } from '../../components/frontdesk/OverviewMetric';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { getBookings, getInvoices, getTickets, type InvoiceRow } from '../../lib/api';
import { mapBookingRow, type BookingApiRow } from '../../lib/mappers';
import { useAuthStore } from '../../store';

interface OverviewTicket {
  current_status: string;
  [key: string]: unknown;
}

const ACTIVE_TICKET_STATUSES = new Set([
  'antrian',
  'pengecekan',
  'pengerjaan',
  'menunggu_part',
  'quality_check',
]);

const jakartaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });

function slotDateKey(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

export default function FrontdeskDashboardPage() {
  const staffName = useAuthStore((s) => s.user?.name) ?? 'Frontdesk';

  const { data: bookingsData = [], isLoading: bookingsLoading } = useQuery<BookingApiRow[]>({
    queryKey: ['bookings'],
    queryFn: getBookings,
    refetchInterval: 15000,
  });
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<OverviewTicket[]>({
    queryKey: ['tickets'],
    queryFn: getTickets,
    refetchInterval: 15000,
  });
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<InvoiceRow[]>({
    queryKey: ['invoices'],
    queryFn: getInvoices,
    refetchInterval: 30000,
  });

  const bookings = useMemo(() => (Array.isArray(bookingsData) ? bookingsData.map(mapBookingRow) : []), [bookingsData]);

  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'MENUNGGU_CHECKIN')
        .sort(
          (a, b) =>
            new Date(b.raw.created_at ?? 0).getTime() - new Date(a.raw.created_at ?? 0).getTime()
        ),
    [bookings]
  );

  const todayKey = jakartaDate.format(new Date());
  const totalBookingHariIni = bookings.filter(
    (booking) => booking.status !== 'DIBATALKAN' && slotDateKey(booking.raw.slot_date) === todayKey
  ).length;
  const unitDalamAntrian = tickets.filter((ticket) =>
    ACTIVE_TICKET_STATUSES.has(ticket.current_status)
  ).length;
  const unitSiapDiambil = tickets.filter((ticket) => ticket.current_status === 'siap_diambil').length;
  const tagihanBelumLunas = invoices.filter((invoice) => invoice.status !== 'paid').length;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-8 tracking-tight text-neutral-900">Ringkasan Frontdesk</h1>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Shift aktif
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
            Selamat bertugas, {staffName}. Pantau booking hari ini dan posisi unit dari satu layar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-auto gap-1.5 px-3.5 py-2 text-xs font-semibold" asChild>
            <Link to="/queue/new">
              <UserPlus weight="bold" className="size-4" /> Check-in Servis
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3.5 py-2 text-xs font-semibold" asChild>
            <Link to="/queue">
              <Queue weight="bold" className="size-4" /> Buka Queue
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-auto gap-1.5 px-3.5 py-2 text-xs font-semibold" asChild>
            <Link to="/payments">
              <Money weight="bold" className="size-4" /> Pembayaran
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Ringkasan operasional hari ini" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewMetric
          label="Total Booking Hari Ini"
          value={totalBookingHariIni}
          note="Slot terjadwal hari ini"
          icon={CalendarBlank}
          tileClassName="bg-sky-50 text-sky-600"
          loading={bookingsLoading}
        />
        <OverviewMetric
          label="Menunggu Check-in"
          value={pendingBookings.length}
          note="Perlu diproses di Check-in Servis"
          icon={UserPlus}
          tileClassName="bg-amber-50 text-amber-600"
          loading={bookingsLoading}
        />
        <OverviewMetric
          label="Unit Dalam Antrian"
          value={unitDalamAntrian}
          note="Tiket aktif di Queue"
          icon={Wrench}
          tileClassName="bg-blue-50 text-sky-600"
          loading={ticketsLoading}
        />
        <OverviewMetric
          label="Unit Siap Diambil"
          value={unitSiapDiambil}
          note="Menunggu serah terima"
          icon={CheckCircle}
          tileClassName="bg-emerald-50 text-emerald-600"
          loading={ticketsLoading}
        />
        <OverviewMetric
          label="Tagihan Belum Lunas"
          value={tagihanBelumLunas}
          note="Invoice yang perlu dibayar"
          icon={Receipt}
          tileClassName="bg-rose-50 text-rose-600"
          loading={invoicesLoading}
        />
      </section>

      <BookingSummaryCard bookings={pendingBookings} isLoading={bookingsLoading} />
    </div>
  );
}
