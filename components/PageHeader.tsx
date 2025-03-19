"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  backUrl?: string;
  children?: React.ReactNode;
}

/**
 * A consistent page header component with optional back button
 */
export default function PageHeader({ title, backUrl = "/dashboard", children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center">
        {backUrl && (
          <Link 
            href={backUrl} 
            className="flex items-center justify-center h-10 w-10 rounded-lg bg-[#111111] hover:bg-[#222222] text-[#B4916C] mr-4 transition-colors duration-200 border border-[#222222]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <h1 className="text-2xl font-safiro font-bold text-[#F9F6EE]">
          {title}
        </h1>
      </div>
      
      {children && (
        <div className="flex items-center space-x-4">
          {children}
        </div>
      )}
    </header>
  );
} 