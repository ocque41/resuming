'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import VerifyEmailClient from './verify-email-client';

export function SearchParamsProvider() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const email = searchParams?.get('email') || '';
  
  return <VerifyEmailClient token={token} email={email} />;
} 