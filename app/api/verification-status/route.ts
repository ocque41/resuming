import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get the email from the query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[VERIFICATION-STATUS] Checking verification status for: ${email}`);

    // Query the database to check if the email exists and is verified
    const result = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // If the user doesn't exist, return false for security reasons
    // (we don't want to reveal whether an email exists in our system)
    if (result.length === 0) {
      console.log(`[VERIFICATION-STATUS] User not found for email: ${email}`);
      return NextResponse.json({ verified: false }, { status: 200 });
    }

    // Check if emailVerified field has a timestamp
    const isVerified = !!result[0].emailVerified;
    console.log(`[VERIFICATION-STATUS] Email ${email} verification status: ${isVerified}`);

    return NextResponse.json({ verified: isVerified }, { status: 200 });
  } catch (error) {
    console.error('[VERIFICATION-STATUS] Error checking verification status:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking verification status' },
      { status: 500 }
    );
  }
} 