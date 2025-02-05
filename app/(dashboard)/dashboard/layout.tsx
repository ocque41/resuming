'use client';

import { useEffect } from 'react';
import { DashboardBottomNav } from '@/components/ui/dashboard-bottom-nav';
import { NativeModules } from 'react-native';

const { DashboardNavigationManager } = NativeModules;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Invoke the native navigation manager to show the navigation bar
    DashboardNavigationManager.showNavigation();
  }, []);

  return (
    <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <main className="flex-1 overflow-y-auto px-4 py-2">{children}</main>
      <DashboardBottomNav />
    </div>
  );
}
