'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Activity, 
  FileText, 
  BarChart2, 
  User, 
  Settings, 
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center px-3 py-2 rounded-lg transition-colors relative',
        isActive 
          ? 'text-[#F9F6EE] bg-[#222222]' 
          : 'text-[#8A8782] hover:text-[#F9F6EE] hover:bg-[#111111]'
      )}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span className="font-medium">{label}</span>
      {isActive && (
        <motion.div
          layoutId="active-nav-indicator"
          className="absolute left-0 w-1 h-6 bg-[#B4916C] rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
}

export function DashboardNav({ className }: { className?: string }) {
  const pathname = usePathname() || '';
  
  const routes = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: Activity,
      match: (path: string) => path === '/dashboard',
    },
    {
      href: '/dashboard/cvs',
      label: 'My CVs',
      icon: FileText,
      match: (path: string) => path.startsWith('/dashboard/cvs'),
    },
    {
      href: '/dashboard/analyze',
      label: 'Analyze',
      icon: BarChart2,
      match: (path: string) => path.startsWith('/dashboard/analyze'),
    },
    {
      href: '/dashboard/profile',
      label: 'Profile',
      icon: User,
      match: (path: string) => path.startsWith('/dashboard/profile'),
    },
    {
      href: '/dashboard/pricing',
      label: 'Upgrade',
      icon: Settings,
      match: (path: string) => path.startsWith('/dashboard/pricing'),
    },
    {
      href: '/dashboard/settings',
      label: 'Settings',
      icon: Settings,
      match: (path: string) => path.startsWith('/dashboard/settings'),
    },
  ];
  
  return (
    <nav className={cn("space-y-1", className)}>
      {routes.map((route) => (
        <NavItem
          key={route.href}
          href={route.href}
          icon={route.icon}
          label={route.label}
          isActive={route.match(pathname)}
        />
      ))}
      <div className="pt-6 mt-6 border-t border-[#222222]">
        <Link
          href="/api/auth/logout"
          className="flex items-center px-3 py-2 rounded-lg transition-colors text-[#8A8782] hover:text-[#F9F6EE] hover:bg-[#111111]"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span className="font-medium">Log Out</span>
        </Link>
      </div>
    </nav>
  );
} 