'use client';

import { DashboardBottomNav } from '@/components/ui/dashboard-bottom-nav';
import {DashboardNavigationBar} from @/DashboardNavigationBar
import { SidebarProvider } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
        <main className="flex-1 overflow-y-auto px-4 py-2">{children}</main>
        <DashboardBottomNav />
      </div>
    </SidebarProvider>
  );
}
