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
  try {
    // First, verify the token format
    const { userId, valid, expired } = verifyToken(token);
    
    if (!valid) {
      return { 
        success: false, 
        expired: expired,
        message: expired ? 'Token expired' : 'Invalid token'
      };
    }
    
    // Then, check if the token exists in the database
    const dbToken = await findValidToken(token);
    
    if (!dbToken) {
      return { 
        success: false, 
        expired: false,
        message: 'Token not found' 
      };
    }
    
    // Find the user in the database to get their email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) {
      return { 
        success: false, 
        expired: false,
        message: 'User not found' 
      };
    }
    
    // Mark the user's email as verified
    await markEmailAsVerified(userId);
    
    // Delete the used token
    await deleteToken(dbToken.id);
    
    // Try to update the user in Notion
    try {
      const notionUpdateResult = await updateUserVerificationStatus(user.email, true);
      console.log(`Notion update result for ${user.email}:`, notionUpdateResult);
    } catch (notionError) {
      // Log the error but don't fail the verification
      console.error('Error updating Notion user verification status:', notionError);
    }
    
    // Send welcome email
    try {
      await sendWelcomeEmail({
        email: user.email,
        name: user.name || undefined,
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }
    
    return { 
      success: true, 
      expired: false,
      message: 'Email successfully verified' 
    };
  } catch (error) {
    console.error('Error verifying email:', error);
    return { 
      success: false, 
      expired: false,
      message: 'Error verifying email' 
    };
  }
} 