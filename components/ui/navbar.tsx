"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-[#050505] border-b border-gray-700 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center">
          <Link href="/">
            <Image src="/white.png" alt="Logo" width={180} height={180} />
          </Link>
          <span className="ml-2 text-white text-xl font-bold"></span>
        </div>
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
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
        {/* Mobile Hamburger Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="text-white focus:outline-none"
          >
            {/* Hamburger Icon */}
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute right-4 top-full bg-[#050505] border border-gray-700 rounded-md shadow-lg w-48">
          <div className="py-2">
            <Link
              href="/dashboard/pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Product
            </Link>
            <Link
              href="https://chromad.vercel.app/docs/products/resuming/overview"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Documentation
            </Link>
            <Link
              href="https://next-js-saas-starter-three-resuming.vercel.app/sign-in"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
