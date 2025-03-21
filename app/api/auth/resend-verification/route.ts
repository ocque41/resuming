import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, emailVerificationTokens } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { generateToken } from '@/lib/auth/tokens';
import { sendConfirmationEmail } from '@/lib/email/client';

// Rate limiting - track email addresses and their last request timestamps
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * POST /api/auth/resend-verification
 * Resends a verification email to a user
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const now = Date.now();
    const lastRequest = rateLimitMap.get(email);
    
    if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
      return NextResponse.json(
        { 
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - lastRequest)) / 1000)
        },
        { status: 429 }
      );
    }
    
    // Update rate limit tracker
    rateLimitMap.set(email, now);
    
    // Periodically clean up the rate limit map (for servers that don't restart often)
    if (rateLimitMap.size > 1000) {
      const cutoff = now - RATE_LIMIT_WINDOW;
      for (const [key, timestamp] of rateLimitMap.entries()) {
        if (timestamp < cutoff) {
          rateLimitMap.delete(key);
        }
      }
    }

    // Find the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal that the user doesn't exist for security
      return NextResponse.json(
        { message: 'If your email exists, a verification link has been sent.' },
        { status: 200 }
      );
    }

    // If the user is already verified, don't send another email
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Your email is already verified.' },
        { status: 200 }
      );
    }

    // Delete any existing tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    // Generate a new token
    const verificationToken = generateToken(user.id, 24); // 24 hour expiration
    
    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Save the token to the database
    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      token: verificationToken,
      expiresAt,
    });
    
    // Send verification email
    await sendConfirmationEmail({
      email: user.email,
      name: user.name || undefined,
      token: verificationToken,
    });

    return NextResponse.json(
      { message: 'Verification email sent successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json(
      { message: 'Failed to send verification email.' },
      { status: 500 }
    );
  }
} 