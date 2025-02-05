'use client';

import Link from 'next/link';

export function DashboardTopNav() {
  return (
    <nav className="bg-black text-white px-4 py-4">
      <div className="flex flex-col items-center">
        <Link href="/" className="text-2xl font-bold mb-2">
          Resuming
        </Link>
        <div className="flex space-x-4">
          <Link href="/pricing" className="hover:underline">
            Products
          </Link>
          <a
            href="https://chromad.vercel.app/docs/products/resuming/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Documentation
          </a>
        </div>
      </div>
    </nav>
  );
}
