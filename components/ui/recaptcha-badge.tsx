"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, Shield, ChevronRight, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type BadgePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
type BadgeVariant = 'light' | 'dark';
type BadgeSize = 'small' | 'medium' | 'large';

interface ReCaptchaBadgeProps {
  position?: BadgePosition;
  variant?: BadgeVariant;
  size?: BadgeSize;
  showInfoIcon?: boolean;
  minimalist?: boolean;
  className?: string;
}

/**
 * ReCaptcha Badge Component
 * 
 * This component displays the required reCAPTCHA attribution badge.
 * Google's terms of service require this badge to be visible for reCAPTCHA v3 implementations.
 * 
 * @see https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge.-what-is-allowed
 */
export default function ReCaptchaBadge({
  position = 'bottom-right',
  variant = 'dark',
  size = 'small',
  showInfoIcon = true,
  minimalist = false,
  className = '',
}: ReCaptchaBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
  };

  // Color classes
  const colorClasses = {
    light: 'bg-white text-gray-700 border-gray-300',
    dark: 'bg-gray-900 text-gray-100 border-gray-700',
  };

  // Size classes
  const sizeClasses = {
    small: 'text-xs p-2',
    medium: 'text-sm p-3',
    large: 'text-base p-4',
  };

  // Google logo size based on badge size
  const logoSize = {
    small: 14,
    medium: 16,
    large: 18,
  };

  // If dismissed, show only a minimal indicator
  if (dismissed) {
    return (
      <motion.div
        className={cn(
          'fixed z-50 cursor-pointer',
          positionClasses[position],
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        whileHover={{ opacity: 1 }}
        onClick={() => setDismissed(false)}
      >
        <Shield size={16} className="text-[#B4916C]" />
      </motion.div>
    );
  }

  // If minimalist mode is enabled, show a very minimal version
  if (minimalist) {
    return (
      <motion.div
        className={cn(
          'fixed z-50 cursor-pointer',
          positionClasses[position],
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        whileHover={{ opacity: 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative">
          <Shield size={16} className="text-[#B4916C]" />
          
          {/* Show the attribution text on hover */}
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'absolute rounded-md shadow-md border p-2 whitespace-nowrap text-xs',
                position.includes('right') ? 'right-0' : 'left-0',
                position.includes('top') ? 'bottom-full mb-2' : 'top-full mt-2',
                colorClasses[variant]
              )}
            >
              <p className="mb-1">Protected by reCAPTCHA</p>
              <div className="flex gap-1 text-[10px] opacity-80">
                <Link 
                  href="https://policies.google.com/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#B4916C] hover:underline"
                >
                  Privacy
                </Link>
                <span>-</span>
                <Link 
                  href="https://policies.google.com/terms" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#B4916C] hover:underline"
                >
                  Terms
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // Standard badge implementation
  return (
    <motion.div
      className={cn(
        'fixed z-50 rounded-md shadow-md border flex flex-col',
        positionClasses[position],
        colorClasses[variant],
        sizeClasses[size],
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Badge Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Shield size={logoSize[size]} className="text-[#B4916C]" />
          <span className="font-medium whitespace-nowrap">Protected by reCAPTCHA</span>
        </div>
        
        <div className="flex items-center gap-1">
          {showInfoIcon && (
            <motion.button
              onClick={() => setExpanded(!expanded)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-1 rounded-full hover:bg-[#B4916C]/10"
            >
              {expanded ? 
                <ChevronDown size={logoSize[size]} className="text-[#B4916C]" /> : 
                <ChevronRight size={logoSize[size]} className="text-[#B4916C]" />
              }
            </motion.button>
          )}
          
          <motion.button
            onClick={() => setDismissed(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1 rounded-full hover:bg-red-500/10"
          >
            <X size={logoSize[size]} className="text-gray-400" />
          </motion.button>
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <motion.div
          className="mt-2 text-xs"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Image 
              src="/google-logo.svg" 
              alt="Google" 
              width={logoSize[size]} 
              height={logoSize[size]}
              className="h-auto w-auto"
            />
            <span>Google reCAPTCHA v3</span>
          </div>
          
          <p className="text-xs mb-2 opacity-80 leading-tight">
            This site is protected by reCAPTCHA and the Google
            <br />
            <Link 
              href="https://policies.google.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#B4916C] hover:underline"
            >
              Privacy Policy
            </Link> and{" "}
            <Link 
              href="https://policies.google.com/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#B4916C] hover:underline"
            >
              Terms of Service
            </Link> apply.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
} 