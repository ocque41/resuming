import { NextRequest, NextResponse } from 'next/server';
import { validateVerificationToken, markEmailAsVerified } from '@/lib/auth/verification';
import { updateUserVerificationStatus } from '@/lib/notion/notion';
import { verificationEmailLimiter } from '@/lib/rate-limiting/upstash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;
    
    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token and email are required' },
        { status: 400 }
      );
    }
    
    // Apply moderate rate limiting based on email for verification attempts
    // Less strict than sending emails, but still protects against brute force
    const rateLimitResult = await verificationEmailLimiter(email + ':verify');
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many verification attempts. Please try again later.',
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 429 }
      );
    }
    
    // Validate the token
    const isValid = await validateVerificationToken(email, token);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }
    
    // Mark email as verified
    const success = await markEmailAsVerified(email);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      );
    }
    
    // Update status in Notion if environment variable is set
    if (process.env.NOTION_SECRET && process.env.NOTION_DB) {
      try {
        await updateUserVerificationStatus(email, 'Verified');
      } catch (notionError) {
        console.error('Error updating Notion status:', notionError);
        // Continue even if Notion update fails
      }
    }
    
    return NextResponse.json(
      { message: 'Email verified successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 