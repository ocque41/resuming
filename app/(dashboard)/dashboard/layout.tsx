'use client';

import { useEffect } from 'react';
import { DashboardBottomNav } from '@/components/ui/dashboard-bottom-nav';
import { DashboardTopNav } from '@/components/ui/dashboard-top-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <DashboardTopNav />
      <main className="flex-1 overflow-y-auto px-4 py-2">{children}</main>
      <DashboardBottomNav />
    </div>
  );
}
