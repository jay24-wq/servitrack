import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  DownloadSimple,
  Printer,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  TrendUp,
  TrendDown,
  Money,
  QrCode,
  Bank,
  Wallet,
  Package,
  UserCircleCheck,
  WarningCircle,
  ShieldCheck,
  ClockCounterClockwise,
  Lock,
  MagnifyingGlass,
  Receipt,
  Hourglass,
  CheckCircle,
  type Icon,
} from '@phosphor-icons/react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { UserAvatar } from '../../components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { initialsOf } from '../../lib/avatar';
import { useAuthStore } from '../../store';
import { getReportsAudit, getReportsDashboard } from '../../lib/api';

type TicketStatus = 'Antrian' | 'Pengecekan' | 'Pengerjaan' | 'Menunggu Part' | 'Quality Control' | 'Selesai' | 'Siap Diambil';
type PaymentMethod = 'cash' | 'qris' | 'va' | 'ewallet';
type Granularity = 'harian' | 'mingguan' | 'bulanan';
type Tab = 'laporan' | 'audit';

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: string;
  actionTone: 'sky' | 'amber' | 'rose' | 'emerald' | 'stone';
  entity: string;
  entityType: 'tiket' | 'part' | 'invoice' | 'staff' | 'quotation' | 'auth';
  summary: string;
  before: string;
  after: string;
  ip: string;
}

const TODAY = new Date();
const DAY = 86_400_000;
const SLA_MINUTES = 120;
const SCHEDULES = ['Belum dikonfigurasi'];

/* Legacy fixture block intentionally disabled; reports are loaded from the API below.
const PART_CATALOG = [
  { name: 'Baterai iPhone 12/13 original', price: 230_000 },
  { name: 'LCD Retina MacBook Air 13"', price: 500_000 },
  { name: 'Keyboard module ThinkPad X1', price: 330_000 },
  { name: 'Thermal paste Noctua NT-H2', price: 70_000 },
  { name: 'Flex connector display iPhone', price: 150_000 },
  { name: 'Kipas CPU Asus Zephyrus', price: 270_000 },
];
*/

const METHOD_META: Record<PaymentMethod, { label: string; icon: Icon; tone: string }> = {
  cash: { label: 'Tunai', icon: Money, tone: 'bg-emerald-500' },
  qris: { label: 'QRIS', icon: QrCode, tone: 'bg-sky-500' },
  va: { label: 'Virtual account', icon: Bank, tone: 'bg-purple-500' },
  ewallet: { label: 'E-wallet', icon: Wallet, tone: 'bg-amber-500' },
};

const STATUS_ORDER: TicketStatus[] = [
  'Antrian',
  'Pengecekan',
  'Pengerjaan',
  'Menunggu Part',
  'Quality Control',
  'Selesai',
  'Siap Diambil',
];

const STATUS_BAR: Record<TicketStatus, string> = {
  Antrian: 'bg-stone-400',
  Pengecekan: 'bg-amber-500',
  Pengerjaan: 'bg-sky-600',
  'Menunggu Part': 'bg-rose-500',
  'Quality Control': 'bg-purple-500',
  Selesai: 'bg-emerald-500',
  'Siap Diambil': 'bg-emerald-400',
};

const ACTION_TONE: Record<AuditEntry['actionTone'], string> = {
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-red-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  stone: 'bg-stone-100 text-stone-600',
};

const RANGES = [
  { key: 'today', label: 'Hari ini', days: 1 },
  { key: '7d', label: '7 hari', days: 7 },
  { key: '30d', label: '30 hari', days: 30 },
  { key: 'month', label: 'Bulan ini', days: 0 },
  { key: '90d', label: '90 hari', days: 90 },
] as const;

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'harian', label: 'Harian' },
  { key: 'mingguan', label: 'Mingguan' },
  { key: 'bulanan', label: 'Bulanan' },
];


/* Legacy generated fixtures removed from the render path.
function seeded(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function isoDaysAgo(days: number) {
  return new Date(TODAY.getTime() - days * DAY).toISOString();
}

function angka(value: number) {
  return new Intl.NumberFormat('id-ID').format(Math.round(value));
}

function rupiah(value: number) {
  return `Rp ${angka(value)}`;
}

function compactRupiah(value: number) {
  const million = value / 1_000_000;
  return `Rp ${million.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
}

function jam(value: number) {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`;
}

const TICKETS: TicketRec[] = Array.from({ length: 96 }, (_, index) => {
  const r = seeded(index);
  const status: TicketStatus =
    r < 0.52
      ? 'Selesai'
      : r < 0.62
        ? 'Quality Control'
        : r < 0.73
          ? 'Pengerjaan'
          : r < 0.84
            ? 'Menunggu Part'
            : r < 0.93
              ? 'Pengecekan'
              : 'Antrian';

  const daysAgo = Math.floor(seeded(index + 500) * 118);
  const createdAt = isoDaysAgo(daysAgo);
  const technician = TECHS[Math.floor(seeded(index + 900) * TECHS.length)];
  const partCount = Math.floor(seeded(index + 300) * 3);
  const parts: PartUse[] = Array.from({ length: partCount }, (_, slot) => {
    const part = PART_CATALOG[Math.floor(seeded(index * 7 + slot + 40) * PART_CATALOG.length)];
    return { name: part.name, qty: 1 + Math.floor(seeded(index * 3 + slot) * 2), price: part.price };
  });
  const serviceFee = 150_000 + Math.floor(seeded(index + 77) * 7) * 50_000;
  const total = serviceFee + parts.reduce((sum, part) => sum + part.qty * part.price, 0);
  const turnaroundMinutes = 45 + Math.floor(seeded(index + 210) * 180);

  return {
    id: `SRV${1000000000 + index * 7919}`,
    status,
    createdAt,
    technician,
    serviceFee,
    parts,
    total,
    turnaroundMinutes,
  };
});

const INVOICES: InvoiceRec[] = TICKETS.filter((ticket) => ticket.status === 'Selesai').map((ticket, index) => {
  const methodRoll = seeded(index + 4100);
  const method: PaymentMethod =
    methodRoll < 0.34 ? 'cash' : methodRoll < 0.62 ? 'qris' : methodRoll < 0.82 ? 'va' : 'ewallet';
  return {
    id: `INV-${ticket.id.slice(4)}`,
    ticket: ticket.id,
    createdAt: isoDaysAgo(Math.max(0, Math.floor((TODAY.getTime() - new Date(ticket.createdAt).getTime()) / DAY) - 1)),
    total: ticket.total,
    paid: seeded(index + 11) < 0.82,
    method,
  };
});

const _AUDIT: AuditEntry[] = [
  {
    id: 'AUD-1041',
    at: '11 Okt 2026, 14:26 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'payment.created',
    actionTone: 'emerald',
    entity: 'INV9041235580',
    entityType: 'invoice',
    summary: 'Pembayaran VA BNI Rp 965.000 ditandai lunas',
    before: 'status: unpaid',
    after: 'status: paid · method: va · cashier: Andra Wijaya',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1040',
    at: '11 Okt 2026, 13:48 WIB',
    actor: 'Dian Kusuma',
    role: 'Teknisi',
    action: 'ticket.status_changed',
    actionTone: 'sky',
    entity: 'SRV4829103756',
    entityType: 'tiket',
    summary: 'Pengecekan → Pengerjaan',
    before: 'current_status: pengecekan',
    after: 'current_status: pengerjaan',
    ip: '10.20.4.32',
  },
  {
    id: 'AUD-1039',
    at: '11 Okt 2026, 12:05 WIB',
    actor: 'Panendra Soma',
    role: 'Teknisi',
    action: 'quotation.approved',
    actionTone: 'emerald',
    entity: 'QUO-20260715-0185',
    entityType: 'quotation',
    summary: 'Pelanggan menyetujui biaya tambahan Rp 890.000 via WhatsApp',
    before: 'status: menunggu approval',
    after: 'status: disetujui · token dipakai sekali',
    ip: 'public-token',
  },
  {
    id: 'AUD-1038',
    at: '11 Okt 2026, 11:32 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'part.stock_adjusted',
    actionTone: 'amber',
    entity: 'PRT-020',
    entityType: 'part',
    summary: 'Penyesuaian stok akhir shift: 16 → 14 tube',
    before: 'stock: 16',
    after: 'stock: 14 · reason: pemakaian servis',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1037',
    at: '11 Okt 2026, 10:15 WIB',
    actor: 'Rina Oktaviani',
    role: 'Front Desk',
    action: 'ticket.created',
    actionTone: 'sky',
    entity: 'SRV7312049865',
    entityType: 'tiket',
    summary: 'Check-in walk-in, handover: drop-off',
    before: '—',
    after: 'current_status: antrian · sla: 120 menit',
    ip: '10.20.4.24',
  },
  {
    id: 'AUD-1036',
    at: '11 Okt 2026, 09:42 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'part.delete_blocked',
    actionTone: 'rose',
    entity: 'PRT-002',
    entityType: 'part',
    summary: 'Penghapusan ditolak sistem: punya riwayat mutasi',
    before: 'request: delete PRT-002',
    after: 'blocked by foreign key ticket_part_usages',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1035',
    at: '10 Okt 2026, 17:12 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'price.updated',
    actionTone: 'amber',
    entity: 'PRT-001',
    entityType: 'part',
    summary: 'Harga satuan LCD iPhone 13 Pro diperbarui',
    before: 'price: 1.650.000',
    after: 'price: 1.500.000 · alasan: harga distributor turun',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1034',
    at: '10 Okt 2026, 16:05 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'staff.role_changed',
    actionTone: 'rose',
    entity: 'STF-02',
    entityType: 'staff',
    summary: 'Peran Andhika Rai dinaikkan',
    before: 'role: frontdesk',
    after: 'role: teknisi · bench: micro-soldering',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1033',
    at: '10 Okt 2026, 14:20 WIB',
    actor: 'Fajar Nugroho',
    role: 'Teknisi',
    action: 'ticket.status_changed',
    actionTone: 'sky',
    entity: 'SRV6550183927',
    entityType: 'tiket',
    summary: 'Pengerjaan → Selesai, QC lolos',
    before: 'current_status: pengerjaan',
    after: 'current_status: selesai · turnaround: 1j 52m',
    ip: '10.20.4.41',
  },
  {
    id: 'AUD-1032',
    at: '10 Okt 2026, 11:28 WIB',
    actor: 'Rina Oktaviani',
    role: 'Front Desk',
    action: 'payment.created',
    actionTone: 'emerald',
    entity: 'INV6110294735',
    entityType: 'invoice',
    summary: 'Pembayaran tunai Rp 620.000',
    before: 'pending',
    after: 'status: paid · method: cash · change: Rp 30.000',
    ip: '10.20.4.24',
  },
  {
    id: 'AUD-1031',
    at: '10 Okt 2026, 09:04 WIB',
    actor: 'Sistem',
    role: 'Job',
    action: 'notification.sent',
    actionTone: 'stone',
    entity: 'SRV9041235580',
    entityType: 'tiket',
    summary: 'Nota digital dikirim ke WhatsApp pelanggan',
    before: 'attempt: 0',
    after: 'attempt: 1 · provider: meta-cloud-api',
    ip: 'job-worker',
  },
  {
    id: 'AUD-1030',
    at: '9 Okt 2026, 16:40 WIB',
    actor: 'Andra Wijaya',
    role: 'Admin',
    action: 'invoice.voided',
    actionTone: 'rose',
    entity: 'INV4829103756',
    entityType: 'invoice',
    summary: 'Void nota karena double input kasir',
    before: 'status: paid',
    after: 'status: void · refund: Rp 480.000',
    ip: '10.20.4.11',
  },
  {
    id: 'AUD-1029',
    at: '9 Okt 2026, 08:12 WIB',
    actor: 'anomali',
    role: 'Admin',
    action: 'auth.login_failed',
    actionTone: 'amber',
    entity: 'STF-03',
    entityType: 'auth',
    summary: '3 kali gagal login, akun dinonaktifkan otomatis',
    before: 'active: true',
    after: 'active: false · reason: brute force guard',
    ip: '103.28.14.7',
  },
  {
    id: 'AUD-1028',
    at: '8 Okt 2026, 11:48 WIB',
    actor: 'Budi Santoso',
    role: 'Teknisi',
    action: 'part.usage_recorded',
    actionTone: 'sky',
    entity: 'PRT-012',
    entityType: 'part',
    summary: 'Pemakaian IC power PM8150 untuk SRV5384072619',
    before: 'stock: 8',
    after: 'stock: 7 · qty: 1',
    ip: '10.20.4.52',
  },
];
void _AUDIT;
*/

/* Legacy local bucketing helpers are no longer used.
function bucketKey(iso: string, granularity: Granularity) {
  const date = new Date(iso);
  if (granularity === 'harian') return date.toISOString().slice(0, 10);
  if (granularity === 'mingguan') {
    const copy = new Date(date);
    const offset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - offset);
    return copy.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7);
}

function bucketLabel(key: string, granularity: Granularity) {
  if (granularity === 'bulanan') {
    return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${key}-01T00:00:00`));
  }
  const date = new Date(`${key}T00:00:00`);
  const day = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date);
  return granularity === 'mingguan' ? `Mg ${day}` : day;
}

function inRange(iso: string, from: number, to: number) {
  const time = new Date(iso).getTime();
  return time >= from && time <= to;
}
*/

function angka(value: number) { return new Intl.NumberFormat('id-ID').format(Math.round(value)); }
function rupiah(value: number) { return `Rp ${angka(value)}`; }
function compactRupiah(value: number) { return `Rp ${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`; }
function jam(value: number) { return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`; }

export default function ReportsPage() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const plan = useAuthStore((state) => state.user?.plan ?? 'starter');
  const isAdvance = plan.toLowerCase() === 'advance';

  const [tab, setTab] = useState<Tab>(tabFromUrl === 'audit' ? 'audit' : 'laporan');
  const [range, setRange] = useState<(typeof RANGES)[number]['key'] | 'custom'>('30d');
  const [granularity, setGranularity] = useState<Granularity>('harian');
  const [customFrom, setCustomFrom] = useState(new Date(TODAY.getTime() - 13 * DAY).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(TODAY.toISOString().slice(0, 10));
  const [branch, setBranch] = useState('Semua cabang');
  const [schedule, setSchedule] = useState(SCHEDULES[0]);

  const [auditAction, setAuditAction] = useState('Semua');
  const [auditActor, setAuditActor] = useState('Semua');
  const [auditEntity, setAuditEntity] = useState('Semua');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditFrom, setAuditFrom] = useState(new Date(TODAY.getTime() - 30 * DAY).toISOString().slice(0, 10));
  const [auditTo, setAuditTo] = useState(TODAY.toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<string | null>(null);

  const [generatedAt] = useState(() =>
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  );

  const windowRange = useMemo(() => {
    if (range === 'custom') {
      const from = new Date(`${customFrom}T00:00:00`).getTime();
      const to = new Date(`${customTo}T23:59:59`).getTime();
      return { from, to, length: Math.max(to - from, DAY) };
    }
    if (range === 'month') {
      const start = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).getTime();
      return { from: start, to: TODAY.getTime(), length: TODAY.getTime() - start };
    }
    const preset = RANGES.find((item) => item.key === range) ?? RANGES[1];
    const to = TODAY.getTime();
    if (preset.key === 'today') {
      const start = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()).getTime();
      return { from: start, to, length: DAY };
    }
    return { from: to - preset.days * DAY, to, length: preset.days * DAY };
  }, [range, customFrom, customTo]);

  const reportQuery = useQuery({
    queryKey: ['reports-dashboard', windowRange.from, windowRange.to, granularity, branch],
    queryFn: () => getReportsDashboard({ from: new Date(windowRange.from).toISOString(), to: new Date(windowRange.to).toISOString(), granularity, branch_id: branch }),
  });
  const auditDataQuery = useQuery({
    queryKey: ['reports-audit', auditQuery, auditAction, auditActor, auditEntity, auditFrom, auditTo, auditPage],
    queryFn: () => getReportsAudit({ search: auditQuery, action: auditAction, actor: auditActor, entity: auditEntity, from: auditFrom, to: auditTo, page: auditPage, limit: 25 }),
  });
  const emptyReport = { revenue: 0, prevRevenue: 0, receivable: 0, prevReceivable: 0, active: 0, prevActive: 0, done: 0, prevDone: 0, paidCount: 0, unpaidCount: 0, series: [], methodTotals: (['cash', 'qris', 'va', 'ewallet'] as PaymentMethod[]).map((method) => ({ method, total: 0 })), statusCounts: STATUS_ORDER.map((status) => ({ status, count: 0 })), topParts: [], techTotals: [], aging: [{ label: '0 – 7 hari', tone: 'bg-sky-500', count: 0, total: 0 }, { label: '8 – 30 hari', tone: 'bg-amber-500', count: 0, total: 0 }, { label: '> 30 hari', tone: 'bg-rose-500', count: 0, total: 0 }], invoices: [], tickets: [], totalTickets: 0 };

  /* Legacy local aggregation removed; API response is the sole report source.
  const legacyReport = useMemo(() => {
    const { from, to, length } = windowRange;
    const prevFrom = from - length;
    const prevTo = from - 1;

    const currentInvoices = INVOICES.filter((invoice) => inRange(invoice.createdAt, from, to));
    const prevInvoices = INVOICES.filter((invoice) => inRange(invoice.createdAt, prevFrom, prevTo));
    const currentTickets = TICKETS.filter((ticket) => inRange(ticket.createdAt, from, to));
    const prevTickets = TICKETS.filter((ticket) => inRange(ticket.createdAt, prevFrom, prevTo));

    const paid = currentInvoices.filter((invoice) => invoice.paid);
    const prevPaid = prevInvoices.filter((invoice) => invoice.paid);
    const unpaid = currentInvoices.filter((invoice) => !invoice.paid);
    const prevUnpaid = prevInvoices.filter((invoice) => !invoice.paid);

    const revenue = paid.reduce((sum, invoice) => sum + invoice.total, 0);
    const prevRevenue = prevPaid.reduce((sum, invoice) => sum + invoice.total, 0);
    const receivable = unpaid.reduce((sum, invoice) => sum + invoice.total, 0);
    const prevReceivable = prevUnpaid.reduce((sum, invoice) => sum + invoice.total, 0);

    const doneTickets = currentTickets.filter((ticket) => ticket.status === 'Selesai');
    const prevDoneTickets = prevTickets.filter((ticket) => ticket.status === 'Selesai');
    const activeTickets = currentTickets.filter((ticket) => ticket.status !== 'Selesai');
    const prevActiveTickets = prevTickets.filter((ticket) => ticket.status !== 'Selesai');

    const revenueBuckets = new Map<string, number>();
    paid.forEach((invoice) => {
      const key = bucketKey(invoice.createdAt, granularity);
      revenueBuckets.set(key, (revenueBuckets.get(key) ?? 0) + invoice.total);
    });
    const prevBuckets = new Map<string, number>();
    prevPaid.forEach((invoice) => {
      const key = bucketKey(invoice.createdAt, granularity);
      prevBuckets.set(key, (prevBuckets.get(key) ?? 0) + invoice.total);
    });

    const keys = Array.from(new Set([...revenueBuckets.keys(), ...prevBuckets.keys()])).sort();
    const series = keys.map((key) => ({
      label: bucketLabel(key, granularity),
      omzet: Math.round((revenueBuckets.get(key) ?? 0) / 1_000_000 * 10) / 10,
      sebelumnya: Math.round((prevBuckets.get(key) ?? 0) / 1_000_000 * 10) / 10,
    }));

    const methodTotals = (['cash', 'qris', 'va', 'ewallet'] as PaymentMethod[]).map((method) => ({
      method,
      total: paid.filter((invoice) => invoice.method === method).reduce((sum, invoice) => sum + invoice.total, 0),
    }));

    const statusCounts = STATUS_ORDER.map((status) => ({
      status,
      count: currentTickets.filter((ticket) => ticket.status === status).length,
    }));

    const partTotals = new Map<string, { qty: number; value: number }>();
    currentTickets.forEach((ticket) =>
      ticket.parts.forEach((part) => {
        const entry = partTotals.get(part.name) ?? { qty: 0, value: 0 };
        entry.qty += part.qty;
        entry.value += part.qty * part.price;
        partTotals.set(part.name, entry);
      })
    );
    const topParts = Array.from(partTotals.entries())
      .map(([name, entry]) => ({ name, ...entry }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const techTotals = TECHS.map((technician) => {
      const owned = doneTickets.filter((ticket) => ticket.technician === technician);
      const avgTurnaround = owned.length
        ? owned.reduce((sum, ticket) => sum + ticket.turnaroundMinutes, 0) / owned.length
        : 0;
      const slaMet = owned.filter((ticket) => ticket.turnaroundMinutes <= SLA_MINUTES).length;
      return {
        technician,
        done: owned.length,
        avgTurnaround,
        slaRate: owned.length ? Math.round((slaMet / owned.length) * 100) : 0,
      };
    }).sort((a, b) => b.done - a.done);

    const aging = [
      { label: '0 – 7 hari', tone: 'bg-sky-500' },
      { label: '8 – 30 hari', tone: 'bg-amber-500' },
      { label: '> 30 hari', tone: 'bg-rose-500' },
    ].map((bucket) => {
      const items = unpaid.filter((invoice) => {
        const age = (TODAY.getTime() - new Date(invoice.createdAt).getTime()) / DAY;
        if (bucket.label.startsWith('0')) return age <= 7;
        if (bucket.label.startsWith('8')) return age > 7 && age <= 30;
        return age > 30;
      });
      return { ...bucket, count: items.length, total: items.reduce((sum, invoice) => sum + invoice.total, 0) };
    });

    return {
      revenue,
      prevRevenue,
      receivable,
      prevReceivable,
      active: activeTickets.length,
      prevActive: prevActiveTickets.length,
      done: doneTickets.length,
      prevDone: prevDoneTickets.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      series,
      methodTotals,
      statusCounts,
      topParts,
      techTotals,
      aging,
      tickets: currentTickets,
      invoices: currentInvoices,
    };
  }, [windowRange, granularity]);
  */

  const report: any = reportQuery.data?.data ?? emptyReport;
  const auditActors: string[] = auditDataQuery.data?.actors ?? [];

  const auditRows: any[] = auditDataQuery.data?.data ?? [];

  const delta = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return { change, up: change >= 0 };
  };

  const exportCsv = () => {
    const lines =
      tab === 'laporan'
        ? [
            ['type', 'id', 'total', 'status'],
            ...report.invoices.map((invoice: any) => ['invoice', invoice.id, invoice.total, invoice.paid ? 'paid' : 'unpaid']),
            ...report.tickets.map((ticket: any) => ['ticket', ticket.id, ticket.total, ticket.status.toLowerCase()]),
          ]
        : [
            ['id', 'waktu', 'aktor', 'role', 'aksi', 'entitas', 'ringkasan', 'sebelum', 'sesudah', 'ip'],
            ...auditRows.map((entry) => [
              entry.id,
              entry.at,
              entry.actor,
              entry.role,
              entry.action,
              entry.entity,
              entry.summary,
              entry.before,
              entry.after,
              entry.ip,
            ]),
          ];
    const csv = lines.map((line) => line.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = tab === 'laporan' ? 'laporan-servitrack.csv' : 'audit-trail-servitrack.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel =
    range === 'custom'
      ? `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${customFrom}T00:00:00`))} – ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${customTo}T00:00:00`))}`
      : (RANGES.find((item) => item.key === range)?.label ?? '');

  const statCards = [
    {
      label: 'Omzet (nota lunas)',
      value: rupiah(report.revenue),
      caption: `${report.paidCount} nota lunas · periode ${rangeLabel}`,
      delta: delta(report.revenue, report.prevRevenue),
      icon: Money,
      tile: 'bg-emerald-50 text-emerald-600',
      invert: false,
    },
    {
      label: 'Piutang belum dibayar',
      value: rupiah(report.receivable),
      caption: `${report.unpaidCount} nota menunggu`,
      delta: delta(report.receivable, report.prevReceivable),
      icon: Receipt,
      tile: 'bg-amber-50 text-amber-700',
      invert: true,
    },
    {
      label: 'Tiket aktif',
      value: String(report.active),
      caption: 'Belum selesai / belum diambil',
      delta: delta(report.active, report.prevActive),
      icon: Hourglass,
      tile: 'bg-sky-100 text-sky-600',
      invert: true,
    },
    {
      label: 'Tiket selesai',
      value: String(report.done),
      caption: `Kepatuhan SLA ${SLA_MINUTES} menit dipantau per teknisi`,
      delta: delta(report.done, report.prevDone),
      icon: CheckCircle,
      tile: 'bg-purple-50 text-purple-700',
      invert: false,
    },
  ];

  const methodTotal = report.methodTotals.reduce((sum: number, item: any) => sum + item.total, 0) || 1;
  const statusTotal = report.statusCounts.reduce((sum: number, item: any) => sum + item.count, 0) || 1;

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="hidden print:block">
        <div className="flex items-start justify-between gap-6 border-b border-stone-300 pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ServiTrack" className="size-10 object-contain" />
            <span>
              <span className="block text-base font-bold text-neutral-900">ServiTrack Workshop</span>
              <span className="block text-xs text-stone-600">Jl. Radio Dalam Raya No. 42, Jakarta Selatan</span>
            </span>
          </div>
          <span className="text-right text-xs text-stone-600">
            <span className="block text-sm font-bold text-neutral-900">Laporan operasional &amp; keuangan</span>
            <span className="block">Rentang: {rangeLabel} · granularitas {granularity}</span>
            <span className="block">Digenerate {generatedAt} oleh Andra Wijaya (Admin)</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-neutral-900">Laporan &amp; Audit</h1>
          <p className="mt-0.5 text-xs leading-5 text-stone-600">
            Rekap omzet, piutang, beban teknisi, dan jejak audit aksi sensitif (ubah harga, hapus tiket, ubah stok, ubah
            role) dalam satu tempat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1.5 px-3 py-2 text-xs font-medium text-stone-600"
            onClick={exportCsv}
          >
            <DownloadSimple weight="bold" className="size-3.5 text-stone-600" /> Ekspor CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1.5 px-3 py-2 text-xs font-medium text-stone-600"
            onClick={() => window.print()}
          >
            <Printer weight="bold" className="size-3.5 text-stone-600" /> Cetak / PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-auto gap-1.5 px-3.5 py-2 text-xs font-semibold">
                <CalendarBlank weight="bold" className="size-3.5" /> Jadwalkan laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-stone-400">Kirim otomatis ke WhatsApp owner</DropdownMenuLabel>
              {SCHEDULES.map((option) => (
                <DropdownMenuItem key={option} onSelect={() => setSchedule(option)}>
                  <span className={cn('flex-1', schedule === option && 'font-bold text-sky-700')}>{option}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <p className="px-2.5 py-1.5 text-[11px] leading-4 text-stone-500">
                 Job laporan otomatis: {schedule}.
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-black/10 bg-stone-100 p-1 print:hidden">
        {(
          [
            { key: 'laporan', label: 'Laporan', count: report.invoices.length },
            { key: 'audit', label: 'Audit trail', count: auditDataQuery.data?.pagination?.total ?? 0 },
          ] as { key: Tab; label: string; count: number }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
              tab === item.key ? 'bg-white font-semibold text-neutral-900' : 'font-medium text-stone-600 hover:bg-white/60'
            )}
          >
            {item.label}
            <span
              className={cn(
                'text-[10px] font-normal tabular-nums',
                tab === item.key ? 'text-neutral-500' : 'text-neutral-400'
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'laporan' ? (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-3 lg:flex-row lg:items-center print:hidden">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-stone-100 p-1">
              {RANGES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  aria-pressed={range === option.key}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                    range === option.key
                      ? 'bg-white font-semibold text-neutral-900'
                      : 'font-medium text-stone-600 hover:bg-white/60'
                  )}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRange('custom')}
                aria-pressed={range === 'custom'}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                  range === 'custom'
                    ? 'bg-white font-semibold text-neutral-900'
                    : 'font-medium text-stone-600 hover:bg-white/60'
                )}
              >
                Kustom
              </button>
            </div>

            {range === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  aria-label="Tanggal mulai"
                  className="h-auto w-36 rounded-lg border-black/10 bg-white py-1.5 text-xs text-neutral-900 shadow-none"
                />
                <span className="text-xs text-stone-400">sampai</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  aria-label="Tanggal akhir"
                  className="h-auto w-36 rounded-lg border-black/10 bg-white py-1.5 text-xs text-neutral-900 shadow-none"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-stone-100 p-1">
              {GRANULARITIES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setGranularity(option.key)}
                  aria-pressed={granularity === option.key}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                    granularity === option.key
                      ? 'bg-white font-semibold text-neutral-900'
                      : 'font-medium text-stone-600 hover:bg-white/60'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {isAdvance ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      {branch}
                      <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {['Semua cabang', 'Radio Dalam', 'BSD Serpong'].map((option) => (
                      <DropdownMenuItem key={option} onSelect={() => setBranch(option)}>
                        <span className={cn('flex-1', branch === option && 'font-bold text-sky-700')}>{option}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Filter per cabang hanya tersedia di paket Advance"
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-500"
                >
                  <Lock weight="bold" className="size-3.5 text-amber-600" /> Cabang: semua (paket Advance)
                </button>
              )}
              <span className="text-xs leading-4">
                <span className="text-neutral-500">Filter aktif: </span>
                <span className="font-bold text-zinc-900">
                  {rangeLabel} · {granularity}
                  {isAdvance && branch !== 'Semua cabang' ? ` · ${branch}` : ''}
                </span>
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              const good = card.delta ? (card.invert ? !card.delta.up : card.delta.up) : true;
              return (
                <div
                  key={card.label}
                  className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 break-inside-avoid"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">
                      {card.label}
                    </span>
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', card.tile)}>
                      <Icon weight="bold" className="size-4" />
                    </span>
                  </div>
                  <p className="text-2xl font-bold leading-8 tabular-nums text-neutral-900">{card.value}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {card.delta && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                          good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        )}
                        title={card.invert ? (card.delta.up ? 'Beban antrean naik' : 'Beban antrean turun') : undefined}
                      >
                        {card.delta.up ? (
                          <TrendUp weight="bold" className="size-3" />
                        ) : (
                          <TrendDown weight="bold" className="size-3" />
                        )}
                        {card.delta.change >= 0 ? '+' : ''}
                        {card.delta.change.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% vs periode lalu
                      </span>
                    )}
                    <span className="text-[11px] leading-4 text-stone-500">{card.caption}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5 break-inside-avoid">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold leading-5 text-neutral-900">Tren omzet</h2>
                <p className="mt-0.5 text-xs leading-5 text-stone-600">
                  Nilai nota berstatus lunas per {granularity} · grafik putus-putus = periode sebelumnya ({rangeLabel})
                </p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700">
                Total {compactRupiah(report.revenue)}
              </span>
            </div>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e7e5e4" strokeDasharray="4 6" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={{ stroke: '#e7e5e4' }}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#78716c', fontWeight: 600 }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    width={44}
                    tickFormatter={(value: number) => `${value} jt`}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    formatter={(value) => `Rp ${angka(Number(value) * 1_000_000)}`}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e7e5e4',
                      boxShadow: '0 8px 20px -12px rgba(28,25,23,0.35)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sebelumnya"
                    stroke="#a8a29e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="omzet"
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#ffffff', stroke: '#0284c7', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-black/5 pt-3 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-sky-600" /> Periode ini
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-stone-300" /> Periode sebelumnya
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-5 break-inside-avoid">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Komposisi metode pembayaran</h2>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">Hanya nota lunas pada periode terpilih</p>
              <ul className="mt-4 flex flex-col gap-3">
                {report.methodTotals.map((item: any) => {
                  const meta = METHOD_META[item.method as PaymentMethod];
                  const Icon = meta.icon;
                  const share = Math.round((item.total / methodTotal) * 100);
                  return (
                    <li key={item.method}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                          <span className={cn('flex size-6 items-center justify-center rounded-md text-white', meta.tone)}>
                            <Icon weight="fill" className="size-3.5" />
                          </span>
                          {meta.label}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-neutral-900">
                          {rupiah(item.total)} <span className="font-medium text-stone-500">· {share}%</span>
                        </span>
                      </div>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <span className={cn('block h-full rounded-full', meta.tone)} style={{ width: `${share}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-5 break-inside-avoid">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Sebaran status tiket</h2>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">
                {report.tickets.length} tiket dibuat pada periode terpilih
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                {report.statusCounts.map((item: any) => (
                  <li key={item.status}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-600">{item.status}</span>
                      <span className="text-sm font-bold tabular-nums text-neutral-900">{item.count}</span>
                    </div>
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <span
                        className={cn('block h-full rounded-full', STATUS_BAR[item.status as TicketStatus])}
                        style={{ width: `${Math.round((item.count / statusTotal) * 100)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white p-5 break-inside-avoid">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold leading-5 text-neutral-900">Suku cadang terlaris</h2>
                  <p className="mt-0.5 text-xs leading-5 text-stone-600">Top 5 berdasarkan quantity terpakai</p>
                </div>
                <Package weight="fill" className="size-4 text-stone-400" />
              </div>
              <ul className="mt-3 border-t border-black/5">
                {report.topParts.map((part: any, index: number) => (
                  <li key={part.name} className="flex items-center gap-3 border-b border-black/5 py-2.5 last:border-b-0">
                    <span className="w-4 text-xs font-bold tabular-nums text-stone-400">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-900">{part.name}</span>
                      <span className="block text-[11px] tabular-nums text-stone-500">{part.qty} unit terpakai</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-neutral-900">
                      {rupiah(part.value)}
                    </span>
                  </li>
                ))}
                {report.topParts.length === 0 && (
                  <li className="py-6 text-center text-xs text-stone-500">Belum ada pemakaian part pada periode ini.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-5 break-inside-avoid">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold leading-5 text-neutral-900">Kinerja teknisi</h2>
                  <p className="mt-0.5 text-xs leading-5 text-stone-600">
                    Tiket selesai, rata-rata turnaround, kepatuhan SLA {SLA_MINUTES} menit
                  </p>
                </div>
                <UserCircleCheck weight="fill" className="size-4 text-stone-400" />
              </div>
              <ul className="mt-3 border-t border-black/5">
                {report.techTotals.map((tech: any) => (
                  <li key={tech.technician} className="flex items-center gap-3 border-b border-black/5 py-2.5 last:border-b-0">
                    <UserAvatar
                      seed={tech.technician}
                      initials={initialsOf(tech.technician)}
                      alt={`Avatar ${tech.technician}`}
                      className="size-7"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-900">{tech.technician}</span>
                      <span className="block text-[11px] tabular-nums text-stone-500">
                        {tech.done} tiket · rata-rata {tech.done ? jam(tech.avgTurnaround / 60) : '—'}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                        tech.slaRate >= 80
                          ? 'bg-emerald-50 text-emerald-700'
                          : tech.slaRate >= 60
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-red-700'
                      )}
                    >
                      SLA {tech.slaRate}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 print:grid-cols-12">
            <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-7 break-inside-avoid">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Aging piutang</h2>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">
                Umur nota yang belum dibayar — dasar penagihan bertingkat
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {report.aging.map((bucket: any) => (
                  <li
                    key={bucket.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-stone-50/70 px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                      <span className={cn('size-2 rounded-full', bucket.tone)} aria-hidden="true" />
                      {bucket.label}
                    </span>
                    <span className="text-xs tabular-nums text-stone-600">
                      {bucket.count} nota · <span className="font-bold text-neutral-900">{rupiah(bucket.total)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-4 text-stone-500">
                Kirim pengingat WhatsApp bertingkat: H+3, H+10, lalu eskalasi ke owner saat lewat 30 hari.
              </p>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-5 lg:col-span-5 print:hidden">
              <h2 className="text-sm font-bold leading-5 text-neutral-900">Jadwal laporan otomatis</h2>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">
                Job backend membuat laporan lalu mengirimkannya ke owner
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {SCHEDULES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSchedule(option)}
                    aria-pressed={schedule === option}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                      schedule === option
                        ? 'border-sky-300 bg-sky-50/70 font-semibold text-neutral-900'
                        : 'border-black/10 bg-white font-medium text-stone-600 hover:bg-stone-50'
                    )}
                  >
                    {option}
                    {schedule === option && <CheckCircle weight="fill" className="size-4 text-sky-600" />}
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-[11px] leading-4 text-stone-500">
                Penerima belum dikonfigurasi.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="leading-5 text-stone-600">
              <span className="font-bold text-neutral-900">Sumber data:</span> {report.invoices.length} nota &{' '}
               {report.tickets.length} tiket pada rentang {rangeLabel} · diperbarui pada {generatedAt}
            </span>
            <span className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" size="sm" className="h-auto px-3 py-1.5 text-xs" onClick={exportCsv}>
                <DownloadSimple weight="bold" className="size-3.5" /> Ekspor CSV
              </Button>
              <Button variant="outline" size="sm" className="h-auto px-3 py-1.5 text-xs" onClick={() => window.print()}>
                <Printer weight="bold" className="size-3.5" /> Cetak / PDF
              </Button>
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-3 lg:flex-row lg:items-center print:hidden">
            <div className="relative w-full lg:max-w-72">
              <MagnifyingGlass
                weight="bold"
                className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-500"
              />
              <Input
                type="search"
                value={auditQuery}
                onChange={(event) => { setAuditQuery(event.target.value); setAuditPage(1); }}
                aria-label="Cari aktivitas audit"
                placeholder="Cari aktor, entitas, atau aksi..."
                className="h-auto rounded-lg border-black/10 bg-stone-100 py-1.5 pl-9 pr-3 text-xs text-neutral-900 caret-sky-600 shadow-none placeholder:text-stone-400 focus-visible:border-sky-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={auditFrom} onChange={(event) => { setAuditFrom(event.target.value); setAuditPage(1); }} aria-label="Audit dari tanggal" className="h-auto w-32 rounded-lg border-black/10 bg-stone-100 py-1.5 text-xs shadow-none" />
              <Input type="date" value={auditTo} onChange={(event) => { setAuditTo(event.target.value); setAuditPage(1); }} aria-label="Audit sampai tanggal" className="h-auto w-32 rounded-lg border-black/10 bg-stone-100 py-1.5 text-xs shadow-none" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {auditAction === 'Semua' ? 'Semua jenis aksi' : `Aksi ${auditAction}`}
                    <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel className="text-stone-400">Jenis aksi</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => { setAuditAction('Semua'); setAuditPage(1); }}>
                    <span className={cn('flex-1', auditAction === 'Semua' && 'font-bold text-sky-700')}>
                      Semua jenis aksi
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(auditDataQuery.data?.actions ?? []).map((action: string) => (
                    <DropdownMenuItem key={action} onSelect={() => { setAuditAction(action); setAuditPage(1); }}>
                      <span className={cn('flex-1', auditAction === action && 'font-bold text-sky-700')}>{action}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {auditActor === 'Semua' ? 'Semua aktor' : auditActor}
                    <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel className="text-stone-400">Aktor</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => { setAuditActor('Semua'); setAuditPage(1); }}>
                    <span className={cn('flex-1', auditActor === 'Semua' && 'font-bold text-sky-700')}>
                      Semua aktor
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                        {auditActors.map((actor: string) => (
                    <DropdownMenuItem key={actor} onSelect={() => { setAuditActor(actor); setAuditPage(1); }}>
                      <span className={cn('flex-1', auditActor === actor && 'font-bold text-sky-700')}>{actor}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700"><span>{auditEntity === 'Semua' ? 'Semua entitas' : auditEntity}</span><CaretDown weight="bold" className="size-3.5 text-neutral-500" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52"><DropdownMenuLabel className="text-stone-400">Entitas</DropdownMenuLabel><DropdownMenuItem onSelect={() => { setAuditEntity('Semua'); setAuditPage(1); }}>Semua entitas</DropdownMenuItem>{(auditDataQuery.data?.options ?? []).map((option: any) => <DropdownMenuItem key={option.entity_type} onSelect={() => { setAuditEntity(option.entity_type); setAuditPage(1); }}>{option.entity_type}</DropdownMenuItem>)}</DropdownMenuContent>
              </DropdownMenu>

              <span className="text-xs leading-4">
                <span className="text-neutral-500">Filter aktif: </span>
                <span className="font-bold text-zinc-900">
                  {[auditAction !== 'Semua' ? `aksi ${auditAction}` : null, auditActor !== 'Semua' ? auditActor : null, auditEntity !== 'Semua' ? auditEntity : null]
                    .filter(Boolean)
                    .join(' · ') || 'Semua'}
                </span>
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 px-3 py-1.5 text-xs lg:ml-auto"
              onClick={exportCsv}
            >
              <DownloadSimple weight="bold" className="size-3.5" /> Ekspor audit CSV
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <ShieldCheck weight="bold" className="size-3.5" />
            </span>
            <p className="text-xs leading-4 text-neutral-500">
              <span className="font-bold text-neutral-900">Jejak audit tidak dapat dihapus.</span> Aksi sensitif (ubah
              harga, hapus tiket, ubah stok, ubah role) dicatat otomatis bersama aktor, sebelum → sesudah, dan alamat IP.
              Penghapusan master data yang punya riwayat mutasi tetap diblokir foreign key{' '}
              <span className="font-mono">ticket_part_usages</span>.
            </p>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
              <div className="ledger-scroll overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left">
                  <caption className="sr-only">Jejak audit aksi sensitif pada tenant ini</caption>
                  <thead>
                    <tr className="border-b border-black/5 bg-stone-50">
                      <th scope="col" className="px-5 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Waktu
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Aktor
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Aksi
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Entitas
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Ringkasan
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                        {auditRows.map((entry) => {
                      const isOpen = expanded === entry.id;
                      return (
                        <Fragment key={entry.id}>
                          <tr className="border-t border-neutral-100 transition-colors hover:bg-sky-50/40">
                            <td className="whitespace-nowrap px-5 py-3.5 text-xs tabular-nums text-stone-600">
                              {entry.at}
                              <span className="mt-0.5 block font-mono text-[11px] text-stone-400">{entry.ip}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="flex items-center gap-2">
                                {entry.actor === 'Sistem' ? (
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600">
                                    <ClockCounterClockwise weight="fill" className="size-3.5" />
                                  </span>
                                ) : (
                                  <UserAvatar
                                    seed={entry.actor}
                                    initials={initialsOf(entry.actor)}
                                    alt={`Avatar ${entry.actor}`}
                                    className="size-7"
                                  />
                                )}
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-semibold text-neutral-900">
                                    {entry.actor}
                                  </span>
                                  <span className="block text-[11px] text-stone-500">{entry.role}</span>
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={cn(
                                  'inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-semibold',
                                   ACTION_TONE[entry.actionTone as AuditEntry['actionTone']]
                                )}
                              >
                                {entry.action}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="block font-mono text-xs font-semibold text-sky-700">{entry.entity}</span>
                              <span className="block text-[11px] capitalize text-stone-500">{entry.entityType}</span>
                            </td>
                            <td className="px-4 py-3.5 text-xs leading-5 text-stone-700">{entry.summary}</td>
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={isOpen}
                                aria-label={`Detail ${entry.id}`}
                                onClick={() => setExpanded(isOpen ? null : entry.id)}
                                className="h-auto gap-1 px-2 py-1 text-xs text-sky-700"
                              >
                                {isOpen ? 'Tutup' : 'Lihat'}
                                <CaretDown
                                  weight="bold"
                                  className={cn('size-3 transition-transform', isOpen && 'rotate-180')}
                                />
                              </Button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-t border-neutral-100 bg-stone-50/60">
                              <td colSpan={6} className="px-5 py-4">
                                <div className="grid gap-3 text-xs sm:grid-cols-3">
                                  <div>
                                    <span className="block text-stone-500">ID audit</span>
                                    <span className="block font-mono font-semibold text-neutral-900">{entry.id}</span>
                                  </div>
                                  <div>
                                    <span className="block text-stone-500">Sebelum</span>
                                    <span className="block font-mono text-neutral-900">{entry.before}</span>
                                  </div>
                                  <div>
                                    <span className="block text-stone-500">Sesudah</span>
                                    <span className="block font-mono text-neutral-900">{entry.after}</span>
                                  </div>
                                </div>
                                <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-4 text-stone-500">
                                  <WarningCircle weight="bold" className="size-3.5 text-amber-600" />
                                  Baris ini tidak dapat disunting atau dihapus; retensi minimal 24 bulan.
                                </p>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {auditRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center">
                          <span className="block text-sm font-semibold text-neutral-900">
                            Tidak ada aktivitas yang cocok
                          </span>
                          <span className="mt-1 block text-xs text-stone-500">
                            Longgarkan filter aksi/aktor atau kosongkan kata kunci pencarian.
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                               setAuditQuery('');
                               setAuditAction('Semua');
                               setAuditActor('Semua');
                               setAuditEntity('Semua');
                               setAuditPage(1);
                            }}
                          >
                            Reset filter
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-3 md:flex-row md:items-center md:justify-between">
                <span className="text-xs leading-4 text-stone-600">
                  Menampilkan{' '}
                  <span className="tabular-nums text-neutral-900">
                     {auditRows.length ? ((auditDataQuery.data?.pagination?.page ?? 1) - 1) * (auditDataQuery.data?.pagination?.limit ?? 25) + 1 : 0} - {((auditDataQuery.data?.pagination?.page ?? 1) - 1) * (auditDataQuery.data?.pagination?.limit ?? 25) + auditRows.length}
                  </span>{' '}
                   dari <span className="tabular-nums text-neutral-900">{auditDataQuery.data?.pagination?.total ?? 0}</span> aktivitas
                </span>
                <div className="flex items-center gap-1.5">
                   <Button variant="secondary" size="sm" disabled={(auditDataQuery.data?.pagination?.page ?? 1) <= 1 || auditDataQuery.isLoading} onClick={() => setAuditPage((value) => value - 1)} className="h-auto px-2.5 py-1 text-xs font-normal text-neutral-400">
                    <CaretLeft weight="bold" className="size-3.5" /> Sebelumnya
                  </Button>
                  <span className="flex items-center rounded-sm bg-sky-600 px-2.5 py-1 text-xs font-medium text-white outline outline-1 outline-sky-600">
                     {auditDataQuery.data?.pagination?.page ?? 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                     disabled={(auditDataQuery.data?.pagination?.page ?? 1) >= (auditDataQuery.data?.pagination?.totalPages ?? 1) || auditDataQuery.isLoading}
                     onClick={() => setAuditPage((value) => value + 1)}
                     title={`Halaman ${auditDataQuery.data?.pagination?.page ?? 1} dari ${auditDataQuery.data?.pagination?.totalPages ?? 1}`}
                    className="h-auto px-2.5 py-1 text-xs font-normal text-neutral-400"
                  >
                    Selanjutnya <CaretRight weight="bold" className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-4 text-xs">
            <p className="leading-5 text-stone-600">
              <span className="font-bold text-neutral-900">Kontrak API:</span>{' '}
              <span className="font-mono">GET /reports/dashboard</span> (revenue, unpaid, active, done, topParts) dan{' '}
              <span className="font-mono">GET /reports/export?format=csv</span> · akses Admin. Data pada halaman ini
              menggunakan data agregasi database sesuai filter aktif.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
