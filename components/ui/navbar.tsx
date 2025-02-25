"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "@headlessui/react";

export function Navbar() {
  return (
    <nav className="bg-[#050505] border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <Image src="/white.png" alt="Logo" width={140} height={140} />
            </Link>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
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
          </div>
          {/* Desktop CTA */}
          <div className="hidden md:flex">
            <Link
              href="https://next-js-saas-starter-three-resuming.vercel.app/sign-in"
              className="bg-white text-black hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium"
            >
              Log in
            </Link>
          </div>
          {/* Mobile Menu */}
          <div className="md:hidden">
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="inline-flex justify-center w-full rounded-md bg-[#050505] text-white hover:bg-gray-700 focus:outline-none">
                Menu
              </Menu.Button>
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-[#050505] rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="/dashboard/pricing"
                      className={`block px-4 py-2 text-sm text-white ${
                        active ? "bg-gray-700" : ""
                      }`}
                    >
                      Product
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="https://chromad.vercel.app/docs/products/resuming/overview"
                      className={`block px-4 py-2 text-sm text-white ${
                        active ? "bg-gray-700" : ""
                      }`}
                    >
                      Documentation
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="https://next-js-saas-starter-three-resuming.vercel.app/sign-in"
                      className={`block px-4 py-2 text-sm text-white ${
                        active ? "bg-gray-700" : ""
                      }`}
                    >
                      Log in
                    </Link>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>
          </div>
        </div>
      </div>
    </nav>
  );
}
