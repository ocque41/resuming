import { db } from '@/lib/db/drizzle';
import { users, verificationTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

/**
 * Creates a verification token for a user
 * @param email - User's email
 * @param expiresIn - Token expiration time in seconds (default 24 hours)
 * @returns The generated token
 */
export async function createVerificationToken(email: string, expiresIn: number = 86400) {
  try {
    // Generate a secure random token
    const token = randomBytes(32).toString('hex');
    
    // Calculate the expiration date
    const expires = new Date(Date.now() + expiresIn * 1000);
    
    // Remove any existing tokens for this email
    await db.delete(verificationTokens).where(eq(verificationTokens.email, email));
    
    // Insert the new token
    await db.insert(verificationTokens).values({
      email,
      token,
      expires,
    });
    
    return token;
  } catch (error) {
    console.error('Error creating verification token:', error);
    throw error;
  }
}

/**
 * Validates a verification token
 * @param email - User's email
 * @param token - Token to validate
 * @returns Whether the token is valid
 */
export async function validateVerificationToken(email: string, token: string) {
  try {
    // Get the token for this email
    const result = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.email, email),
          eq(verificationTokens.token, token)
        )
      )
      .limit(1);
    
    if (result.length === 0) {
      return false;
    }
    
    const verificationToken = result[0];
    
    // Check if the token has expired
    if (verificationToken.expires < new Date()) {
      return false;
    }
    
    // Token is valid
    return true;
  } catch (error) {
    console.error('Error validating verification token:', error);
    return false;
  }
}

/**
 * Marks a user's email as verified
 * @param email - User's email
 * @returns Whether the operation was successful
 */
export async function markEmailAsVerified(email: string) {
  try {
    // Update the user record
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.email, email));
    
    // Delete the verification token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.email, email));
    
    return true;
  } catch (error) {
    console.error('Error marking email as verified:', error);
    return false;
  }
} 