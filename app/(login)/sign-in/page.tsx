// app/(login)/sign-in/page.tsx
'use client';

import React, { Suspense } from 'react';
import { Login } from '../login';

export const dynamic = 'force-dynamic'; // Ensures the page is not statically prerendered

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Login mode="signin" />
    </Suspense>
  );
}
