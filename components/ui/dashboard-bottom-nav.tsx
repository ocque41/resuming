'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/ui/sidebar';

export function DashboardBottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-around bg-black text-white border-t border-gray-700">
      <Link href="/dashboard" className="flex-1 text-center py-2">
        <span className="block text-sm">🏠</span>
        <span className="block text-xs">Dashboard</span>
      </Link>
      <Link href="/profile" className="flex-1 text-center py-2">
        <span className="block text-sm">👤</span>
        <span className="block text-xs">Profile</span>
      </Link>
      <Link href="/settings" className="flex-1 text-center py-2">
        <span className="block text-sm">⚙️</span>
        <span className="block text-xs">Settings</span>
      </Link>
    </div>
  );
}
