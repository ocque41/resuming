"use client";

import React from 'react';
import { AlertCircle, Shield, Loader2, CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Info, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PRODUCTION_DOMAINS } from '@/lib/recaptcha/domain-check';

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
 * ReCaptcha Feedback Component
 * 
 * Displays the current status of reCAPTCHA verification with appropriate
 * icons and messages. Provides retry options when verification fails and
 * specific guidance for configuration issues.
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
  // No icon for idle status
  if (status === 'idle') return null;

  // Map status to icon and colors
  const statusConfig = {
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800'
    },
    success: {
      icon: <CheckCircle className="h-4 w-4" />,
      bg: 'bg-green-50 dark:bg-green-950/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800'
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      bg: 'bg-red-50 dark:bg-red-950/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800'
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-200 dark:border-yellow-800'
    },
    idle: {
      icon: <Shield className="h-4 w-4" />,
      bg: 'bg-gray-50 dark:bg-gray-900',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700'
    }
  };

  const config = statusConfig[status];
  
  // Get current domain
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const isResumingDomain = PRODUCTION_DOMAINS.includes(currentDomain);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProdEnvironment = process.env.NODE_ENV === 'production';

  // Detect specific error types for custom messages
  const isConfigError = status === 'error' && (
    message?.includes('not properly configured') || 
    message?.includes('missing') ||
    message?.includes('API key')
  );
  
  const isNetworkError = status === 'error' && (
    message?.includes('network') || 
    message?.includes('fetch') || 
    message?.includes('timeout') ||
    message?.includes('failed to load')
  );
  
  const isTokenError = status === 'error' && (
    message?.includes('token') || 
    message?.includes('verification')
  );
  
  const isLowScoreError = status === 'warning' && 
    score !== undefined && 
    score < 0.5;
  
  const isDomainError = status === 'error' && 
    message?.includes('domain');

  // Format score to 2 decimal places if available
  const formattedScore = score !== undefined ? score.toFixed(2) : undefined;

  // Format timestamp to display in error details
  const currentTimestamp = new Date().toISOString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-md p-3 flex items-start space-x-2 text-sm border', 
        config.bg, 
        config.text, 
        config.border,
        className
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{config.icon}</span>
      <div className="flex-1">
        <p className="font-medium">
          {message || (
            status === 'loading' ? 'Verifying your request...' : 
            status === 'success' ? 'Verification successful' : 
            status === 'warning' ? 'Verification needs attention' :
            'Verification failed'
          )}
        </p>
        
        {/* Show score information if available */}
        {score !== undefined && status === 'success' && (
          <p className="text-xs mt-1 flex items-center">
            <Info className="h-3 w-3 mr-1" />
            Trust score: <span className="font-medium ml-1">{formattedScore}</span>
            {action && <span className="ml-1">({action})</span>}
          </p>
        )}
        
        {isConfigError && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="mb-1">The reCAPTCHA service is not properly configured. This could be due to:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Missing reCAPTCHA API keys in the environment</li>
              <li>Incorrect domain configuration in Google reCAPTCHA admin</li>
              <li>Browser extensions blocking the reCAPTCHA script</li>
            </ul>
            
            <div className="mt-2 text-xs space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">Troubleshooting:</p>
              {isResumingDomain ? (
                <p>
                  <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full text-center text-xs mr-1">!</span>
                  This is unexpected on the resuming.ai domain. Please try again or contact support.
                </p>
              ) : (
                <>
                  <p>
                    <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full text-center text-xs mr-1">1</span>
                    Check if your site is properly registered in the
                    <a 
                      href="https://www.google.com/recaptcha/admin" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline ml-1 inline-flex items-center"
                    >
                      reCAPTCHA admin console
                      <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  </p>
                  <p>
                    <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full text-center text-xs mr-1">2</span>
                    Verify that your domain ({currentDomain}) is in the list of allowed domains
                  </p>
                  <p>
                    <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full text-center text-xs mr-1">3</span>
                    Ensure environment variables for NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are properly set
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        
        {isNetworkError && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="mb-1">There was a network issue connecting to the reCAPTCHA service:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Check your internet connection</li>
              <li>Disable any browser extensions that might block scripts</li>
              <li>Try refreshing the page</li>
              {isResumingDomain && (
                <li>This is unexpected on resuming.ai. Please try again or contact support if the issue persists.</li>
              )}
            </ul>
            
            {isDevelopment && (
              <p className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-800 rounded">
                <span className="font-medium">Debug info:</span> Network error on {currentDomain} at {currentTimestamp.slice(0, 19)}
              </p>
            )}
          </div>
        )}
        
        {isTokenError && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p>The verification process couldn't be completed. This could be due to:</p>
            <ul className="list-disc pl-4 space-y-0.5 mt-1">
              <li>The verification token expired</li>
              <li>The verification request was rejected</li>
              <li>There was an error communicating with Google servers</li>
            </ul>
            
            {isResumingDomain && isProdEnvironment ? (
              <p className="mt-1 text-red-600 dark:text-red-400">
                This is unexpected on the resuming.ai production site. 
                Please try again later or contact support if the issue persists.
              </p>
            ) : (
              <p className="mt-1 text-gray-500 dark:text-gray-500">
                You can try again or continue without verification during development.
              </p>
            )}
            
            {details && (
              <div className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                {Object.entries(details).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium w-24 truncate">{key}:</span>
                    <span className="ml-1">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                ))}
                <div className="flex">
                  <span className="font-medium w-24 truncate">domain:</span>
                  <span className="ml-1">{currentDomain}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24 truncate">time:</span>
                  <span className="ml-1">{currentTimestamp}</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {isLowScoreError && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="mb-1">Our security check flagged this request as potentially suspicious:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Trust score: <span className="font-medium">{formattedScore}</span> (below threshold)</li>
              {action && <li>Action: {action}</li>}
              <li>Please try again or use a different method to verify</li>
            </ul>
            <p className="mt-1 text-gray-500 dark:text-gray-500 text-xs italic">
              This doesn't necessarily mean you're a bot - it could be due to network issues,
              VPNs, or unusual browsing patterns.
            </p>
            
            {isDevelopment && details && (
              <div className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                <div className="flex">
                  <span className="font-medium w-24 truncate">score:</span>
                  <span className="ml-1">{formattedScore}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24 truncate">action:</span>
                  <span className="ml-1">{action || 'unknown'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-24 truncate">domain:</span>
                  <span className="ml-1">{currentDomain}</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {isDomainError && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="mb-1">Domain verification issue:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Current domain: <span className="font-medium">{currentDomain}</span></li>
              <li>Allowed domains: <span className="font-medium">{PRODUCTION_DOMAINS.join(', ')}</span></li>
              <li>This application should only run on the approved domains</li>
            </ul>
            
            {isDevelopment ? (
              <p className="mt-1 text-yellow-600 dark:text-yellow-400">
                You're in development mode on {currentDomain}. You can continue, but production features may be limited.
              </p>
            ) : (
              <p className="mt-1 text-red-600 dark:text-red-400">
                This application is designed to run on {PRODUCTION_DOMAINS.join(' or ')}. 
                Please access the site through the correct domain.
              </p>
            )}
          </div>
        )}
        
        {(showRetry && (status === 'error' || status === 'warning')) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onRetry}
                className="text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 transition-colors inline-flex items-center"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry Verification
              </motion.button>
            )}
            
            {onSkip && (
              // Show skip button only in certain conditions
              ((isConfigError || status === 'warning') || 
              (!isProdEnvironment && status === 'error') || 
              (isDevelopment && currentDomain !== 'resuming.ai' && currentDomain !== 'www.resuming.ai')) && (
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onSkip}
                  className="text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 transition-colors inline-flex items-center"
                >
                  <ArrowRight className="h-3 w-3 mr-1.5" />
                  Continue Without Verification
                </motion.button>
              )
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
} 