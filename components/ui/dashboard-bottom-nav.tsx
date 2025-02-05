'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/ui/sidebar';

export function DashboardBottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-around bg-[#2C2420] border-t border-[#584235] text-white">
      <Link href="/dashboard" className="flex-1 text-center py-2">
        Dashboard
      </Link>
      <Link href="/profile" className="flex-1 text-center py-2">
        Profile
      </Link>
      <Link href="/settings" className="flex-1 text-center py-2">
        Settings
      </Link>
    </div>
  );
}
