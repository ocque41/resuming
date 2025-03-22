import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, emailVerifications } from '@/lib/db/schema';
import { redirect } from "next/navigation";

// Generate a random token for email verification
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

// Generate a hash for the verification token
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Store verification token in the database
export async function storeVerificationToken(
  userId: number,
  email: string,
  token: string
): Promise<string> {
  // Hash the token for storage
  const hashedToken = hashVerificationToken(token);
  
  // Set expiration to 24 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  // Delete any existing tokens for this user
  await db.delete(emailVerifications)
    .where(eq(emailVerifications.userId, userId));
  
  // Insert the new token
  await db.insert(emailVerifications).values({
    userId,
    email,
    token: hashedToken,
    expiresAt,
  });
  
  return token;
}

// Verify a token and mark a user as verified
export async function verifyEmailWithToken(
  email: string,
  token: string
): Promise<{
  success: boolean;
  error?: string;
  userId?: number;
}> {
  try {
    // Hash the provided token
    const hashedToken = hashVerificationToken(token);
    
    // Find a matching verification record
    const verificationRecord = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.token, hashedToken)
      ),
    });
    
    // If no record is found
    if (!verificationRecord) {
      return { success: false, error: "Invalid verification token" };
    }
    
    // Check if the token is expired
    if (new Date() > verificationRecord.expiresAt) {
      return { success: false, error: "Verification token has expired" };
    }
    
    // Mark the user as verified
    await db.update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, verificationRecord.userId));
    
    // Delete the verification record
    await db.delete(emailVerifications)
      .where(eq(emailVerifications.id, verificationRecord.id));
    
    return { success: true, userId: verificationRecord.userId };
  } catch (error) {
    console.error("Error verifying email:", error);
    return { success: false, error: "An error occurred during verification" };
  }
}

// Check if a user is verified
export async function isUserVerified(userId: number): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  return !!user?.emailVerified;
}

// Require verification middleware
export async function requireVerification(userId: number): Promise<void> {
  if (!await isUserVerified(userId)) {
    redirect("/verification-required");
  }
} 