
import { Popover } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-black text-white">
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">{children}</main>
    </div>
  );
}
