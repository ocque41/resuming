'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Mail, Bell, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useSearchParams } from "next/navigation";

export default function SignupSuccessClient() {
  const searchParams = useSearchParams();
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Check URL parameters
  useEffect(() => {
    // Parse URL parameters for errors and subscription status
    const emailErrorParam = searchParams?.get('emailError');
    const notionErrorParam = searchParams?.get('notionError');
    const newsletterParam = searchParams?.get('newsletter');
    
    if (emailErrorParam) {
      setEmailError(decodeURIComponent(emailErrorParam));
    }
    
    if (notionErrorParam) {
      setNotionError(decodeURIComponent(notionErrorParam));
    }
    
    if (newsletterParam === 'true') {
      setIsSubscribed(true);
    }
    
    // Try to get the user's email from localStorage (set during signup)
    const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
  }, [searchParams]);
  
  // Handle resending verification email
  const handleResendVerification = async () => {
    if (!userEmail) {
      setResendError("Email address not found. Please sign in to verify your account.");
      return;
    }
    
    setIsResendingEmail(true);
    setResendSuccess(false);
    setResendError(null);
    
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResendSuccess(true);
      } else {
        setResendError(data.error || 'Failed to resend verification email. Please try again later.');
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      setResendError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  return (
    <>
      <div className="flex justify-center mb-6">
        <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
      </div>
      
      <Card className="bg-[#111111] border border-[#222222] shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-center text-[#F9F6EE] font-safiro">
            Account Created Successfully!
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Your account has been created. 
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center text-center p-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-[#0D1F15] p-4 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            
            <div className="space-y-4">
              <p className="text-[#F9F6EE] font-borna text-lg">
                Welcome aboard!
              </p>
              
              <div className="bg-[#161616] p-4 rounded-lg border border-[#222222]">
                <div className="flex items-center mb-2">
                  <Mail className="text-[#B4916C] h-5 w-5 mr-2" />
                  <p className="text-[#F9F6EE] font-medium">Email Verification</p>
                </div>
                
                {emailError ? (
                  <div className="mt-2 mb-3">
                    <div className="flex items-start bg-[#1A0505] p-3 rounded-md">
                      <AlertTriangle className="text-red-400 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <p className="text-red-400 text-sm font-medium">
                          We couldn't send a verification email to your address. This happens sometimes due to email service limitations.
                        </p>
                        <p className="text-[#C5C2BA] text-xs mt-1">
                          {emailError.includes('domain is not verified') 
                            ? 'Our email system is currently undergoing maintenance.' 
                            : 'There was an issue sending verification emails.'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="mt-2 h-8 bg-transparent border-red-400/30 text-red-400 hover:bg-red-400/10 text-xs"
                          onClick={handleResendVerification}
                          disabled={isResendingEmail}
                        >
                          {isResendingEmail ? (
                            <>
                              <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Resend Verification Email"
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {resendSuccess && (
                      <div className="flex items-start bg-[#0D1F15] p-3 rounded-md mt-2">
                        <CheckCircle className="text-green-500 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                        <p className="text-green-500 text-sm text-left">
                          Verification email has been sent successfully!
                        </p>
                      </div>
                    )}
                    
                    {resendError && (
                      <div className="flex items-start bg-[#1A0505] p-3 rounded-md mt-2">
                        <AlertTriangle className="text-red-400 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                        <p className="text-red-400 text-sm text-left">
                          {resendError}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-[#C5C2BA] text-sm">
                      We've sent a verification email to your inbox. Please verify your email to fully activate your account.
                    </p>
                  </>
                )}
              </div>
              
              {notionError && (
                <div className="bg-[#1A140A] p-4 rounded-lg border border-[#3A2D1A]">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="text-[#B4916C] h-5 w-5 mr-2" />
                    <p className="text-[#F9F6EE] font-medium">Integration Notice</p>
                  </div>
                  <p className="text-[#C5C2BA] text-sm">
                    There was an issue with our Notion integration. This won't affect your ability to use the platform.
                  </p>
                  <p className="text-xs text-amber-500 mt-1">
                    {notionError}
                  </p>
                </div>
              )}
              
              {isSubscribed && (
                <div className="bg-[#0D1F15] p-4 rounded-lg border border-[#1A2E22]">
                  <div className="flex items-center mb-2">
                    <Bell className="text-green-500 h-5 w-5 mr-2" />
                    <p className="text-[#F9F6EE] font-medium">Newsletter Subscription</p>
                  </div>
                  <p className="text-[#A7D5A7] text-sm">
                    You're now subscribed to our newsletter! You'll receive updates, tips, and exclusive offers!
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center p-6 pt-0">
          <Link href="/sign-in" className="w-full">
            <Button
              className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro"
            >
              Go to Sign In
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </>
  );
} 