import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, emailVerificationTokens } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { generateToken } from '@/lib/auth/tokens';
import { sendConfirmationEmail } from '@/lib/email/client';
import { withApiErrorHandling, ApiErrorCode } from '@/lib/api/error-handler';
import { withDbErrorHandling } from '@/lib/db/error-handler';
import { sql } from 'drizzle-orm';

// Rate limiting - track email addresses and their last request timestamps
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * POST /api/auth/resend-verification
 * Resends a verification email to a user
 */
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  // Parse request body
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Email is required',
        errorCode: ApiErrorCode.VALIDATION_ERROR,
        statusCode: 400
      },
      { status: 400 }
    );
  }

  // Generate an operation ID for tracking
  const operationId = `resend-verify-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${operationId}] Processing resend verification for: ${email}`);

  // Check rate limiting
  const now = Date.now();
  const lastRequest = rateLimitMap.get(email);
  
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - lastRequest)) / 1000);
    console.log(`[${operationId}] Rate limit exceeded for: ${email}. Retry after ${retryAfter} seconds`);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Too many requests. Please try again later.',
        errorCode: ApiErrorCode.RATE_LIMIT_EXCEEDED,
        retryAfter,
        statusCode: 429
      },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
        }
      }
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

  try {
    // Find the user
    const [user] = await withDbErrorHandling(
      async () => db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1),
      'findUserByEmail',
      'users'
    );

    if (!user) {
      // Don't reveal that the user doesn't exist for security
      console.log(`[${operationId}] User not found for email: ${email}`);
      return NextResponse.json(
        { success: true, message: 'If your email exists, a verification link has been sent.' },
        { status: 200 }
      );
    }

    // If the user is already verified, don't send another email
    if (user.emailVerified) {
      console.log(`[${operationId}] Email already verified for: ${email}`);
      return NextResponse.json(
        { success: true, message: 'Your email is already verified.' },
        { status: 200 }
      );
    }

    console.log(`[${operationId}] Deleting existing tokens for user ID: ${user.id}`);
    
    // Delete any existing tokens for this user
    await withDbErrorHandling(
      async () => db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, user.id)),
      'deleteExistingTokens',
      'emailVerificationTokens'
    );

    // Generate a new token
    const verificationToken = generateToken(user.id, 24); // 24 hour expiration
    
    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    console.log(`[${operationId}] Saving new verification token for user ID: ${user.id}`);
    
    // First check if the email_verification_tokens table exists
    const tablesResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'email_verification_tokens'
      );
    `);
    
    const tableExists = tablesResult[0]?.exists;
    if (!tableExists) {
      console.error(`[${operationId}] email_verification_tokens table doesn't exist, creating it...`);
      // Create the table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log(`[${operationId}] email_verification_tokens table created`);
    }
    
    // Save the token to the database with retry
    let tokenSaved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[${operationId}] Attempt ${attempt} to save verification token`);
        
        await withDbErrorHandling(
          async () => db.insert(emailVerificationTokens).values({
            userId: user.id,
            token: verificationToken,
            expiresAt,
          }),
          'saveVerificationToken',
          'emailVerificationTokens'
        );
        
        tokenSaved = true;
        console.log(`[${operationId}] Verification token saved successfully`);
        break; // Exit retry loop on success
      } catch (err) {
        console.error(`[${operationId}] Error saving verification token (attempt ${attempt}/3):`, err);
        if (attempt < 3) {
          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[${operationId}] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!tokenSaved) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unable to save verification token. Please try again later.',
          statusCode: 500 
        },
        { status: 500 }
      );
    }
    
    console.log(`[${operationId}] Sending verification email to: ${email}`);
    
    // Send verification email
    await sendConfirmationEmail({
      email: user.email,
      name: user.name || undefined,
      token: verificationToken,
    });

    console.log(`[${operationId}] Verification email sent successfully to: ${email}`);
    
    return NextResponse.json(
      { success: true, message: 'Verification email sent successfully.' },
      { status: 200 }
    );
  } catch (error) {
    // withApiErrorHandling will handle this error
    console.error(`[${operationId}] Error resending verification email:`, error);
    throw error;
  }
}); 