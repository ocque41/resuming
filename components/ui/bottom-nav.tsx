'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Settings, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: Users, label: 'Team' },
  { href: '/dashboard/general', icon: Settings, label: 'General' },
  { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
  { href: '/dashboard/security', icon: Shield, label: 'Security' },
];

export function BottomNav({ className, size = 'md' }: { 
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const pathname = usePathname();
  
  return (
    <div className={cn(
      "btm-nav",
      {
        'btm-nav-xs': size === 'xs',
        'btm-nav-sm': size === 'sm',
        'btm-nav-md': size === 'md',
        'btm-nav-lg': size === 'lg',
      },
      className
    )}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-[#B4916C]",
              {
                "active bg-[#584235] text-white": isActive,
                "hover:bg-[#584235]/10": !isActive,
              }
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="btm-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
