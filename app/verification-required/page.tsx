import React from 'react';
import { Mail, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function VerificationRequiredPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="flex justify-center mb-6">
        <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
      </div>
      
      <div className="max-w-md w-full bg-[#111111] p-8 rounded-lg shadow-lg border border-[#333333]">
        <div className="text-center mb-8">
          <div className="bg-[#333333]/20 p-4 rounded-full inline-flex justify-center items-center mb-4">
            <Mail className="h-12 w-12 text-[#B4916C]" />
          </div>
          <h1 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">Email Verification Required</h1>
          <p className="text-[#C5C2BA] font-borna">
            Please verify your email address before continuing
          </p>
        </div>
        
        <div className="bg-[#1A1A1A] p-4 rounded-lg mb-6 font-borna">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-[#FCD34D] mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-[#C5C2BA] text-sm">
              We've sent a verification link to your email address. Please check your inbox (and spam folder) and click the link to verify your account.
            </p>
          </div>
        </div>
        
        <div className="text-center space-y-4">
          <p className="text-sm text-[#8A8782] font-borna">
            Didn't receive an email? Check your spam folder or
          </p>
          
          <Link 
            href="/resend-verification" 
            className="inline-flex justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#050505] bg-[#B4916C] hover:bg-[#B4916C]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
          >
            Resend Verification Email
          </Link>
          
          <Link 
            href="/sign-in" 
            className="inline-flex justify-center w-full py-2 px-4 border border-[#333333] rounded-md shadow-sm text-sm font-medium text-[#F9F6EE] bg-transparent hover:bg-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
} 