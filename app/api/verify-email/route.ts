import { NextRequest, NextResponse } from 'next/server';
import { validateVerificationToken, markEmailAsVerified } from '@/lib/auth/verification';
import { updateUserVerificationStatus } from '@/lib/notion/notion';

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