"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Mail, Loader } from 'lucide-react';
import { resendVerificationEmail } from '@/app/resend-verification/actions';

interface VerificationStatusCardProps {
  isVerified: boolean;
  email: string;
}

export default function VerificationStatusCard({ isVerified, email }: VerificationStatusCardProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendResult, setResendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const result = await resendVerificationEmail(email);
      setResendResult(result);
    } catch (error) {
      setResendResult({
        success: false,
        message: "Failed to resend verification email. Please try again."
      });
    } finally {
      setIsResending(false);
    }
  };

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    }
  };
  
  return (
    <motion.div variants={itemVariants}>
      <Card className={`border shadow-lg transition-all duration-300 rounded-xl overflow-hidden ${
        isVerified 
          ? 'border-green-600/30 bg-green-900/10' 
          : 'border-yellow-600/30 bg-yellow-900/10'
      }`}>
        <CardHeader className={`pb-4 border-b ${
          isVerified 
            ? 'bg-green-900/20 border-green-600/20' 
            : 'bg-yellow-900/20 border-yellow-600/20'
        }`}>
          <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro flex items-center">
            {isVerified ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                Email Verified
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-400" />
                Email Verification Required
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <Mail className="w-5 h-5 mr-3 text-[#B4916C]" />
              <span className="text-[#F9F6EE] font-borna">{email}</span>
            </div>
            
            {isVerified ? (
              <p className="text-green-400 text-sm font-borna">
                Your email has been verified. You have full access to all features.
              </p>
            ) : (
              <>
                <p className="text-[#C5C2BA] text-sm font-borna">
                  Please verify your email address to unlock all features. Check your inbox for a verification link.
                </p>
                
                {resendResult && (
                  <div className={`p-3 rounded-lg text-sm ${
                    resendResult.success 
                      ? 'bg-green-900/20 text-green-400' 
                      : 'bg-red-900/20 text-red-400'
                  }`}>
                    {resendResult.message}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  className={`flex items-center ${
                    isResending 
                      ? 'bg-[#1A1A1A] text-[#999999]' 
                      : 'bg-[#B4916C]/10 text-[#B4916C] hover:bg-[#B4916C]/20'
                  } border-[#B4916C]/30`}
                  onClick={handleResendVerification}
                  disabled={isResending || (resendResult?.success === true)}
                >
                  {isResending ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 