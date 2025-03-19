"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SectionContainerProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * A consistent section container component for grouping content
 */
export default function SectionContainer({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  footer,
  action,
}: SectionContainerProps) {
  return (
    <div 
      className={cn(
        "bg-[#111111] border border-[#222222] rounded-xl shadow-md overflow-hidden",
        className
      )}
    >
      {(title || subtitle || Icon || action) && (
        <div 
          className={cn(
            "flex items-center justify-between p-5 bg-[#0D0D0D] border-b border-[#222222]",
            headerClassName
          )}
        >
          <div className="flex items-center space-x-3">
            {Icon && <Icon className="h-5 w-5 text-[#B4916C]" />}
            <div>
              {title && (
                <h3 className="text-lg font-safiro font-semibold text-[#F9F6EE]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-[#F9F6EE]/60 font-borna mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      
      <div className={cn("p-5", contentClassName)}>
        {children}
      </div>
      
      {footer && (
        <div 
          className={cn(
            "p-5 bg-[#0D0D0D] border-t border-[#222222]",
            footerClassName
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
} 