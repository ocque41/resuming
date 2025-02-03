'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Settings, Shield, Activity } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', icon: Users, label: 'Team' },
    { href: '/dashboard/general', icon: Settings, label: 'General' },
    { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
    { href: '/dashboard/security', icon: Shield, label: 'Security' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>

      {/* Bottom Navigation */}
      <div className="btm-nav bg-[#2C2420] border-t border-[#584235] lg:hidden">
        {navItems.map((item) => (
          <Link 
            key={item.href} 
            href={item.href} 
            className={`text-[#B4916C] hover:bg-[#584235] ${
              pathname === item.href ? 'active bg-[#584235] text-white' : ''
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="btm-nav-label text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
