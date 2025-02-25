"use client";

import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  return (
    <nav className="bg-[#050505] border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center mb-4 md:mb-0">
          <Link href="/">
            <Image src="/white.png" alt="Logo" width={140} height={140} />
          </Link>
          <span className="ml-2 text-white text-xl font-bold">ResumeAI</span>
        </div>
        {/* Navigation Links */}
        <div className="flex flex-col md:flex-row md:space-x-8 items-center">
          <Link
            href="/dashboard/pricing"
            className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Product
          </Link>
          <Link
            href="https://chromad.vercel.app/docs/products/resuming/overview"
            className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
          >
            Documentation
          </Link>
          <Link
            href="https://next-js-saas-starter-three-resuming.vercel.app/sign-in"
            className="bg-white text-black hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium"
          >
            Log in
          </Link>
        </div>
      </div>
    </nav>
  );
}
