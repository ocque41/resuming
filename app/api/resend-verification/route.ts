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
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Apply rate limiting based on email
    const rateLimitResult = await verificationEmailLimiter(email);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many verification requests. Please try again later.',
          reset: rateLimitResult.reset.toISOString(),
          remaining: 0
        },
        { status: 429 }
      );
    }
    
    // Check if user exists
    const userExists = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (userExists.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // If already verified, no need to resend
    if (userExists[0].emailVerified) {
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      );
    }
    
    // Create a new verification token
    const token = await createVerificationToken(email);
    
    // Send the verification email
    const emailResult = await sendVerificationEmail(email, token);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
    
    // Update status in Notion if environment variable is set
    if (process.env.NOTION_SECRET && process.env.NOTION_DB) {
      try {
        await updateUserVerificationStatus(email, 'Pending');
      } catch (notionError) {
        console.error('Error updating Notion status:', notionError);
        // Continue even if Notion update fails
      }
    }
    
    return NextResponse.json(
      { 
        message: 'Verification email sent successfully',
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset.toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 