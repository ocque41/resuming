
import { Popover } from '@headlessui/react';
import Image from 'next/image';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-black text-white">
      <nav className="flex items-center justify-between p-4 bg-gray-800">
        <div className="flex items-center">
          <Image
            src="/Resuming white.png"
            alt="Logo"
            width={50}
            height={50}
            className="mr-4"
          />
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/product" className="text-white">
            Product
          </Link>
          <Link href="/documentation" className="text-white">
            Documentation
          </Link>
          <Link href="/login" className="bg-white text-black px-4 py-2 rounded">
            Log in
          </Link>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">{children}</main>
    </div>
  );
}
