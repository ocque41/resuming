import { createHmac, randomBytes } from 'crypto';
import { db } from '@/lib/db/drizzle';
import { 
  emailVerificationTokens, 
  users, 
  type NewEmailVerificationToken 
} from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { withDbErrorHandling } from '@/lib/db/error-handler';

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
  try {
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
    console.error('Error finding valid token:', error);
    return null;
  }
}

/**
 * Mark a user's email as verified
 * Includes retry mechanism for better reliability
 */
export async function markEmailAsVerified(userId: number, retryCount = 3): Promise<boolean> {
  let lastError: any = null;
  
  // Try the operation up to retryCount times
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      await withDbErrorHandling(
        async () => {
          await db
            .update(users)
            .set({ emailVerified: true })
            .where(eq(users.id, userId));
        },
        'markEmailAsVerified',
        'users'
      );
      
      console.log(`Successfully marked email as verified for user ID: ${userId} (attempt ${attempt})`);
      return true;
    } catch (error) {
      lastError = error;
      console.warn(`Error marking email as verified for user ID: ${userId} (attempt ${attempt}/${retryCount})`, error);
      
      // Only retry if we haven't exceeded retryCount
      if (attempt < retryCount) {
        // Add exponential backoff: wait longer between each retry
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // All retry attempts failed
  console.error(`Failed to mark email as verified for user ID: ${userId} after ${retryCount} attempts`, lastError);
  return false;
}

/**
 * Delete a token from the database
 */
export async function deleteToken(tokenId: number): Promise<boolean> {
  try {
    await withDbErrorHandling(
      async () => {
        await db
          .delete(emailVerificationTokens)
          .where(eq(emailVerificationTokens.id, tokenId));
      },
      'deleteToken',
      'emailVerificationTokens'
    );
    
    console.log(`Successfully deleted token ID: ${tokenId}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete token ID: ${tokenId}`, error);
    return false;
  }
} 