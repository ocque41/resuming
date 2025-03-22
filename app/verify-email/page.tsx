'use client';

import React, { Suspense } from 'react';
import VerifyEmailClient from './verify-email-client';
import { SearchParamsProvider } from './search-params-provider';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center text-white">Loading...</div>}>
          <SearchParamsProvider />
        </Suspense>
      </div>
    </div>
  );
} 