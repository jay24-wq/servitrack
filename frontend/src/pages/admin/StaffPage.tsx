import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlass,
  ClockCounterClockwise,
  DownloadSimple,
  Plus,
  CaretDown,
  CaretLeft,
  CaretRight,
  PencilSimple,
  Trash,
  Power,
  WhatsappLogo,
  Check,
  X,
  UserCircleCheck,
  Wrench,
  Headset,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { UserAvatar } from '../../components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { initialsOf } from '../../lib/avatar';
import { createStaff, getStaff, updateStaff } from '../../lib/api';
import { useAuthStore } from '../../store';
import TambahStaffModal from './TambahStaffModal';

type Role = 'Admin' | 'Teknisi' | 'Front Desk' | 'Kurir';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  whatsapp: string;
  whatsappNote?: string;
  owner?: boolean;
  active: boolean;
}

const ROLE_STYLE: Record<Role, string> = {
  Admin: 'bg-sky-100 text-sky-600',
  Teknisi: 'bg-amber-100 text-amber-700',
  'Front Desk': 'bg-purple-100 text-purple-800',
  Kurir: 'bg-emerald-100 text-emerald-700',
};

const ROLES: Role[] = ['Admin', 'Teknisi', 'Front Desk', 'Kurir'];

const SORTS = [
  { key: 'nama-asc', label: 'Nama (A-Z)' },
  { key: 'nama-desc', label: 'Nama (Z-A)' },
  { key: 'peran', label: 'Peran' },
  { key: 'status', label: 'Status akun' },
] as const;

const STAT_CARDS: { label: string; key: Role | 'aktif'; icon: Icon; tile: string; note: string; dot: string }[] = [
  { label: 'Total admin', key: 'Admin', icon: UserCircleCheck, tile: 'bg-sky-100 text-sky-600', note: 'Full operational privileges', dot: 'bg-sky-600' },
  { label: 'Total teknisi', key: 'Teknisi', icon: Wrench, tile: 'bg-amber-100 text-amber-700', note: 'Semua bench aktif bertugas', dot: 'bg-amber-500' },
  { label: 'Total frontdesk', key: 'Front Desk', icon: Headset, tile: 'bg-purple-100 text-purple-800', note: 'Intake & kasir counter', dot: 'bg-purple-500' },
  { label: 'Total kurir', key: 'Kurir', icon: UsersThree, tile: 'bg-emerald-50 text-emerald-600', note: 'Operasional antar-jemput', dot: 'bg-emerald-500' },
  { label: 'Staff aktif', key: 'aktif', icon: UsersThree, tile: 'bg-emerald-50 text-emerald-600', note: 'Akun aktif bertugas', dot: 'bg-neutral-400' },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [roleTab, setRoleTab] = useState<Role | 'Semua'>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Non-aktif'>('Semua');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('nama-asc');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftWhatsapp, setDraftWhatsapp] = useState('');

  const roleParam = roleTab === 'Semua' ? 'all' : roleTab === 'Teknisi' ? 'technician' : roleTab === 'Front Desk' ? 'frontdesk' : roleTab.toLowerCase();
  const statusParam = statusFilter === 'Semua' ? 'all' : statusFilter === 'Aktif' ? 'active' : 'inactive';
  const { data: response, isLoading } = useQuery({
    queryKey: ['staff', roleParam, statusParam, query, sort, page],
    queryFn: () => getStaff({ role: roleParam, status: statusParam, search: query, sort, page, limit: 10 }),
  });
  const stats = response?.stats ?? { admin: 0, teknisi: 0, frontdesk: 0, kurir: 0, active: 0, inactive: 0 };
  const pagination = response?.pagination ?? { page: 1, total: 0, totalPages: 1 };
  const roleLabels: Record<string, Role> = { admin: 'Admin', teknisi: 'Teknisi', frontdesk: 'Front Desk', kurir: 'Kurir' };
  const staff: Staff[] = (response?.data ?? []).map((member: any) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: roleLabels[member.role] ?? 'Front Desk',
    whatsapp: member.phone || '',
    active: Boolean(member.is_active),
  }));
  const counts = { Semua: stats.admin + stats.teknisi + stats.frontdesk + stats.kurir, Admin: stats.admin, Teknisi: stats.teknisi, 'Front Desk': stats.frontdesk, Kurir: stats.kurir };
  const activeCount = stats.active;
  const inactiveCount = stats.inactive;
  const activeRatio = activeCount + inactiveCount ? Math.round((activeCount / (activeCount + inactiveCount)) * 1000) / 10 : 0;

  const statValue = (key: Role | 'aktif') => (key === 'aktif' ? activeCount : counts[key]);
  const statHint = (key: Role | 'aktif') =>
    key === 'aktif'
      ? `${activeRatio}% rasio`
      : key === 'Admin'
        ? 'Akun terdaftar'
        : key === 'Teknisi'
          ? 'Di workshop'
          : 'Customer service';

  const rows = staff;

  const exportCsv = () => {
    const header = ['ID', 'Nama', 'Email', 'Peran', 'No. WhatsApp', 'Status akun'];
    const body = rows.map((member) => [
      member.id,
      member.name,
      member.email,
      member.role,
      member.whatsapp || member.whatsappNote || 'Belum terhubung',
      member.active ? 'Aktif' : 'Non-aktif',
    ]);
    const csv = [header, ...body].map((line) => line.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'staf-servitrack.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (member: Staff) => {
    setEditingId(member.id);
    setDraftWhatsapp(member.whatsapp);
  };

  const saveWhatsapp = async (id: string) => {
    await updateStaff(id, { phone: draftWhatsapp.trim() || null });
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  return (
    <div className="page-enter flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-bold leading-8 tracking-tight text-neutral-900">Manajemen Pengguna</h1>
          <p className="mt-0.5 text-xs leading-5 text-stone-600">
            Kelola hak akses role, penugasan teknisi bench, nomor kontak WhatsApp operasional, dan status akun staf
            workshop.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1.5 px-3 py-2 text-xs font-medium text-stone-600"
            asChild
          >
            <a href="/reports?tab=audit">
              <ClockCounterClockwise weight="bold" className="size-3.5 text-stone-600" /> Riwayat aktivitas
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-auto gap-1.5 px-3 py-2 text-xs font-medium text-stone-600"
          >
            <DownloadSimple weight="bold" className="size-3.5 text-stone-600" /> Ekspor data
          </Button>
          <Button size="sm" className="h-auto gap-1.5 px-3.5 py-2 text-xs font-semibold" onClick={() => setShowAddModal(true)}>
            <Plus weight="bold" className="size-3.5" /> Tambah staff baru
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const note =
            card.key === 'aktif'
              ? inactiveCount === 0
                ? 'Semua akun aktif bertugas'
                : `${inactiveCount} akun saat ini non-aktif`
              : card.note;
          return (
            <div
              key={card.label}
              className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-white p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase leading-4 tracking-wide text-neutral-500">
                  {card.label}
                </span>
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold leading-8 tabular-nums text-neutral-900">
                    {statValue(card.key)}
                  </span>
                  <span
                    className={cn(
                      'text-xs leading-4',
                      card.key === 'aktif' ? 'font-medium text-emerald-600' : 'font-normal text-stone-600'
                    )}
                  >
                    {statHint(card.key)}
                  </span>
                </p>
                <span className="flex items-center gap-1 pt-0.5">
                  <span className={cn('size-1.5 rounded-full', card.dot)} aria-hidden="true" />
                  <span className="text-xs font-normal leading-4 text-neutral-500">{note}</span>
                </span>
              </div>
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', card.tile)}>
                <Icon weight="bold" className="size-4" />
              </span>
            </div>
          );
        })}
      </div>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <div className="ledger-scroll flex flex-col gap-3 border-b border-black/5 p-4 lg:flex-row lg:items-center lg:justify-between lg:overflow-visible">
            <div className="flex w-max max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-black/10 bg-stone-100 p-1">
              {(['Semua', ...ROLES] as (Role | 'Semua')[]).map((tab) => {
                const isActive = roleTab === tab;
                const label = tab === 'Front Desk' ? 'Front desk' : tab;
                return (
                  <button
                    key={tab}
                    type="button"
                     onClick={() => { setRoleTab(tab); setPage(1); }}
                    aria-pressed={isActive}
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-md px-3 py-1 text-xs leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                      isActive ? 'bg-white font-semibold text-neutral-900' : 'font-medium text-stone-600 hover:bg-white/60'
                    )}
                  >
                    {label}
                    <span className={cn('text-[10px] font-normal tabular-nums', isActive ? 'text-neutral-500' : 'text-neutral-400')}>
                      {counts[tab]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-48">
                <MagnifyingGlass
                  weight="bold"
                  className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                  aria-label="Cari staf dalam daftar"
                  placeholder="Cari dalam daftar..."
                  className="h-auto rounded-lg border-black/10 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 caret-sky-600 shadow-none placeholder:text-neutral-400 focus-visible:border-sky-500"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-normal text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {statusFilter === 'Semua' ? 'Semua status' : `Status ${statusFilter.toLowerCase()}`}
                    <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-stone-400">Status akun</DropdownMenuLabel>
                  {(['Semua', 'Aktif', 'Non-aktif'] as const).map((option) => (
                    <DropdownMenuItem key={option} onSelect={() => { setStatusFilter(option); setPage(1); }}>
                      <span className={cn('flex-1', statusFilter === option && 'font-bold text-sky-700')}>
                        {option === 'Semua' ? 'Semua status' : option}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-normal leading-4 text-neutral-400">Urutkan:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      {SORTS.find((item) => item.key === sort)?.label}
                      <CaretDown weight="bold" className="size-3.5 text-neutral-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {SORTS.map((item) => (
                      <DropdownMenuItem key={item.key} onSelect={() => { setSort(item.key); setPage(1); }}>
                        <span className={cn('flex-1', sort === item.key && 'font-bold text-sky-700')}>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="ledger-scroll overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <caption className="sr-only">
                Daftar staf workshop dengan peran, nomor WhatsApp operasional, dan status akun
              </caption>
              <thead>
                <tr className="border-b border-black/5 bg-stone-50">
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500 max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-stone-50 max-lg:shadow-[inset_-1px_0_0_0_#e7e5e4]"
                  >
                    Nama staff &amp; email
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                    Peran (role)
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                    No. WhatsApp operasional
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                    Status akun
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase leading-4 tracking-wide text-neutral-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-xs text-neutral-500">Memuat data staff...</td></tr>
                )}
                {rows.map((member) => {
                  const inactive = !member.active;
                  const editing = editingId === member.id;
                  return (
                    <tr
                      key={member.id}
                      className={cn(
                        'border-t border-neutral-100 transition-colors',
                        inactive ? 'bg-neutral-50/40' : 'hover:bg-sky-50/40'
                      )}
                    >
                      <td
                        className={cn(
                          'px-5 py-4 max-lg:sticky max-lg:left-0 max-lg:z-[1] max-lg:shadow-[inset_-1px_0_0_0_#e7e5e4]',
                          inactive ? 'max-lg:bg-[#fafafa]' : 'max-lg:bg-white'
                        )}
                      >
                        <span className="flex items-center">
                          <UserAvatar
                            seed={member.email}
                            initials={initialsOf(member.name)}
                            alt={`Avatar ${member.name}`}
                            className={cn('size-9', inactive && 'opacity-70')}
                          />
                          <span className="pl-3">
                            <span
                              className={cn(
                                'block text-xs font-semibold leading-4',
                                inactive ? 'text-neutral-600' : 'text-neutral-900'
                              )}
                            >
                              {member.name}
                            </span>
                            <span
                              className={cn(
                                'block text-xs font-normal leading-4',
                                inactive ? 'text-neutral-400' : 'text-neutral-500'
                              )}
                            >
                              {member.email}
                            </span>
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs',
                            inactive
                              ? 'bg-neutral-100 font-semibold text-neutral-600'
                              : cn('font-semibold', ROLE_STYLE[member.role])
                          )}
                        >
                          {member.role.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {editing ? (
                          <span className="flex items-center gap-1.5">
                            <Input
                              value={draftWhatsapp}
                              onChange={(event) => setDraftWhatsapp(event.target.value)}
                              inputMode="tel"
                              aria-label={`Nomor WhatsApp ${member.name}`}
                              placeholder="08xxxxxxxxxx"
                              className="h-auto w-36 rounded-lg border-black/10 bg-white py-1 pl-2.5 pr-2 font-mono text-xs text-neutral-900 caret-sky-600 shadow-none focus-visible:border-sky-500"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Simpan nomor ${member.name}`}
                              onClick={() => saveWhatsapp(member.id)}
                              className="size-7 text-emerald-600 hover:bg-emerald-50"
                            >
                              <Check weight="bold" className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Batal mengubah ${member.name}`}
                              onClick={() => setEditingId(null)}
                              className="size-7 text-neutral-500 hover:bg-stone-100"
                            >
                              <X weight="bold" className="size-3.5" />
                            </Button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'font-mono text-xs font-normal leading-4',
                                member.whatsapp
                                  ? inactive
                                    ? 'text-neutral-500'
                                    : 'text-neutral-900'
                                  : 'text-neutral-400'
                              )}
                            >
                              {member.whatsapp || `— (${member.whatsappNote ?? 'Belum terhubung'})`}
                            </span>
                            {member.whatsapp ? (
                              <WhatsappLogo
                                weight="fill"
                                className="size-3.5 text-emerald-600"
                                aria-label="Nomor terhubung ke WhatsApp Business"
                              />
                            ) : null}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs',
                            member.active
                              ? 'bg-emerald-50 font-medium text-emerald-600'
                              : 'bg-neutral-100 font-medium text-neutral-500'
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              member.active ? 'bg-emerald-600' : 'bg-neutral-400'
                            )}
                            aria-hidden="true"
                          />
                          {member.active ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                             aria-label={`Ubah nomor WhatsApp ${member.name}`}
                            onClick={() => startEdit(member)}
                            className="size-8 rounded-md text-stone-600 hover:bg-stone-100"
                          >
                            <PencilSimple weight="bold" className="size-3.5" />
                          </Button>

                          {member.active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                               aria-label={member.id === currentUser?.id ? 'Akun sendiri tidak dapat dinonaktifkan' : `Nonaktifkan ${member.name}`}
                               title={member.id === currentUser?.id ? 'Akun sendiri tidak dapat dinonaktifkan' : 'Nonaktifkan staf'}
                               disabled={member.id === currentUser?.id}
                               onClick={async () => { if (window.confirm(`Nonaktifkan ${member.name}?`)) { await updateStaff(member.id, { is_active: false }); queryClient.invalidateQueries({ queryKey: ['staff'] }); } }}
                              className="size-8 rounded-md text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash weight="bold" className="size-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Aktifkan kembali akun ${member.name}`}
                              title="Aktifkan kembali akun"
                               onClick={async () => { await updateStaff(member.id, { is_active: true }); queryClient.invalidateQueries({ queryKey: ['staff'] }); }}
                              className="size-8 rounded-md text-emerald-600 hover:bg-emerald-50"
                            >
                              <Power weight="bold" className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {pagination.total === 0 && !query && roleTab === 'Semua' && statusFilter === 'Semua' ? 'Belum ada staff terdaftar' : 'Tidak ada staf yang cocok dengan filter ini'}
                      </span>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {pagination.total === 0 && !query && roleTab === 'Semua' && statusFilter === 'Semua' ? 'Tambahkan staff pertama untuk mulai mengelola akses workshop.' : 'Coba pilih peran lain atau kosongkan kata kunci pencarian.'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          if (pagination.total === 0 && !query && roleTab === 'Semua' && statusFilter === 'Semua') { setShowAddModal(true); return; }
                          setQuery('');
                          setRoleTab('Semua');
                           setStatusFilter('Semua');
                          setPage(1);
                        }}
                      >
                        {pagination.total === 0 && !query && roleTab === 'Semua' && statusFilter === 'Semua' ? 'Tambah Staff' : 'Reset filter'}
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
               <span className="tabular-nums text-neutral-900">{rows.length ? `${(pagination.page - 1) * pagination.limit + 1} - ${(pagination.page - 1) * pagination.limit + rows.length}` : '0'}</span> dari{' '}
               <span className="tabular-nums text-neutral-900">{pagination.total}</span> staf terdaftar
              {inactiveCount > 0 ? ` · ${inactiveCount} akun non-aktif` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                 disabled={pagination.page <= 1 || isLoading}
                 onClick={() => setPage(pagination.page - 1)}
                className="h-auto px-2.5 py-1 text-xs font-normal text-neutral-400"
              >
                <CaretLeft weight="bold" className="size-3.5" /> Sebelumnya
              </Button>
              <span className="flex items-center rounded-sm bg-sky-600 px-2.5 py-1 text-xs font-medium text-white outline outline-1 outline-sky-600">
                 {pagination.page}
              </span>
              <Button
                variant="secondary"
                size="sm"
                 disabled={pagination.page >= pagination.totalPages || isLoading}
                 onClick={() => setPage(pagination.page + 1)}
                 title={`Halaman ${pagination.page} dari ${pagination.totalPages}`}
                className="h-auto px-2.5 py-1 text-xs font-normal text-neutral-400"
              >
                Selanjutnya <CaretRight weight="bold" className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {showAddModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><TambahStaffModal onClose={() => setShowAddModal(false)} onSubmit={async (payload) => { await createStaff(payload); setShowAddModal(false); setPage(1); queryClient.invalidateQueries({ queryKey: ['staff'] }); }} /></div>}
    </div>
  );
}
