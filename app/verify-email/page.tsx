'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VerifyEmailClient from './verify-email-client';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const email = searchParams?.get('email') || '';
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center text-white">Loading...</div>}>
          <VerifyEmailClient token={token} email={email} />
        </Suspense>
      </div>
    </div>
  );
} 