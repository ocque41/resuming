'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Mail, Bell, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SignupSuccessContent() {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'success' | 'failed'>('success');
  const [notionStatus, setNotionStatus] = useState<'success' | 'failed'>('success');
  const [email, setEmail] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [emailId, setEmailId] = useState<string | null>(null);
  const [isCheckingDelivery, setIsCheckingDelivery] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  
  const searchParams = useSearchParams();

  // Check URL params
  useEffect(() => {
    const newsletter = searchParams.get('newsletter');
    const verification = searchParams.get('verification');
    const notion = searchParams.get('notion');
    const userEmail = searchParams.get('email') || '';
    
    setIsSubscribed(newsletter === 'true');
    setVerificationStatus(verification === 'failed' ? 'failed' : 'success');
    setNotionStatus(notion === 'failed' ? 'failed' : 'success');
    setEmail(userEmail);

    // Check if the user's email is already verified
    if (userEmail) {
      checkVerificationStatus(userEmail);
    }

    // Check for email ID in the URL
    const params = new URLSearchParams(window.location.search);
    const emailIdParam = params.get('email_id');
    if (emailIdParam) {
      setEmailId(emailIdParam);
    }
  }, [searchParams]);

  // Check if the user's email is already verified
  const checkVerificationStatus = async (email: string) => {
    try {
      setIsCheckingVerification(true);
      const response = await fetch(`/api/verification-status?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      setIsVerified(data.verified);
    } catch (error) {
      console.error('Error checking verification status:', error);
      // Default to unverified in case of error
      setIsVerified(false);
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Handle resend verification email
  const handleResendVerification = async () => {
    if (!email || isResending) return;
    
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

  const checkDeliveryStatus = async () => {
    if (!emailId) return;
    
    setIsCheckingDelivery(true);
    try {
      const response = await fetch(`/api/email-stats?emailId=${emailId}`);
      if (!response.ok) {
        throw new Error('Failed to check delivery status');
      }
      
      const data = await response.json();
      if (data.success) {
        setDeliveryStatus(data.deliveryStatus?.status || 'unknown');
      }
    } catch (error) {
      console.error('Failed to check delivery status:', error);
    } finally {
      setIsCheckingDelivery(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
        </div>
        
        <Card className="bg-[#111111] border border-[#222222] shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-center text-[#F9F6EE] font-safiro">
              Account Created Successfully!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center text-center p-6">
            <div className="flex flex-col items-center space-y-6">
              <div className="bg-[#0D1F15] p-4 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              
              <div className="space-y-4">
                <p className="text-[#F9F6EE] font-borna text-lg">
                  Your account has been created successfully!
                </p>
                
                <div className={`${isVerified ? 'bg-[#0D1F15] border-[#1A2E22]' : 'bg-[#161616] border-[#222222]'} p-4 rounded-lg border`}>
                  <div className="flex items-center mb-2">
                    <Mail className={`${isVerified ? 'text-green-500' : 'text-[#B4916C]'} h-5 w-5 mr-2`} />
                    <p className="text-[#F9F6EE] font-medium">
                      {isVerified ? 'Email Verified' : 'Check Your Email'}
                    </p>
                  </div>
                  
                  {isCheckingVerification ? (
                    <div className="flex justify-center items-center py-3">
                      <Loader2 className="h-5 w-5 text-[#B4916C] animate-spin" />
                      <span className="ml-2 text-[#fff]/70">Checking verification status...</span>
                    </div>
                  ) : isVerified ? (
                    <p className="text-green-400">
                      Your email has been verified. You can now access all features!
                    </p>
                  ) : verificationStatus === 'failed' ? (
                    <div>
                      <div className="flex items-start mb-3 bg-[#1A1410] p-3 rounded-lg border border-[#B4916C]/30">
                        <AlertTriangle className="min-w-4 h-4 text-[#F79009] mr-2 mt-0.5" />
                        <div>
                          <p className="text-[#B4916C] text-sm">
                            We couldn't send a verification email. Your account has been created, but you'll need to verify your email to access all features.
                          </p>
                        </div>
                      </div>
                      
                      {!resendSuccess ? (
                        <Button
                          onClick={handleResendVerification}
                          disabled={isResending}
                          variant="outline"
                          size="sm"
                          className="text-white hover:text-white border-amber-800 hover:bg-amber-800/20 bg-transparent"
                        >
                          {isResending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Resend verification email'
                          )}
                        </Button>
                      ) : (
                        <p className="text-green-400 text-sm mt-2">
                          <CheckCircle className="inline-block mr-1 h-4 w-4" />
                          Verification email sent! Please check your inbox.
                        </p>
                      )}
                      
                      {resendError && (
                        <p className="text-red-400 text-sm mt-2">{resendError}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[#fff]/70 mb-3">
                        We've sent a verification email to your inbox. Please check your email and click the verification link.
                      </p>
                      
                      {!resendSuccess ? (
                        <Button
                          onClick={handleResendVerification}
                          disabled={isResending}
                          variant="outline"
                          size="sm"
                          className="text-white hover:text-white border-amber-800 hover:bg-amber-800/20 bg-transparent"
                        >
                          {isResending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Resend verification email'
                          )}
                        </Button>
                      ) : (
                        <p className="text-green-400 text-sm mt-2">
                          <CheckCircle className="inline-block mr-1 h-4 w-4" />
                          Verification email sent! Please check your inbox.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {isSubscribed && (
                  <div className="bg-[#0D1F15] p-4 rounded-lg border border-[#1A2E22]">
                    <div className="flex items-center mb-2">
                      <Bell className="text-green-500 h-5 w-5 mr-2" />
                      <p className="text-[#F9F6EE] font-medium">Newsletter Subscription</p>
                    </div>
                    <p className="text-[#A7D5A7] text-sm">
                      You've been subscribed to our newsletter. You'll receive updates, tips, and exclusive offers!
                    </p>
                  </div>
                )}
                
                <p className="text-[#8A8782] font-borna">
                  {isVerified 
                    ? "Your email is verified. You have full access to all features!"
                    : "Please verify your email to unlock all features of your account."}
                </p>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center p-6 pt-0">
            <Link href="/dashboard/pricing" className="w-full">
              <Button
                className={`w-full ${isVerified || verificationStatus === 'failed' 
                  ? 'bg-[#B4916C] hover:bg-[#A3815B]' 
                  : 'bg-[#333333] hover:bg-[#444444]'} text-[#050505] font-safiro relative overflow-hidden group`}
                disabled={!isVerified && verificationStatus !== 'failed'}
              >
                {!isVerified && verificationStatus !== 'failed' && (
                  <div className="absolute inset-0 bg-[#111111]/70 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="flex items-center text-[#F9F6EE] text-sm font-medium">
                      <Lock className="h-3 w-3 mr-1" />
                      Verify email first
                    </div>
                  </div>
                )}
                Continue to Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {emailId && !deliveryStatus && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkDeliveryStatus}
              disabled={isCheckingDelivery}
            >
              {isCheckingDelivery ? 'Checking...' : 'Check Email Delivery Status'}
            </Button>
          </div>
        )}
        
        {deliveryStatus && (
          <div className="mt-2 text-sm">
            <span>Delivery status: </span>
            <span className={
              deliveryStatus === 'delivered' ? 'text-green-600 font-medium' : 
              deliveryStatus === 'failed' ? 'text-red-600 font-medium' : 
              'text-amber-600 font-medium'
            }>
              {deliveryStatus === 'delivered' ? 'Delivered' : 
               deliveryStatus === 'failed' ? 'Failed' : 
               deliveryStatus === 'sent' ? 'Sent' : 'Unknown'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function SignupSuccessLoading() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
        </div>
        
        <Card className="bg-[#111111] border border-[#222222] shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-center text-[#F9F6EE] font-safiro">
              Account Created Successfully!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center text-center p-6">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#B4916C]" />
            </div>
            <p className="mt-4 text-[#F9F6EE] font-borna">Loading your account information...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={<SignupSuccessLoading />}>
      <SignupSuccessContent />
    </Suspense>
  );
} 