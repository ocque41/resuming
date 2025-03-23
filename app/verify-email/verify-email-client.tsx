'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, Loader2, ArrowRight, RefreshCw, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface VerifyEmailClientProps {
  token: string;
  email: string;
}

export default function VerifyEmailClient({ token, email }: VerifyEmailClientProps) {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || !email) {
        setIsVerifying(false);
        setError('Missing verification token or email');
        return;
      }

      try {
        const response = await fetch('/api/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, email }),
        });

        const data = await response.json();

        setIsVerifying(false);

        if (response.ok) {
          setIsSuccess(true);
          
          // Auto-subscribe to newsletter if the user opted in and verified email successfully
          if (subscribeToNewsletter) {
            handleNewsletterSubscription();
          }
        } else {
          setError(data.error || 'Failed to verify email');
        }
      } catch (err) {
        setIsVerifying(false);
        setError('An unexpected error occurred');
        console.error('Error verifying email:', err);
      }
    };

    verifyEmail();
  }, [token, email]);

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
      console.error('Error resending verification:', err);
    } finally {
      setIsResending(false);
    }
  };
  
  const handleNewsletterSubscription = async () => {
    if (isSubscribing) return;
    
    setIsSubscribing(true);
    setSubscriptionError('');
    
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSubscriptionSuccess(true);
      } else {
        setSubscriptionError(data.error || 'Failed to subscribe to newsletter');
      }
    } catch (err) {
      setSubscriptionError('An unexpected error occurred');
      console.error('Error subscribing to newsletter:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleToggleNewsletter = (checked: boolean) => {
    setSubscribeToNewsletter(checked);
    
    if (checked && isSuccess && !subscriptionSuccess && !isSubscribing) {
      // If they're toggling subscription on after already verifying, subscribe them
      handleNewsletterSubscription();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={isVerifying ? 'verifying' : isSuccess ? 'success' : 'error'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-[#111111] border border-[#222222] shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-center text-[#F9F6EE] font-safiro">
                {isVerifying
                  ? 'Verifying Your Email'
                  : isSuccess
                  ? 'Email Verified!'
                  : 'Verification Failed'}
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col items-center text-center p-6">
              {isVerifying ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-[#0A0A0A] p-4 rounded-full">
                    <Loader2 className="h-12 w-12 text-[#B4916C] animate-spin" />
                  </div>
                  <p className="text-[#C5C2BA] font-borna">
                    Please wait while we verify your email address...
                  </p>
                  <p className="text-[#8A8782] text-sm mt-2">
                    If you've already confirmed your email in another tab, please refresh this page.
                  </p>
                </div>
              ) : isSuccess ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-[#0D1F15] p-4 rounded-full">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[#F9F6EE] font-borna text-lg">
                      Your email has been successfully verified!
                    </p>
                    <p className="text-[#8A8782] font-borna">
                      You can now access all features of your account.
                    </p>
                  </div>
                  
                  <div className="mt-4 w-full max-w-xs p-4 bg-[#161616] rounded-lg border border-[#222222]">
                    <div className="flex items-center justify-between space-x-2 mb-2">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-[#B4916C] mr-2" />
                        <Label htmlFor="newsletter-subscribe" className="text-[#F9F6EE] font-borna text-sm">
                          Get latest updates first
                        </Label>
                      </div>
                      <Switch
                        id="newsletter-subscribe"
                        checked={subscribeToNewsletter}
                        onCheckedChange={handleToggleNewsletter}
                        disabled={isSubscribing || subscriptionSuccess}
                      />
                    </div>
                    <p className="text-[#8A8782] text-xs">
                      Get the tips, articles and exclusive offers
                    </p>
                    
                    {isSubscribing && (
                      <div className="mt-2 flex items-center justify-center">
                        <Loader2 className="h-3 w-3 text-[#B4916C] animate-spin mr-1" />
                        <span className="text-xs text-[#C5C2BA]">Subscribing...</span>
                      </div>
                    )}
                    
                    {subscriptionSuccess && (
                      <div className="mt-2 text-xs text-green-500">
                        Successfully subscribed to our newsletter!
                      </div>
                    )}
                    
                    {subscriptionError && (
                      <div className="mt-2 text-xs text-red-400">
                        {subscriptionError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-[#1A0505] p-4 rounded-full">
                    <X className="h-12 w-12 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[#F9F6EE] font-borna text-lg">
                      There was a problem verifying your email
                    </p>
                    <p className="text-red-400 font-borna">{error}</p>
                    <p className="text-[#8A8782] text-sm mt-2">
                      If you have already confirmed your email through another link, please try refreshing this page.
                    </p>
                  </div>

                  {!isResending && !resendSuccess ? (
                    <Button
                      onClick={handleResendVerification}
                      className="mt-4 bg-[#222222] hover:bg-[#333333] text-[#F9F6EE]"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Verification Email
                    </Button>
                  ) : isResending ? (
                    <Button
                      disabled
                      className="mt-4 bg-[#222222] hover:bg-[#333333] text-[#F9F6EE]"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </Button>
                  ) : null}

                  {resendSuccess && (
                    <div className="mt-4 p-3 bg-[#0D1F15] rounded-lg text-green-500 text-sm">
                      Verification email resent successfully. Please check your inbox.
                    </div>
                  )}

                  {resendError && (
                    <div className="mt-4 p-3 bg-[#1A0505] rounded-lg text-red-400 text-sm">
                      {resendError}
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-center p-6 pt-0">
              <Link href={isSuccess ? '/dashboard' : '/sign-in'} className="w-full">
                <Button
                  className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro"
                >
                  {isSuccess ? 'Go to Dashboard' : 'Return to Sign In'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 