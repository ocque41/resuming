import { NextRequest, NextResponse } from 'next/server';
import { createVerificationToken } from '@/lib/auth/verification';
import { sendVerificationEmail } from '@/lib/email/resend';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateUserVerificationStatus } from '@/lib/notion/notion';
import { verificationEmailLimiter } from '@/lib/rate-limiting/upstash';

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get the email
    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Apply rate limiting based on email
    const rateLimitResult = await verificationEmailLimiter(email + ':resend');
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if the user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length === 0) {
      // Don't reveal if the user exists or not for security
      return NextResponse.json(
        { success: true, message: 'If an account exists, a verification email has been sent' },
        { status: 200 }
      );
    }

    // Check if the email is already verified
    if (existingUser[0].emailVerified) {
      return NextResponse.json(
        { success: true, message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Create a new verification token and send email
    const verificationToken = await createVerificationToken(email);
    
    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    // Send the verification email
    await sendVerificationEmail(email, verificationToken);

    // Update status in Notion if environment variable is set
    try {
      await updateUserVerificationStatus(email, 'Pending');
    } catch (notionError) {
      console.error('Error updating Notion verification status:', notionError);
      // Continue even if Notion update fails
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Verification email sent successfully',
        remaining: rateLimitResult.remaining,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { error: 'An error occurred while resending the verification email' },
      { status: 500 }
    );
  }
} 