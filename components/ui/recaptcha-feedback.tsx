"use client";

import React from 'react';
import { AlertCircle, Shield, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ReCaptchaFeedbackProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  message?: string;
  className?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
}

/**
 * ReCaptcha Feedback Component
 * 
 * Displays the current status of reCAPTCHA verification with appropriate
 * icons and messages. Provides a retry option when verification fails.
 */
export default function ReCaptchaFeedback({
  status,
  message,
  className,
  showRetry = true,
  onRetry,
  onSkip
}: ReCaptchaFeedbackProps) {
  // No icon for idle status
  if (status === 'idle') return null;

  // Map status to icon and colors
  const statusConfig = {
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200'
    },
    success: {
      icon: <CheckCircle className="h-4 w-4" />,
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200'
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200'
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200'
    },
    idle: {
      icon: <Shield className="h-4 w-4" />,
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200'
    }
  };

  const config = statusConfig[status];

  // Configuration error specific guidance
  const isConfigError = status === 'error' && message === 'reCAPTCHA is not properly configured';

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-md p-2.5 flex items-start space-x-2 text-sm border', 
        config.bg, 
        config.text, 
        config.border,
        className
      )}
    >
      <span className="mt-0.5">{config.icon}</span>
      <div className="flex-1">
        <p className="font-medium">{message || status}</p>
        
        {isConfigError && (
          <div className="mt-1.5 text-xs text-gray-600">
            <p className="mb-1">The reCAPTCHA service is not properly configured. This could be due to:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Missing reCAPTCHA API keys</li>
              <li>Incorrect domain configuration</li>
              <li>Network issues preventing API communication</li>
            </ul>
          </div>
        )}
        
        {(showRetry && status === 'error') && (
          <div className="mt-2 flex space-x-2">
            <button 
              onClick={onRetry}
              className="text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 px-2 py-1 rounded border border-gray-300 transition-colors"
            >
              Retry Verification
            </button>
            
            {isConfigError && onSkip && (
              <button 
                onClick={onSkip}
                className="text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-300 transition-colors"
              >
                Continue Without Verification
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
} 