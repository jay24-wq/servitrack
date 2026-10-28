import { NavLink } from 'react-router-dom';
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
  NotePencil,
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
import { useAuthStore, useTenantStore } from '../../store';

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
];

const TECHNICIAN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Teknisi', icon: SquaresFour, href: '/technician' },
  { label: 'Kanban Board', icon: Kanban, href: '/technician/kanban' },
  { label: 'Inventaris & Part', icon: Package, href: '/technician/inventory' },
  { label: 'Quotation Builder', icon: NotePencil, href: '/technician/quotation' },
  { label: 'Riwayat Servis', icon: ClipboardText, href: '/technician/history' },
];

const FRONTDESK_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard Frontdesk', icon: SquaresFour, href: '/frontdesk' },
  { label: 'Check-in Servis', icon: UserPlus, href: '/queue/new' },
  { label: 'Queue / Antrean', icon: Queue, href: '/queue' },
  { label: 'Pembayaran', icon: Money, href: '/payments' },
];

const MOCK_TENANTS = [
  { id: 't1', name: 'Workshop Radio Dalam', slug: 'radio-dalam', plan: 'Starter Plan', active: true },
  { id: 't2', name: 'Workshop BSD Serpong', slug: 'bsd-serpong', plan: 'Pro Plan', active: true },
  { id: 't3', name: 'Workshop Kelapa Gading', slug: 'kelapa-gading', plan: 'Starter Plan', active: false },
];

interface SidebarNavProps {
  onNavigate?: () => void;
  mode?: 'admin' | 'technician' | 'frontdesk';
}

const NAV_BY_MODE: Record<NonNullable<SidebarNavProps['mode']>, NavItem[]> = {
  admin: ADMIN_NAV_ITEMS,
  technician: TECHNICIAN_NAV_ITEMS,
  frontdesk: FRONTDESK_NAV_ITEMS,
};

const SECTION_LABEL: Record<NonNullable<SidebarNavProps['mode']>, string> = {
  admin: 'Workspace',
  technician: 'Menu Teknisi',
  frontdesk: 'Menu Frontdesk',
};

export default function SidebarNav({ onNavigate, mode = 'admin' }: SidebarNavProps) {
  const navItems = NAV_BY_MODE[mode];
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const tenants = useTenantStore((s) => s.tenants);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const setTenant = useTenantStore((s) => s.setTenant);

  const tenantList = tenants.length ? tenants : MOCK_TENANTS;
  const activeTenant = currentTenant ?? tenantList[0];

  const name = user?.name ?? 'Andra Wijaya';
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin';

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
                  <NavLink to={item.href} end onClick={onNavigate}>
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
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Tenant aktif</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-stone-300 bg-white/70 px-3 py-2.5 text-left transition-colors hover:border-sky-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <UserAvatar
                seed={activeTenant?.name ?? 'workshop'}
                initials={initialsOf(activeTenant?.name ?? 'workshop')}
                alt={`Avatar ${activeTenant?.name ?? 'tenant'}`}
                className="size-8"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-neutral-900">{activeTenant?.name}</span>
                <span className="block truncate text-[11px] font-medium text-stone-500">
                  {activeTenant?.plan ?? 'Starter Plan'} · 3/3 user
                </span>
              </span>
              <CaretUpDown className="size-4 shrink-0 text-stone-400" weight="bold" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-72">
            <DropdownMenuLabel>
              {name} · {role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-stone-400">Pindah tenant</DropdownMenuLabel>
            {tenantList.map((tenant) => {
              const isActive = tenant.id === activeTenant?.id;
              return (
                <DropdownMenuItem key={tenant.id} onSelect={() => setTenant(tenant)}>
                  <UserAvatar seed={tenant.name} initials={initialsOf(tenant.name)} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-neutral-900">{tenant.name}</span>
                    <span className="block truncate text-[11px] font-medium text-stone-500">{tenant.plan}</span>
                  </span>
                  {isActive && <Check weight="bold" className="text-sky-600" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User weight="fill" className="text-stone-400" /> Profil saya
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Gear weight="fill" className="text-stone-400" /> Pengaturan akun
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()} className="text-red-600 focus:text-red-600">
              <SignOut weight="fill" className="text-red-500" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
