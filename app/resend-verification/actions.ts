'use server';

import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { users } from '@/lib/db/schema';
import { generateVerificationToken, storeVerificationToken } from '@/lib/auth/verification';
import { sendVerificationEmail } from '@/lib/email/send-verification';
import { isRateLimited, recordAttempt } from '@/lib/auth/rate-limiter';
import { logVerificationActivity } from '@/lib/auth/verification-logger';
import { ActivityType } from '@/lib/db/schema';

/**
 * Resends a verification email to the user
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    // Rate limit by email (5 attempts per hour)
    if (isRateLimited(email, 5)) {
      return {
        success: false,
        message: 'Too many verification attempts. Please try again later.',
      };
    }
    
    // Record this attempt
    recordAttempt(email);
    
    // Check if the email exists and user is not verified
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      // For security reasons, don't reveal if the email doesn't exist
      return {
        success: true,
        message: 'If your email exists in our system, a verification link has been sent.',
      };
    }

    // Check if the user is already verified
    if (user.emailVerified) {
      return {
        success: false,
        message: 'This email is already verified. Please sign in.',
      };
    }

    // Generate a new verification token
    const verificationToken = generateVerificationToken();
    
    // Store the token in the database
    await storeVerificationToken(user.id, email, verificationToken);
    
    // Send verification email using existing function
    await sendVerificationEmail({
      email,
      token: verificationToken,
      name: user.name || '',
    });
    
    // Log the resend verification action
    await logVerificationActivity(user.id, ActivityType.VERIFICATION_RESENT);
    
    return {
      success: true,
      message: 'A new verification link has been sent to your email.',
    };
  } catch (error) {
    console.error('Error resending verification email:', error);
    return {
      success: false,
      message: 'Failed to send verification email. Please try again later.',
    };
  }
} 