import { Suspense } from 'react';
import SignupSuccessClient from './signup-success-client';

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center p-6 text-[#F9F6EE]">Loading...</div>}>
          <SignupSuccessClient />
        </Suspense>
      </div>
    </div>
  );
} 