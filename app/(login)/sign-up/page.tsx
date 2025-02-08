// app/(login)/sign-up/page.tsx
'use client';

import React, { Suspense } from 'react';
import { Login } from '../login';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Login mode="signup" />
    </Suspense>
  );
}
