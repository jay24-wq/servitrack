import {
  MagnifyingGlass,
  Bell,
  List,
  Users,
  ClipboardText,
  Receipt,
  Package,
  User,
  Gear,
  SignOut,
  CaretRight,
  type Icon,
} from '@phosphor-icons/react';

import { UserAvatar } from '../ui/user-avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store';

interface Notification {
  id: string;
  icon: Icon;
  tone: 'sky' | 'amber' | 'rose';
  title: string;
  description: string;
  time: string;
}

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    icon: ClipboardText,
    tone: 'sky',
    title: 'Check-in baru SRV7406129853',
    description: 'MacBook Air M1 · Rafi Mahendra',
    time: '2 menit lalu',
  },
  {
    id: 'n2',
    icon: Receipt,
    tone: 'amber',
    title: 'Invoice INV3645028197 lunas',
    description: 'Rp 3.200.000 · transfer BCA',
    time: '18 menit lalu',
  },
  {
    id: 'n3',
    icon: Package,
    tone: 'rose',
    title: 'Flex connector display: 2 unit',
    description: 'Batas minimum inventaris 6 unit',
    time: '1 jam lalu',
  },
];

const toneClasses = {
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-red-600',
};

function LedgerSearch({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-full', className)}>
      <MagnifyingGlass weight="bold" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <Input
        type="search"
        aria-label="Pencarian universal: nomor tiket atau nama pelanggan"
        placeholder="Cari No. Tiket / Nama Pelanggan..."
        className="h-11 rounded-lg border-stone-200 bg-stone-50 pl-10 pr-16 caret-sky-600 shadow-none placeholder:text-stone-400"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-stone-500 md:block">
        Ctrl K
      </kbd>
    </div>
  );
}

interface TopbarProps {
  onOpenMenu: () => void;
}

export default function Topbar({ onOpenMenu }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const name = user?.name ?? 'Andra Wijaya';
  const email = user?.email ?? 'admin@servitrack.id';
  const plan = user?.plan ? `${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} Plan` : 'Starter Plan';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/85 backdrop-blur-[6px] print:hidden">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:h-[72px] md:gap-6 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka rel modul"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:hidden"
        >
          <List weight="bold" className="size-5" />
        </button>

        <LedgerSearch className="hidden max-w-md flex-1 md:block" />

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1.5 lg:flex">
            <Users weight="fill" className="size-4 text-sky-700" />
            <span className="text-xs font-bold tracking-tight text-sky-700">{plan} - 3/3 Users</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifikasi"
                className="relative"
              >
                <Bell weight="fill" />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0">
              <div className="flex items-center justify-between border-b border-stone-100 px-3.5 py-3">
                <span className="text-[13px] font-bold text-neutral-900">Notifikasi</span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-red-700">
                  3 baru
                </span>
              </div>
              {NOTIFICATIONS.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-start gap-3 border-b border-stone-100 px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                  >
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClasses[item.tone])}>
                      <ItemIcon weight="fill" className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-neutral-900">{item.title}</span>
                      <span className="block truncate text-xs text-stone-500">{item.description}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-sky-700">{item.time}</span>
                    </span>
                  </button>
                );
              })}
              <div className="p-2">
                <Button variant="outline" size="sm" className="w-full">
                  Lihat semua notifikasi <CaretRight weight="bold" />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu profil"
                className="rounded-full p-0.5 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <UserAvatar seed={name} initials={initials} alt={`Avatar ${name}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel className="text-stone-400">Masuk sebagai</DropdownMenuLabel>
              <div className="mb-1 flex items-center gap-3 px-2.5 pb-2.5">
                <UserAvatar seed={name} initials={initials} alt={`Avatar ${name}`} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{name}</p>
                  <p className="truncate text-xs text-stone-500">{email}</p>
                </div>
              </div>
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

      <div className="border-t border-stone-100 px-4 py-2.5 md:hidden">
        <LedgerSearch />
      </div>
    </header>
  );
}
