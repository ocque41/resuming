"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";

export function ClientNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 w-full z-50 bg-[#050505] bg-opacity-95 backdrop-blur-sm border-b border-[#222222]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center">
          <Link href="/" className="text-2xl font-safiro text-[#F9F6EE] font-bold">
            CVOptimizer
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <Link
            href="/blog"
            className="text-[#F9F6EE] hover:text-[#B4916C] px-3 py-2 text-sm font-borna"
          >
            News
          </Link>
          <Link
            href="/pricing"
            className="text-[#F9F6EE] hover:text-[#B4916C] px-3 py-2 text-sm font-borna"
          >
            Product
          </Link>
          <Link
            href="/sign-in"
            className="bg-[#B4916C] text-[#050505] hover:bg-[#A3815B] px-4 py-2 rounded-lg text-sm font-safiro transition-colors duration-200"
          >
            Log in
          </Link>
        </div>
        
        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-[#F9F6EE] focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden py-2 px-4 bg-[#111111] border-t border-[#222222]">
          <Link
            href="/blog"
            className="block py-2 text-[#F9F6EE] hover:text-[#B4916C] font-borna"
            onClick={() => setIsMenuOpen(false)}
          >
            News
          </Link>
          <Link
            href="/pricing"
            className="block py-2 text-[#F9F6EE] hover:text-[#B4916C] font-borna"
            onClick={() => setIsMenuOpen(false)}
          >
            Product
          </Link>
          <Link
            href="/sign-in"
            className="block py-2 text-[#F9F6EE] hover:text-[#B4916C] font-borna"
            onClick={() => setIsMenuOpen(false)}
          >
            Log in
          </Link>
        </div>
      )}
    </nav>
  );
} 