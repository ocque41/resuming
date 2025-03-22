'use server';

import { 
  findValidToken, 
  markEmailAsVerified, 
  deleteToken, 
  verifyToken 
} from '@/lib/auth/tokens';
import { updateUserVerificationStatus } from '@/lib/notion/client';
import { sendWelcomeEmail } from '@/lib/email/client';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { emailVerificationTokens, users } from '@/lib/db/schema';

/**
 * Verify an email using a token
 */
export async function verifyEmailAction(token: string) {
  const actionId = `email-verification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${actionId}] Starting email verification for token: ${token.substring(0, 8)}...`);
  
  try {
    // First, verify the token format
    const { userId, valid, expired } = verifyToken(token);
    
    console.log(`[${actionId}] Token verification result - valid: ${valid}, expired: ${expired}, userId: ${userId}`);
    
    if (!valid) {
      const reason = expired ? 'Token expired' : 'Invalid token format';
      console.log(`[${actionId}] Verification failed: ${reason}`);
      return { 
        success: false, 
        expired: expired,
        message: expired ? 'Token expired' : 'Invalid token'
      };
    }
    
    // Then, check if the token exists in the database
    const dbToken = await findValidToken(token);
    
    if (!dbToken) {
      console.log(`[${actionId}] Token not found in database`);
      return { 
        success: false, 
        expired: false,
        message: 'Token not found' 
      };
    }
    
    console.log(`[${actionId}] Valid token found in database: ${dbToken.id}`);
    
    // Find the user in the database to get their email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      console.log(`[${actionId}] User not found for userId: ${userId}`);
      return { 
        success: false, 
        expired: false,
        message: 'User not found' 
      };
    }
    
    console.log(`[${actionId}] User found: ${user.email}`);
    
    // Check if the email is already verified
    if (user.emailVerified) {
      console.log(`[${actionId}] Email already verified for user: ${user.email}`);
      // Clean up the token since it's no longer needed
      await deleteToken(dbToken.id);
      return {
        success: true,
        expired: false,
        message: 'Your email was already verified. You can now login.'
      };
    }
    
    // Mark the user's email as verified
    console.log(`[${actionId}] Marking email as verified for user: ${user.email}`);
    const emailVerificationResult = await markEmailAsVerified(userId);
    
    if (!emailVerificationResult) {
      console.warn(`[${actionId}] Email verification database update failed for user ID: ${userId}`);
      // Continue with the process despite the database update failure
      // This allows the user to retry if needed
    }
    
    // Delete the used token
    console.log(`[${actionId}] Deleting used token: ${dbToken.id}`);
    const tokenDeletionResult = await deleteToken(dbToken.id);
    
    if (!tokenDeletionResult) {
      console.warn(`[${actionId}] Failed to delete token: ${dbToken.id}`);
      // Non-critical failure, can continue
    }
    
    // Try to update the user in Notion
    let notionUpdateSuccess = false;
    try {
      console.log(`[${actionId}] Updating verification status in Notion for: ${user.email}`);
      const notionUpdateResult = await updateUserVerificationStatus(user.email, true);
      notionUpdateSuccess = notionUpdateResult;
      console.log(`[${actionId}] Notion update result for ${user.email}: ${notionUpdateResult}`);
    } catch (notionError) {
      // Log the error but don't fail the verification
      console.error(`[${actionId}] Error updating Notion user verification status:`, notionError);
    }
    
    // Send welcome email
    let welcomeEmailSent = false;
    try {
      console.log(`[${actionId}] Sending welcome email to: ${user.email}`);
      await sendWelcomeEmail({
        email: user.email,
        name: user.name || undefined,
      });
      welcomeEmailSent = true;
      console.log(`[${actionId}] Welcome email sent to: ${user.email}`);
    } catch (emailError) {
      console.error(`[${actionId}] Error sending welcome email:`, emailError);
      // Don't fail verification if welcome email fails
    }
    
    // Log the overall verification status
    console.log(`[${actionId}] Email verification completed successfully for: ${user.email}`);
    console.log(`[${actionId}] Status summary - DB updated: ${emailVerificationResult}, token deleted: ${tokenDeletionResult}, Notion updated: ${notionUpdateSuccess}, welcome email sent: ${welcomeEmailSent}`);
    
    return { 
      success: true, 
      expired: false,
      message: 'Email successfully verified' 
    };
  } catch (error) {
    console.error(`[${actionId}] Unexpected error verifying email:`, error);
    return { 
      success: false, 
      expired: false,
      message: 'An unexpected error occurred. Please try again later.' 
    };
  }
} 