"use client";

import React from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, RefreshCw, SkipForward } from 'lucide-react';
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
    // If a custom message is provided, use that
    if (message) return message;

    // Format score for display if available
    const formattedScore = score !== undefined ? score.toFixed(2) : undefined;

    // Get current domain
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProdDomain = isProductionDomain(domain);
    const currentDomain = formatDomain(domain);
    
    // Default messages based on status
    switch (status) {
      case 'idle':
        return 'Waiting for verification...';
      case 'loading':
        return 'Verifying your request...';
      case 'success':
        return formattedScore
          ? `Verification successful with trust score: ${formattedScore}`
          : 'Verification successful';
      case 'error':
        // Detect specific error types from details
        if (details) {
          // Configuration errors
          if (details.configError || details.missingKey) {
            return isProdDomain
              ? `Critical: reCAPTCHA site key and secret key are missing on production domain ${currentDomain}`
              : 'reCAPTCHA is not properly configured. Missing API keys.';
          }
          
          // Network errors
          if (details.networkError) {
            return isProdDomain
              ? `Network error while verifying on ${currentDomain}. Please check your connection and try again.`
              : 'Network error during verification. Please check your connection.';
          }
          
          // Token errors
          if (details.tokenError) {
            return isProdDomain
              ? `Error verifying your token on ${currentDomain}. Please try again.`
              : 'Error verifying your token. Please try again.';
          }
          
          // Low score errors
          if (details.lowScore && formattedScore) {
            return `Verification failed: Trust score ${formattedScore} is too low${action ? ` for ${action}` : ''}`;
          }
          
          // Domain errors
          if (details.domainError) {
            return `Domain verification issue:\n\nCurrent domain: ${currentDomain}\nAllowed domains: resuming.ai, www.resuming.ai\nThis application should only run on the approved domains`;
          }
        }
        
        // Default error message based on action
        return action
          ? getErrorMessageForAction(action, score)
          : 'Verification failed. Please try again.';
        
      case 'warning':
        if (isProdDomain) {
          return `This is unexpected on the ${currentDomain} domain. Please try again or contact support.`;
        }
        return 'Verification warning. You may need to try again.';
      default:
        return 'Verification status unknown';
    }
  };

  // Create guidance message for configuration issues
  const getTroubleshootingGuidance = () => {
    if (status !== 'error') return null;
    
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProdDomain = isProductionDomain(domain);

    if (details?.configError || details?.missingKey) {
      return isProdDomain ? (
        <div className="mt-2 text-xs opacity-80">
          <p>The reCAPTCHA service is not properly configured. This could be due to:</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>Missing reCAPTCHA API keys in the environment</li>
            <li>Incorrect domain configuration in Google reCAPTCHA admin</li>
            <li>Browser extensions blocking the reCAPTCHA script</li>
          </ul>
          <p className="mt-2">This application is designed to run on resuming.ai or www.resuming.ai. Please access the site through the correct domain.</p>
        </div>
      ) : (
        <div className="mt-2 text-xs opacity-80">
          <p>The reCAPTCHA configuration is missing. Developers should:</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>Check if NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set in environment variables</li>
            <li>Verify RECAPTCHA_SECRET_KEY is set on the server</li>
            <li>Ensure domains are configured in the Google reCAPTCHA admin console</li>
          </ul>
        </div>
      );
    }
    
    return null;
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