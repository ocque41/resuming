'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface PremiumFeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export function PremiumFeatureCard({ 
  title, 
  description, 
  icon: Icon, 
  href 
}: PremiumFeatureCardProps) {
  return (
    <Link
      href={href}
      className="group bg-[#0D0D0D] border border-[#222222] hover:border-[#B4916C]/50 rounded-lg p-5 transition-all duration-300 flex flex-col h-full"
    >
      <div className="bg-[#161616] p-3 rounded-lg w-fit mb-4 group-hover:bg-[#B4916C]/10 transition-colors">
        <Icon className="h-6 w-6 text-[#B4916C]" />
      </div>
      
      <h3 className="text-lg font-safiro text-[#F9F6EE] mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-[#8A8782] mb-4 flex-grow">
        {description}
      </p>
      
      <div className="text-[#B4916C] text-sm font-medium group-hover:underline mt-auto">
        Get Started
      </div>
    </Link>
  );
} 