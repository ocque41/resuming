"use client";

import React from 'react';
import { AlertCircle, Shield, Loader2, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
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
 * icons and messages. Provides retry options when verification fails and
 * specific guidance for configuration issues.
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
          {message || status === 'loading' ? 'Verifying...' : status === 'success' ? 'Verification successful' : 'Verification failed'}
        </p>
        
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
                Verify that your domain is in the list of allowed domains
              </p>
              <p>
                <span className="inline-block w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full text-center text-xs mr-1">3</span>
                Ensure environment variables are properly set
              </p>
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
            </ul>
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
            
            {onSkip && (isConfigError || status === 'warning') && (
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onSkip}
                className="text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 transition-colors"
              >
                Continue Without Verification
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
} 