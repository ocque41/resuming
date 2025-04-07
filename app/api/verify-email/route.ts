export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateVerificationToken, markEmailAsVerified } from '@/lib/auth/verification';
import { updateUserVerificationStatus } from '@/lib/notion/notion';
import { verificationEmailLimiter } from '@/lib/rate-limiting/upstash';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('[VERIFY-EMAIL] Starting email verification process');
    const body = await request.json();
    const { token, email } = body;
    
    if (!token || !email) {
      console.error('[VERIFY-EMAIL] Missing token or email');
      return NextResponse.json(
        { error: 'Token and email are required' },
        { status: 400 }
      );
    }
    
    console.log(`[VERIFY-EMAIL] Processing verification for email: ${email}`);
    
    // Apply moderate rate limiting based on email for verification attempts
    // Less strict than sending emails, but still protects against brute force
    const rateLimitResult = await verificationEmailLimiter(email + ':verify');
    
    if (!rateLimitResult.success) {
      console.warn(`[VERIFY-EMAIL] Rate limit reached for ${email}`);
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many verification attempts. Please try again later.',
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 429 }
      );
    }
    
    // Validate the token
    console.log('[VERIFY-EMAIL] Validating token');
    const isValid = await validateVerificationToken(email, token);
    
    if (!isValid) {
      console.error('[VERIFY-EMAIL] Invalid or expired token');
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }
    
    // Mark email as verified
    console.log('[VERIFY-EMAIL] Token valid, marking email as verified');
    const success = await markEmailAsVerified(email);
    
    if (!success) {
      console.error('[VERIFY-EMAIL] Failed to mark email as verified');
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      );
    }
    
    console.log('[VERIFY-EMAIL] Email marked as verified, updating subscription status');
    
    // Get user ID by email
    const userResult = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (userResult.length > 0) {
      const userId = userResult[0].id;
      console.log(`[VERIFY-EMAIL] Found user ID: ${userId}`);
      
      // Get the user's team
      const teamResult = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1);
      
      if (teamResult.length > 0) {
        const teamId = teamResult[0].teamId;
        console.log(`[VERIFY-EMAIL] Found team ID: ${teamId}, updating subscription status`);
        
        // Update team subscription status
        await db
          .update(teams)
          .set({
            subscriptionStatus: 'active',
            planName: 'Pro',
            updatedAt: new Date()
          })
          .where(eq(teams.id, teamId));
        
        console.log(`[VERIFY-EMAIL] Successfully updated team subscription status to 'active'`);
      } else {
        console.warn(`[VERIFY-EMAIL] No team found for user ID: ${userId}`);
      }
    } else {
      console.warn(`[VERIFY-EMAIL] User not found for email: ${email}`);
    }
    
    // Update status in Notion if environment variable is set
    if (process.env.NOTION_SECRET && process.env.NOTION_DB) {
      try {
        console.log('[VERIFY-EMAIL] Updating user verification status in Notion');
        await updateUserVerificationStatus(email, 'Verified');
        console.log('[VERIFY-EMAIL] Successfully updated Notion status');
      } catch (notionError) {
        console.error('[VERIFY-EMAIL] Error updating Notion status:', notionError);
        // Continue even if Notion update fails
      }
    }
    
    console.log('[VERIFY-EMAIL] Email verification process completed successfully');
    return NextResponse.json(
      { message: 'Email verified successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[VERIFY-EMAIL] Error verifying email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 