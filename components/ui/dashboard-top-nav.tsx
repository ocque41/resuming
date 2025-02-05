'use client';

import Link from 'next/link';

export function DashboardTopNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 flex justify-around bg-black text-white border-b border-gray-700 z-10">
      <Link href="/" className="flex-1 text-center py-2">
        <span className="block text-sm">🏠</span>
        <span className="block text-xs">Home</span>
      </Link>
      <Link href="/pricing" className="flex-1 text-center py-2">
        <span className="block text-sm">💼</span>
        <span className="block text-xs">Products</span>
      </Link>
      <a
        href="https://chromad.vercel.app/docs/products/resuming/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-center py-2"
      >
        <span className="block text-sm">📄</span>
        <span className="block text-xs">Docs</span>
      </a>
    </nav>
  );
}
