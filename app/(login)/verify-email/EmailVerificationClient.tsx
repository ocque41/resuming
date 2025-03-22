'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { verifyEmailAction } from './actions';

export default function EmailVerificationClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'invalid' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [email, setEmail] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendMessage, setResendMessage] = useState<string>('');
  const [resendError, setResendError] = useState<boolean>(false);
  const [verificationAttempt, setVerificationAttempt] = useState<number>(1);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('invalid');
        setMessage('No verification token provided. Please check your email and try again.');
        return;
      }

      try {
        setIsRetrying(verificationAttempt > 1);
        const result = await verifyEmailAction(token);
        
        if (result.success) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
        } else if (result.expired) {
          setStatus('expired');
          setMessage('This verification link has expired. Please request a new one.');
        } else {
          setStatus('invalid');
          setMessage(result.message || 'Invalid verification token. Please check your email and try again.');
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        setStatus('error');
        setMessage('An unexpected response was received from the server. Please try again later.');
      } finally {
        setIsRetrying(false);
      }
    };

    verifyEmail();
  }, [token, verificationAttempt]);

  const handleRetryVerification = () => {
    setStatus('loading');
    setMessage('Retrying verification...');
    setVerificationAttempt(prev => prev + 1);
  };

  const handleResendVerification = async () => {
    if (!email) return;
    
    setIsResending(true);
    setResendMessage('');
    setResendError(false);
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResendMessage('Verification email sent! Please check your inbox.');
        setResendError(false);
      } else {
        setResendMessage(data.message || 'Failed to send verification email. Please try again later.');
        setResendError(true);
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      setResendMessage('An error occurred. Please try again later.');
      setResendError(true);
    } finally {
      setIsResending(false);
    }
  };

  const getEmailDomain = (email: string) => {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : null;
  };

  const getEmailProviderLink = (email: string) => {
    const domain = getEmailDomain(email);
    if (!domain) return null;
    
    const providers: Record<string, string> = {
      'gmail.com': 'https://mail.google.com',
      'outlook.com': 'https://outlook.live.com',
      'hotmail.com': 'https://outlook.live.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'icloud.com': 'https://www.icloud.com/mail',
      'aol.com': 'https://mail.aol.com',
      'protonmail.com': 'https://mail.proton.me',
    };
    
    return providers[domain] || null;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img src="/white.png" alt="Resuming Logo" width={150} height={150} />
          </Link>
        </div>
        
        <motion.div
          className="bg-[#0D0D0D] shadow-xl rounded-lg overflow-hidden border border-[#222222]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              {status === 'loading' && (
                <>
                  <Loader2 className="h-16 w-16 text-[#B4916C] animate-spin mb-6" />
                  <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">
                    {isRetrying ? 'Retrying Verification' : 'Verifying Your Email'}
                  </h2>
                  <p className="text-[#C5C2BA] font-borna mb-6">{message}</p>
                </>
              )}
              
              {status === 'success' && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                  >
                    <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">Email Verified!</h2>
                  <p className="text-[#C5C2BA] font-borna mb-6">{message}</p>
                  <div className="mt-4">
                    <Link href="/dashboard" passHref>
                      <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro">
                        Continue to Dashboard
                      </Button>
                    </Link>
                  </div>
                </>
              )}
              
              {status === 'error' && (
                <>
                  <AlertTriangle className="h-16 w-16 text-red-500 mb-6" />
                  <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">Verification Error</h2>
                  <p className="text-[#C5C2BA] font-borna mb-6">{message}</p>
                  
                  <div className="flex flex-col space-y-3">
                    <Button 
                      onClick={handleRetryVerification} 
                      className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Verification
                    </Button>
                    
                    <Link href="/sign-in" passHref>
                      <Button variant="outline" className="border-[#333333] text-[#C5C2BA] hover:bg-[#1A1A1A] font-safiro">
                        Back to Sign In
                      </Button>
                    </Link>
                  </div>
                </>
              )}
              
              {(status === 'expired' || status === 'invalid') && (
                <>
                  <AlertTriangle className="h-16 w-16 text-[#FCD34D] mb-6" />
                  <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">
                    {status === 'expired' ? 'Link Expired' : 'Verification Failed'}
                  </h2>
                  <p className="text-[#C5C2BA] font-borna mb-6">{message}</p>
                  
                  <div className="w-full max-w-xs mt-4 mb-6">
                    <p className="text-[#C5C2BA] text-sm mb-2 font-borna">Enter your email to get a new verification link:</p>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email address"
                      className="appearance-none rounded-full block w-full px-3 py-2 border border-[#B4916C]/30 placeholder-[#B4916C] text-white bg-[#9E7C57] focus:outline-none focus:ring-[#B4916C] focus:border-[#B4916C] sm:text-sm mb-3"
                    />
                    <Button 
                      onClick={handleResendVerification} 
                      disabled={!email || isResending}
                      className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro flex items-center justify-center"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resend Verification Email
                        </>
                      )}
                    </Button>
                    
                    {resendMessage && (
                      <motion.p 
                        className={`text-sm mt-2 ${resendError ? 'text-red-400' : 'text-green-400'}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {resendMessage}
                      </motion.p>
                    )}
                    
                    {email && !resendError && resendMessage && getEmailProviderLink(email) && (
                      <div className="mt-4">
                        <a 
                          href={getEmailProviderLink(email)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[#B4916C] hover:underline text-sm"
                        >
                          Open {getEmailDomain(email)} in new tab
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <Link href="/sign-in" passHref>
                      <Button variant="outline" className="border-[#333333] text-[#C5C2BA] hover:bg-[#1A1A1A] font-safiro">
                        Back to Sign In
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
        
        <div className="mt-6 text-center">
          <p className="text-[#8A8782] font-borna">
            Need help? Contact our{' '}
            <Link href="/contact" className="text-[#B4916C] hover:underline">
              support team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 