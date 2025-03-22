import { createHmac, randomBytes } from 'crypto';
import { db } from '@/lib/db/drizzle';
import { 
  emailVerificationTokens, 
  users, 
  type NewEmailVerificationToken 
} from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { withDbErrorHandling } from '@/lib/db/error-handler';
import { sql } from 'drizzle-orm';

// Secret key for token generation
const secret = process.env.AUTH_SECRET || 'your-secret-key';

/**
 * Generate a random token with expiration
 */
export function generateToken(userId: number, expiresInHours = 24): string {
  // Generate a random string
  const randomString = randomBytes(32).toString('hex');
  
  // Create a timestamp for expiration
  const timestamp = Date.now() + expiresInHours * 60 * 60 * 1000;
  
  // Combine userId, random string, and timestamp
  const data = `${userId}:${randomString}:${timestamp}`;
  
  // Create an HMAC signature
  const hmac = createHmac('sha256', secret);
  const signature = hmac.update(data).digest('hex');
  
  // Combine data and signature, and encode as Base64
  return Buffer.from(`${data}:${signature}`).toString('base64');
}

/**
 * Verify a token
 */
export function verifyToken(token: string): { 
  userId: number; 
  valid: boolean; 
  expired: boolean; 
} {
  try {
    // Decode the token
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, randomString, timestamp, signature] = decoded.split(':');
    
    // Check if the token has expired
    const expirationTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    if (now > expirationTime) {
      return { userId: parseInt(userId, 10), valid: false, expired: true };
    }
    
    // Verify the signature
    const data = `${userId}:${randomString}:${timestamp}`;
    const hmac = createHmac('sha256', secret);
    const expectedSignature = hmac.update(data).digest('hex');
    
    const valid = signature === expectedSignature;
    
    return { userId: parseInt(userId, 10), valid, expired: false };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { userId: 0, valid: false, expired: false };
  }
}

/**
 * Save a verification token to the database
 */
export async function saveEmailVerificationToken(userId: number, token: string, expiresAt: Date) {
  const newToken: NewEmailVerificationToken = {
    userId,
    token,
    expiresAt,
  };
  
  await db.insert(emailVerificationTokens).values(newToken);
}

/**
 * Find a valid token in the database
 */
export async function findValidToken(token: string) {
  const operationId = `find-token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  try {
    // First check if the email_verification_tokens table exists
    try {
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
        // If we just created the table, it obviously won't contain the token
        return null;
      }
    } catch (tableCheckError) {
      console.error(`[${operationId}] Error checking if table exists:`, tableCheckError);
      // Continue trying to find the token even if table check fails
    }
    
    return await withDbErrorHandling(
      async () => {
        const now = new Date();
        
        const [foundToken] = await db
          .select()
          .from(emailVerificationTokens)
          .where(
            and(
              eq(emailVerificationTokens.token, token),
              gt(emailVerificationTokens.expiresAt, now)
            )
          )
          .limit(1);
          
        return foundToken;
      },
      'findValidToken',
      'emailVerificationTokens'
    );
  } catch (error) {
    console.error(`[${operationId}] Error finding valid token:`, error);
    return null;
  }
}

/**
 * Mark a user's email as verified
 * Includes retry mechanism for better reliability
 */
export async function markEmailAsVerified(userId: number, retryCount = 3): Promise<boolean> {
  const operationId = `verify-email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${operationId}] Marking email as verified for user ID: ${userId}`);
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      // First check if the email_verified column exists
      try {
        const columnResult = await db.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'email_verified';
        `);
        
        if (columnResult.length === 0) {
          console.error(`[${operationId}] email_verified column doesn't exist in users table, adding it...`);
          // Add the column if it doesn't exist
          await db.execute(sql`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
          `);
          console.log(`[${operationId}] email_verified column added to users table`);
        }
      } catch (columnCheckError) {
        console.error(`[${operationId}] Error checking if column exists:`, columnCheckError);
        // Continue trying to update the user even if column check fails
      }
      
      // Update the user's email_verified status
      const result = await withDbErrorHandling(
        async () => db
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, userId))
          .returning(),
        'markEmailAsVerified',
        'users'
      );
      
      if (result && result.length > 0) {
        console.log(`[${operationId}] Successfully marked email as verified for user ${userId}`);
        return true;
      }
      
      console.warn(`[${operationId}] Update operation completed but no rows were affected. User ID: ${userId}`);
      return false;
    } catch (error) {
      lastError = error;
      console.error(`[${operationId}] Error marking email as verified (attempt ${attempt}/${retryCount}):`, error);
      
      if (attempt < retryCount) {
        // Wait with exponential backoff before retrying (1s, 2s, 4s, etc.)
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[${operationId}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[${operationId}] Failed to mark email as verified after ${retryCount} attempts. Last error:`, lastError);
  return false;
}

/**
 * Delete a token after it has been used
 */
export async function deleteToken(tokenId: number): Promise<boolean> {
  const operationId = `delete-token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${operationId}] Deleting token ID: ${tokenId}`);
  
  try {
    // Check if the table exists before trying to delete
    try {
      const tablesResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'email_verification_tokens'
        );
      `);
      
      const tableExists = tablesResult[0]?.exists;
      if (!tableExists) {
        console.error(`[${operationId}] Cannot delete token: email_verification_tokens table doesn't exist`);
        return false;
      }
    } catch (tableCheckError) {
      console.error(`[${operationId}] Error checking if table exists:`, tableCheckError);
      // Continue trying to delete the token even if table check fails
    }
    
    const result = await withDbErrorHandling(
      async () => db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.id, tokenId))
        .returning(),
      'deleteToken',
      'emailVerificationTokens'
    );
    
    if (result && result.length > 0) {
      console.log(`[${operationId}] Token ID ${tokenId} deleted successfully`);
      return true;
    } else {
      console.warn(`[${operationId}] No token found with ID ${tokenId} to delete`);
      return false;
    }
  } catch (error) {
    console.error(`[${operationId}] Error deleting token ID ${tokenId}:`, error);
    return false;
  }
} 