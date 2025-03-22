"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, AlertTriangle, Shield } from 'lucide-react';

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning';

interface ReCaptchaFeedbackProps {
  status: VerificationStatus;
  message?: string;
  score?: number;
  showScore?: boolean;
  className?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * ReCaptcha Feedback Component
 * 
 * This component provides visual feedback for reCAPTCHA verification states.
 * It shows different icons and messages based on the verification status.
 */
export default function ReCaptchaFeedback({
  status = 'idle',
  message,
  score,
  showScore = false,
  className = '',
  onRetry,
  compact = false,
}: ReCaptchaFeedbackProps) {
  // Get the appropriate icon based on status
  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 text-[#B4916C] animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'idle':
      default:
        return <Shield className="h-4 w-4 text-[#B4916C]" />;
    }
  };

  // Get the appropriate message based on status
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'loading':
        return 'Verifying...';
      case 'success':
        return 'Verification successful';
      case 'error':
        return 'Verification failed';
      case 'warning':
        return 'Additional verification may be required';
      case 'idle':
      default:
        return 'Verification required';
    }
  };

  // Get color class based on status
  const getColorClass = () => {
    switch (status) {
      case 'success':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30';
      case 'error':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30';
      case 'warning':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/30';
      case 'loading':
        return 'text-[#B4916C] bg-[#B4916C]/5 border-[#B4916C]/20';
      case 'idle':
      default:
        return 'text-[#F9F6EE] bg-[#111111] border-[#222222]';
    }
  };

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.5) return 'text-[#B4916C]';
    if (score >= 0.3) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Display score as percentage
  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  if (compact) {
    // Compact version - just the icon and minimal text
    return (
      <motion.div 
        className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs ${getColorClass()} ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {getStatusIcon()}
        <span>{status === 'loading' ? 'Verifying' : ''}</span>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={status}
        className={`flex items-center gap-2 p-2 text-sm border rounded-md ${getColorClass()} ${className}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex-shrink-0">
          {getStatusIcon()}
        </div>
        
        <div className="flex-grow min-w-0">
          <p className="text-xs font-medium truncate">
            {getStatusMessage()}
          </p>
          
          {showScore && score !== undefined && (
            <p className={`text-xs ${getScoreColor(score)}`}>
              Score: {formatScore(score)}
            </p>
          )}
        </div>
        
        {status === 'error' && onRetry && (
          <button 
            onClick={onRetry}
            className="text-xs text-[#B4916C] hover:text-[#A3815B] ml-auto"
          >
            Retry
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
} 