'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailVerificationBannerProps {
  email: string;
}

export default function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  
  const handleClose = () => {
    setIsVisible(false);
  };
  
  const handleResendVerification = async () => {
    setIsResending(true);
    setResendSuccess(false);
    setResendError('');
    
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResendSuccess(true);
      } else {
        setResendError(data.error || 'Failed to resend verification email');
      }
    } catch (err) {
      setResendError('An unexpected error occurred');
      console.error('Error resending verification email:', err);
    } finally {
      setIsResending(false);
    }
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 bg-[#1A140A] border-b border-[#B4916C]/30"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center">
                <Mail className="text-[#B4916C] h-5 w-5 mr-2 flex-shrink-0" />
                <p className="text-[#F9F6EE] font-borna text-sm">
                  <span className="font-medium">Please verify your email address: </span>
                  {email}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                {!isResending && !resendSuccess ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendVerification}
                    className="text-xs h-8 bg-transparent text-[#B4916C] border border-[#B4916C]/40 hover:bg-[#B4916C]/10"
                  >
                    Resend Verification Email
                  </Button>
                ) : isResending ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-xs h-8 bg-transparent text-[#B4916C] border border-[#B4916C]/40"
                  >
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Sending...
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-green-500 text-xs bg-green-500/10 py-1 px-2 rounded-md"
                  >
                    Verification email sent
                  </motion.div>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full text-[#C5C2BA] hover:text-[#F9F6EE] hover:bg-[#111111]/40"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>
            
            {resendError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-red-400 text-xs flex items-center"
              >
                <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                {resendError}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 