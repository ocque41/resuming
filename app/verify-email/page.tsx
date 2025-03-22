import React from 'react';
import { redirect } from 'next/navigation';
import { verifyEmailWithToken } from '@/lib/auth/verification';
import { sendWelcomeEmail } from '@/lib/email/send-welcome';
import { updateUserVerificationInNotion } from '@/lib/notion/client';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import Link from 'next/link';
import { recordAttempt } from '@/lib/auth/rate-limiter';
import { logVerificationActivity } from '@/lib/auth/verification-logger';
import { db } from '@/lib/db/drizzle';
import { activityLogs, ActivityType } from '@/lib/db/schema';

// Server component to handle email verification
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const token = searchParams.token as string | undefined;
  const email = searchParams.email as string | undefined;
  
  if (!token || !email) {
    redirect('/sign-in');
  }
  
  const result = await verifyEmailWithToken(email, token);
  
  // If verification was successful, send welcome email and update Notion
  if (result.success) {
    try {
      // Log successful verification if we have a user ID
      if (result.userId) {
        await logVerificationActivity(result.userId, ActivityType.EMAIL_VERIFIED);
      }
      
      // Send welcome email
      await sendWelcomeEmail(email);
      
      // Update Notion database
      await updateUserVerificationInNotion(email, true);
    } catch (error) {
      console.error('Error sending welcome email or updating Notion:', error);
      // Continue with success page even if these fail
    }
  } else {
    // Record failed attempt for rate limiting
    recordAttempt(`verify-${email}`);
    
    // Log failed verification attempt if we can find the user
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, email)
      });
      
      if (user) {
        await logVerificationActivity(user.id, ActivityType.VERIFICATION_FAILED);
      }
    } catch (error) {
      console.error('Error logging verification failure:', error);
    }
  }
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#111111] py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-[#333333]">
          {result.success ? (
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-[#4ADE80] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">Email Verified</h2>
              <p className="text-[#C5C2BA] mb-8 font-borna">
                Your email has been successfully verified. You can now sign in to your account.
              </p>
              <Link 
                href="/dashboard/pricing" 
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-[#050505] bg-[#B4916C] hover:bg-[#B4916C]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-[#F87171] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[#F9F6EE] mb-2 font-safiro">Verification Failed</h2>
              <p className="text-[#C5C2BA] mb-4 font-borna">
                {result.error || 'There was a problem verifying your email.'}
              </p>
              <p className="text-[#C5C2BA] mb-8 font-borna">
                Please try signing in to request a new verification email.
              </p>
              <Link 
                href="/sign-in" 
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-[#050505] bg-[#B4916C] hover:bg-[#B4916C]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 