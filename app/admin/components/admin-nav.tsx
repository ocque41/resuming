'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Mail, Settings, Users } from 'lucide-react';

interface AdminNavProps {
  items?: {
    href: string;
    title: string;
    icon?: React.ReactNode;
  }[];
}

export function AdminNav({ items }: AdminNavProps) {
  const pathname = usePathname();
  
  const defaultItems = [
    {
      href: '/admin',
      title: 'Users',
      icon: <Users className="mr-2 h-4 w-4" />,
    },
    {
      href: '/admin/email-stats',
      title: 'Email Stats',
      icon: <Mail className="mr-2 h-4 w-4" />,
    },
    {
      href: '/admin/settings',
      title: 'Settings',
      icon: <Settings className="mr-2 h-4 w-4" />,
    },
  ];

  const navItems = items || defaultItems;

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 mb-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center text-sm font-medium transition-colors hover:text-primary',
            pathname === item.href
              ? 'text-foreground'
              : 'text-muted-foreground'
          )}
        >
          {item.icon}
          {item.title}
        </Link>
      ))}
    </nav>
  );
} 