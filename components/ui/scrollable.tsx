"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface ScrollableProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both';
  variant?: 'default' | 'premium' | 'minimal' | 'modern';
  height?: string;
  maxHeight?: string;
  minHeight?: string;
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  children: React.ReactNode;
}

/**
 * Scrollable component with styled scrollbars that match the branding.
 * 
 * @example
 * <Scrollable height="300px" variant="modern">
 *   <YourContent />
 * </Scrollable>
 */
export function Scrollable({
  orientation = 'vertical',
  variant = 'default',
  height,
  maxHeight,
  minHeight,
  width,
  maxWidth,
  minWidth,
  className,
  children,
  ...props
}: ScrollableProps) {
  const getOverflowClass = () => {
    switch (orientation) {
      case 'horizontal':
        return 'overflow-x-auto overflow-y-hidden';
      case 'vertical':
        return 'overflow-y-auto overflow-x-hidden';
      case 'both':
        return 'overflow-auto';
      default:
        return 'overflow-y-auto overflow-x-hidden';
    }
  };

  const getScrollbarClass = () => {
    switch (variant) {
      case 'premium':
        return 'premium-scrollbar';
      case 'minimal':
        return 'minimal-scrollbar';
      case 'modern':
        return 'modern-scrollbar';
      default:
        return 'custom-scrollbar';
    }
  };

  return (
    <div
      className={cn(
        "relative",
        className
      )}
      style={{
        height,
        maxHeight,
        minHeight,
        width,
        maxWidth,
        minWidth,
      }}
    >
      <div
        className={cn(
          getScrollbarClass(),
          getOverflowClass(),
          "w-full h-full"
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export default Scrollable; 