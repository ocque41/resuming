"use client";

import React from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, RefreshCw, SkipForward, AlertTriangle, X, type LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { getErrorMessageForAction } from '@/lib/recaptcha/actions';
import { isProductionDomain, formatDomain } from '@/lib/recaptcha/domain-check';

interface ReCaptchaFeedbackProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  message?: string;
  className?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
  score?: number;
  action?: string;
  details?: { [key: string]: any };
}

/**
 * Component to show feedback about reCAPTCHA verification status
 * with appropriate icons and messages
 */
export default function ReCaptchaFeedback({
  status,
  message,
  className,
  showRetry = true,
  onRetry,
  onSkip,
  score,
  action,
  details
}: ReCaptchaFeedbackProps) {
  // Map status to icon and styles
  const statusConfig: Record<'idle' | 'loading' | 'success' | 'error' | 'warning', {
    icon: React.ElementType;
    textColor: string;
    bgColor: string;
    iconColor: string;
  }> = {
    idle: {
      icon: Info,
      textColor: 'text-slate-500',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      iconColor: 'text-slate-500'
    },
    loading: {
      icon: Loader2,
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      iconColor: 'text-blue-500'
    },
    success: {
      icon: CheckCircle,
      textColor: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      iconColor: 'text-green-500'
    },
    error: {
      icon: AlertCircle,
      textColor: 'text-red-500',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      iconColor: 'text-red-500'
    },
    warning: {
      icon: AlertCircle,
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/20',
      iconColor: 'text-amber-500'
    }
  };

  const { icon: Icon, textColor, bgColor, iconColor } = statusConfig[status];

  // Handle different error types with specific messages
  const getDisplayMessage = () => {
    if (message) return message;

    // Define status-specific default messages
    const statusConfig: Record<typeof status, { 
      icon: LucideIcon; 
      textColor: string; 
      bgColor: string; 
      iconColor: string;
    }> = {
      idle: {
        icon: AlertCircle,
        textColor: 'text-gray-500',
        bgColor: 'bg-gray-100',
        iconColor: 'text-gray-500'
      },
      loading: {
        icon: Loader2,
        textColor: 'text-blue-500',
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-500'
      },
      success: {
        icon: CheckCircle,
        textColor: 'text-green-500',
        bgColor: 'bg-green-50',
        iconColor: 'text-green-500'
      },
      error: {
        icon: X,
        textColor: 'text-red-500',
        bgColor: 'bg-red-50',
        iconColor: 'text-red-500'
      },
      warning: {
        icon: AlertTriangle,
        textColor: 'text-amber-500',
        bgColor: 'bg-amber-50',
        iconColor: 'text-amber-500'
      }
    };

    // Detect specific error types for better messages
    const errorMessage = details?.error?.message || '';
    const errorType = details?.error?.type || '';
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
    
    // Check for specific error types
    const isConfigError = errorMessage.includes('not configured') || 
                         errorMessage.includes('missing') || 
                         errorType === 'config';
                         
    const isNetworkError = errorMessage.includes('network') || 
                         errorMessage.includes('timeout') || 
                         errorType === 'network';
                         
    const isTokenError = errorMessage.includes('token') || 
                        errorType === 'token';
                        
    const isLowScoreError = score !== undefined && score < 0.5;
    const isDomainError = errorMessage.includes('domain') || errorType === 'domain';
    
    switch (status) {
      case 'idle':
        return 'Preparing verification...';
      
      case 'loading':
        return 'Verifying your request...';
      
      case 'success':
        if (score !== undefined) {
          return `Verification successful (Trust score: ${score.toFixed(2)})`;
        }
        return 'Verification successful';
      
      case 'error':
        // Domain-specific error messages
        if (isProduction) {
          if (isConfigError) {
            return 'Critical: reCAPTCHA site key and secret key are missing on production domain resuming.ai';
          } else if (isNetworkError) {
            return 'Network error: Unable to connect to verification service. Please check your internet connection and try again.';
          } else if (isTokenError) {
            return 'Verification token error: The security token could not be verified. Please try again.';
          } else if (isDomainError) {
            return 'Domain verification error: This verification is only configured for resuming.ai domains.';
          }
          return 'Verification failed. Please try again or contact support if the issue persists.';
        } else {
          // Development/other domains
          if (isConfigError) {
            return 'reCAPTCHA configuration error: API keys are missing or invalid';
          } else if (isNetworkError) {
            return 'Network error: Could not connect to reCAPTCHA services';
          } else if (isTokenError) {
            return 'Token error: Invalid or expired verification token';
          } else if (isDomainError) {
            return 'Domain error: This domain is not registered for reCAPTCHA';
          }
          return 'Verification failed. Please check console for details.';
        }
      
      case 'warning':
        if (isLowScoreError) {
          return `Low trust score (${score?.toFixed(2)}). Additional verification may be required.`;
        }
        return 'Verification completed with warnings';
      
      default:
        return 'Verification status unknown';
    }
  };

  // Create guidance message for configuration issues
  const getTroubleshootingGuidance = () => {
    if (status !== 'error') return null;
    
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
    
    // Different guidance based on domain
    if (isProduction) {
      return (
        <div className="mt-2 text-xs text-gray-500">
          <p>The reCAPTCHA service is not properly configured. This could be due to:</p>
          <ul className="list-disc list-inside mt-1 ml-2">
            <li>Missing reCAPTCHA API keys in the environment</li>
            <li>Incorrect domain configuration in Google reCAPTCHA admin</li>
            <li>Browser extensions blocking the reCAPTCHA script</li>
          </ul>
          <p className="mt-1">This application is designed to run on resuming.ai or www.resuming.ai. Please access the site through the correct domain.</p>
        </div>
      );
    }
    
    // Development/other domains
    return (
      <div className="mt-2 text-xs text-gray-500">
        <p>Troubleshooting:</p>
        <ul className="list-disc list-inside mt-1 ml-2">
          <li>Check if NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set in .env</li>
          <li>Verify domain configuration in Google reCAPTCHA admin console</li>
          <li>Try disabling any content/script blockers in your browser</li>
        </ul>
      </div>
    );
  };

  // Determine if retry and skip buttons should be shown
  const showRetryButton = showRetry && onRetry && (status === 'error' || status === 'warning');
  const showSkipButton = onSkip && (status === 'error' || status === 'warning');

  return (
    <div
      className={cn(
        'flex flex-col rounded p-3 text-sm transition-colors',
        bgColor,
        textColor,
        className
      )}
    >
      <div className="flex items-start">
        <div className="mr-3 flex h-5 w-5 items-center">
          {status === 'loading' ? (
            <Icon className={cn('h-4 w-4 animate-spin', iconColor)} />
          ) : (
            <Icon className={cn('h-4 w-4', iconColor)} />
          )}
        </div>
        <div className="flex-1">
          <p className="leading-tight">{getDisplayMessage()}</p>
          {getTroubleshootingGuidance()}

          {(showRetryButton || showSkipButton) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {showRetryButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Try Again
                </Button>
              )}
              {showSkipButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="h-7 px-2 text-xs opacity-70 hover:opacity-100"
                >
                  <SkipForward className="mr-1 h-3 w-3" />
                  Continue Anyway
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 