import { useState, type ReactNode } from 'react';
import SidebarNav from './SidebarNav';
import Topbar from './Topbar';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { useAuthStore } from '../../store';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const mode: 'admin' | 'technician' | 'frontdesk' =
    role === 'TEKNISI' ? 'technician' : role === 'FRONTDESK' ? 'frontdesk' : 'admin';

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-stone-200 lg:block print:hidden">
        <SidebarNav mode={mode} />
      </aside>

      <div className="flex min-h-screen flex-col bg-white lg:pl-64 print:pl-0">
        <Topbar onOpenMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-14 pt-6 md:px-6 md:pt-8 lg:px-8">
          {children}
        </main>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="gap-0 border-stone-200 bg-stone-100 p-0">
          <SheetTitle className="sr-only">Navigasi ServiTrack</SheetTitle>
          <SidebarNav mode={mode} onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
