"use client";

import React from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ResendVerificationForm from './form';

export default function ResendVerificationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={180}
            height={40}
            className="h-12 w-auto mb-6"
          />
          <h2 className="mt-4 text-center text-3xl font-bold text-white">
            Resend verification email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your email address and we'll send you a new verification link.
          </p>
        </div>

        <div className="mt-8 bg-[#111111] shadow-xl rounded-xl p-8 border border-[#222222]">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-[#1E1E1E] rounded-full mb-5">
            <Mail className="h-6 w-6 text-[#B4916C]" aria-hidden="true" />
          </div>
          
          <ResendVerificationForm />
          
          <div className="mt-6 text-center">
            <Link 
              href="/sign-in" 
              className="text-sm text-[#B4916C] hover:text-[#D3B595]"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 