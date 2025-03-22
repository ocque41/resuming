"use client";

import { AlertCircle, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resendVerificationEmail } from "@/app/resend-verification/actions";

interface EmailVerificationAlertProps {
  userEmail: string;
}

export function EmailVerificationAlert({ userEmail }: EmailVerificationAlertProps) {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [resendResult, setResendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const result = await resendVerificationEmail(userEmail);
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
  
  return (
    <Alert className="bg-[#272017] border border-[#B4916C]/30 mb-6 rounded-lg">
      <AlertCircle className="h-5 w-5 text-[#B4916C]" />
      <div className="ml-3 flex flex-col space-y-2 w-full">
        <AlertTitle className="text-[#F9F6EE] font-safiro">
          Email verification required
        </AlertTitle>
        <AlertDescription className="text-[#C5C2BA] font-borna">
          {!resendResult ? (
            <>
              Please verify your email address to unlock all features. We've sent a verification link to <strong>{userEmail}</strong>.
            </>
          ) : (
            <span className={resendResult.success ? "text-green-400" : "text-red-400"}>
              {resendResult.message}
            </span>
          )}
        </AlertDescription>
        <div className="flex flex-wrap gap-3 mt-2">
          {(!resendResult || !resendResult.success) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-[#B4916C]/10 border-[#B4916C]/30 text-[#B4916C] hover:bg-[#B4916C]/20 flex items-center"
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Resend Verification
                </>
              )}
            </Button>
          )}
          <Link href="/verification-required">
            <Button 
              variant="link" 
              size="sm"
              className="text-[#B4916C] hover:text-[#D3B595]"
            >
              Learn more
            </Button>
          </Link>
        </div>
      </div>
    </Alert>
  );
} 