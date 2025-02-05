'use client';

import { DashboardNavigationController } from '@/os-components/DashboardNavigationBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <DashboardNavigationController />
      <main className="flex-1 overflow-y-auto px-4 py-2">{children}</main>
    </div>
  );
}
