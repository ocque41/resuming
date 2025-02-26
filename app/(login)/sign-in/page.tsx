'use client';

import React, { Suspense } from 'react';
import { Login } from '../login';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Login mode="signin" />
    </Suspense>
  );
}
