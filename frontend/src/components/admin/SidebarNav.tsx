import { useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  SquaresFour,
  Queue,
  Package,
  UsersThree,
  Money,
  ChartBar,
  CaretUpDown,
  Check,
  User,
  Gear,
  SignOut,
  Kanban,
  ClipboardText,
  UserPlus,
  CalendarDots,
  type Icon,
} from '@phosphor-icons/react';

import { UserAvatar } from '../ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { initialsOf } from '../../lib/avatar';
import { getBranches } from '../../lib/api';
import { useAuthStore, useBranchStore } from '../../store';

interface NavItem {
  label: string;
  icon: Icon;
  href: string;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: SquaresFour, href: '/dashboard' },
  { label: 'Queue / Antrean', icon: Queue, href: '/queue' },
  { label: 'Inventory Sparepart', icon: Package, href: '/inventory' },
  { label: 'Staff Management', icon: UsersThree, href: '/staff' },
  { label: 'Kalender Operasional', icon: CalendarDots, href: '/booking-calendar' },
  { label: 'Pembayaran & Kasir', icon: Money, href: '/payments' },
  { label: 'Laporan & Audit', icon: ChartBar, href: '/reports' },
  { label: 'Pengaturan', icon: Gear, href: '/settings' },
];

const TECHNICIAN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Teknisi', icon: SquaresFour, href: '/technician' },
  { label: 'Kanban Board', icon: Kanban, href: '/technician/kanban' },
  { label: 'Inventaris & Part', icon: Package, href: '/technician/inventory' },
  { label: 'Riwayat Servis', icon: ClipboardText, href: '/technician/history' },
];

const FRONTDESK_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Frontdesk', icon: SquaresFour, href: '/frontdesk' },
  { label: 'Check-in Servis', icon: UserPlus, href: '/queue/new' },
  { label: 'Queue / Antrean', icon: Queue, href: '/queue' },
  { label: 'Pembayaran', icon: Money, href: '/payments' },
];

const COURIER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Kurir', icon: SquaresFour, href: '/courier' },
  { label: 'Tugas Kurir', icon: Package, href: '/courier/tasks' },
  { label: 'Riwayat Tugas', icon: ClipboardText, href: '/courier/history' },
];

interface SidebarNavProps {
  onNavigate?: () => void;
  mode?: 'admin' | 'technician' | 'frontdesk' | 'courier';
}

const NAV_BY_MODE: Record<NonNullable<SidebarNavProps['mode']>, NavItem[]> = {
  admin: ADMIN_NAV_ITEMS,
  technician: TECHNICIAN_NAV_ITEMS,
  frontdesk: FRONTDESK_NAV_ITEMS,
  courier: COURIER_NAV_ITEMS,
};

const SECTION_LABEL: Record<NonNullable<SidebarNavProps['mode']>, string> = {
  admin: 'Workspace',
  technician: 'Menu Teknisi',
  frontdesk: 'Menu Frontdesk',
  courier: 'Menu Kurir',
};

export default function SidebarNav({ onNavigate, mode = 'admin' }: SidebarNavProps) {
  const navigate = useNavigate();
  const navItems = NAV_BY_MODE[mode];
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const storedBranches = useBranchStore((s) => s.branches);
  const currentBranch = useBranchStore((s) => s.currentBranch);
  const setBranches = useBranchStore((s) => s.setBranches);
  const setBranch = useBranchStore((s) => s.setBranch);
  const clearBranches = useBranchStore((s) => s.clearBranches);
  const branchesQuery = useQuery({
    queryKey: ['branches', user?.tenant_id],
    queryFn: getBranches,
    enabled: Boolean(user?.tenant_id),
  });
  const branches = useMemo(
    () => (branchesQuery.data ?? storedBranches).filter((branch) => branch.tenant_id === user?.tenant_id),
    [branchesQuery.data, storedBranches, user?.tenant_id],
  );

  useEffect(() => {
    if (!user?.tenant_id || !user.id) {
      clearBranches();
      return;
    }
    if (branchesQuery.data) {
      const tenantBranches = branchesQuery.data.filter((branch) => branch.tenant_id === user.tenant_id);
      setBranches(user.tenant_id, user.id, tenantBranches, user.branch_id);
    }
  }, [user?.tenant_id, user?.id, user?.branch_id, branchesQuery.data, setBranches, clearBranches]);

  const activeBranch = branches.find((branch) => branch.id === currentBranch?.id)
    ?? branches.find((branch) => branch.id === user?.branch_id)
    ?? branches.find((branch) => branch.is_main)
    ?? branches[0]
    ?? null;

  const name = user?.name ?? 'Andra Wijaya';
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin';
  const canSwitchBranch = user?.role === 'ADMIN';
  const branchIdentity = (
    <>
      <UserAvatar
        seed={activeBranch?.name ?? 'branch'}
        initials={initialsOf(activeBranch?.name ?? 'cabang')}
        alt={`Avatar ${activeBranch?.name ?? 'cabang'}`}
        className="size-8"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-neutral-900">
          {activeBranch?.name ?? (branchesQuery.isPending ? 'Memuat cabang…' : 'Cabang tidak tersedia')}
        </span>
        {activeBranch?.address && <span className="block truncate text-[11px] font-medium text-stone-500">{activeBranch.address}</span>}
      </span>
    </>
  );

  const itemClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500',
      isActive ? 'bg-black/5 text-zinc-900' : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900'
    );

  const itemBody = (item: NavItem, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <>
        <Icon weight="fill" className={cn('size-4 shrink-0', isActive ? 'text-sky-600' : 'text-stone-400')} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-stone-100">
      <div className="shrink-0 border-b border-black/10 px-4 py-3">
        <a
          href="/"
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <img src="/logos.webp" alt="ServiTrack" className="size-6 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold capitalize leading-4 text-zinc-900">ServiTrack</span>
            <span className="block truncate text-[10px] font-normal uppercase leading-4 tracking-wide text-stone-500">
              Main Workshop
            </span>
          </span>
        </a>
      </div>

      <nav aria-label="Workspace" className="ledger-scroll flex-1 overflow-y-auto p-3">
        <p className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase leading-4 tracking-wide text-stone-400">
          {SECTION_LABEL[mode]}
        </p>
        <ul className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const routed = item.href.startsWith('/');
            return (
              <li key={item.label}>
                {routed ? (
                  <NavLink to={item.href} end={item.href !== '/settings'} onClick={onNavigate}>
                    {({ isActive }) => (
                      <span className={itemClass(isActive)}>{itemBody(item, isActive)}</span>
                    )}
                  </NavLink>
                ) : (
                  <a href={item.href} className={itemClass(false)}>
                    {itemBody(item, false)}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-black/10 px-3 py-3">
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Cabang Aktif</p>
        {canSwitchBranch ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-stone-300 bg-white/70 px-3 py-2.5 text-left transition-colors hover:border-sky-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {branchIdentity}
                <CaretUpDown className="size-4 shrink-0 text-stone-400" weight="bold" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="start" className="w-72">
              <DropdownMenuLabel>
                {name} · {role}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-stone-400">Pindah cabang</DropdownMenuLabel>
              {branches.map((branch) => {
                const isActive = branch.id === activeBranch?.id;
                return (
                  <DropdownMenuItem key={branch.id} onSelect={() => setBranch(branch)}>
                    <UserAvatar seed={branch.name} initials={initialsOf(branch.name)} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-neutral-900">{branch.name}</span>
                      {branch.address && <span className="block truncate text-[11px] font-medium text-stone-500">{branch.address}</span>}
                    </span>
                    {isActive && <Check weight="bold" className="text-sky-600" />}
                  </DropdownMenuItem>
                );
              })}
              {!branches.length && (
                <DropdownMenuItem disabled>
                  {branchesQuery.isPending ? 'Memuat daftar cabang…' : branchesQuery.isError ? 'Gagal memuat cabang' : 'Belum ada cabang aktif'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { navigate('/settings/account'); onNavigate?.(); }}>
                <User weight="fill" className="text-stone-400" /> Profil saya
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { navigate('/settings'); onNavigate?.(); }}>
                <Gear weight="fill" className="text-stone-400" /> Pengaturan akun
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logout()} className="text-red-600 focus:text-red-600">
                <SignOut weight="fill" className="text-red-500" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex w-full items-center gap-3 rounded-lg border border-dashed border-stone-300 bg-white/70 px-3 py-2.5 text-left">
            {branchIdentity}
          </div>
        )}
      </div>
    </div>
  );
}
