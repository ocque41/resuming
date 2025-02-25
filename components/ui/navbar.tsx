"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "@headlessui/react";

export function Navbar() {
  return (
    <nav className="bg-[#050505] border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center mb-4 md:mb-0">
          <Link href="/">
            <Image src="/white.png" alt="Logo" width={180} height={180} />
          </Link>
          <span className="ml-2 text-white text-xl font-bold"></span>
        </div>
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex space-x-8 items-center">
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
        {/* Mobile Dropdown Navigation */}
        <div className="md:hidden w-full">
          <Menu as="div" className="relative">
            <Menu.Button className="w-full bg-[#050505] text-white px-3 py-2 rounded-md text-sm font-medium text-left">
              Menu
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-full origin-top-right bg-[#050505] border border-gray-700 rounded-md shadow-lg focus:outline-none">
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
    </nav>
  );
}
