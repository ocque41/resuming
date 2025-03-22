'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailVerificationStatusProps {
  email: string;
  isVerified: boolean;
}

export default function EmailVerificationStatus({ 
  email, 
  isVerified 
}: EmailVerificationStatusProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  
  const handleResendVerification = async () => {
    if (isVerified || isResending) return;
    
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
    <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
      <CardHeader className="bg-[#0D0D0D] pb-4 border-b border-[#222222]">
        <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro flex items-center">
          <Mail className="w-5 h-5 mr-2 text-[#B4916C]" />
          Email Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F9F6EE] font-borna">
                <span className="font-medium">Email: </span>
                {email}
              </p>
              <p className="text-[#8A8782] font-borna text-sm mt-1">
                {isVerified 
                  ? 'Your email address is verified.' 
                  : 'Please verify your email address to access all features.'}
              </p>
            </div>
            <div className="flex-shrink-0">
              {isVerified ? (
                <div className="bg-[#0D1F15] text-green-500 p-2 rounded-full">
                  <Check className="w-5 h-5" />
                </div>
              ) : (
                <div className="bg-[#1A140A] text-[#B4916C] p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
          
          {!isVerified && (
            <div>
              {!isResending && !resendSuccess ? (
                <Button
                  onClick={handleResendVerification}
                  className="w-full bg-[#222222] hover:bg-[#333333] text-[#F9F6EE] font-medium font-safiro h-10 transition-all duration-300"
                >
                  Resend Verification Email
                </Button>
              ) : isResending ? (
                <Button
                  disabled
                  className="w-full bg-[#222222] text-[#F9F6EE] font-medium font-safiro h-10"
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending verification email...
                </Button>
              ) : null}
              
              {resendSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-[#0D1F15] rounded-lg text-green-500 text-sm flex items-start"
                >
                  <Check className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Verification email sent successfully. Please check your inbox and click the verification link.</span>
                </motion.div>
              )}
              
              {resendError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-[#1A0505] rounded-lg text-red-400 text-sm flex items-start"
                >
                  <AlertTriangle className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{resendError}</span>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 