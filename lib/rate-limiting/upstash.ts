import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Rate limit a specific action by key
 * @param key - Unique identifier for the rate limited entity (e.g. IP address, user ID, email)
 * @param limit - Maximum number of attempts allowed within the window
 * @param window - Time window in seconds
 * @returns Object containing success status, remaining attempts, and reset time
 */
export async function rateLimit(
  key: string,
  limit: number = 10,
  window: number = 60 * 60 // 1 hour in seconds
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  error?: string;
}> {
  const now = Date.now();
  const resetMs = now + window * 1000;
  const reset = new Date(resetMs);
  const keyName = `rate:${key}`;

  try {
    // Use a pipeline to execute commands in a single round trip
    const pipeline = redis.pipeline();
    
    // Record request timestamp and cleanup old entries
    pipeline.zadd(keyName, { score: now, member: now.toString() });
    pipeline.zremrangebyscore(keyName, 0, now - window * 1000);
    
    // Set expiry on the set to auto-cleanup
    pipeline.expire(keyName, window);
    
    // Count requests within the window
    pipeline.zcard(keyName);
    
    // Execute pipeline
    const [, , , count] = await pipeline.exec();
    
    // Check if rate limit is exceeded
    const remaining = limit - (count as number);
    const success = remaining > 0;
    
    return {
      success,
      limit,
      remaining: Math.max(0, remaining),
      reset,
      ...(success ? {} : { error: 'Rate limit exceeded. Please try again later.' }),
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    
    // On errors, fail open to prevent blocking legitimate requests
    return {
      success: true,
      limit,
      remaining: 1,
      reset,
      error: 'Rate limiting service unavailable',
    };
  }
}

/**
 * Creates a namespaced rate limiting function for a specific action
 * @param namespace - Action identifier (e.g., 'email:verify', 'newsletter:subscribe')
 * @param limit - Maximum attempts per window
 * @param window - Time window in seconds
 */
export function createRateLimiter(
  namespace: string,
  limit: number = 5,
  window: number = 60 * 60
) {
  return (identifier: string) => rateLimit(`${namespace}:${identifier}`, limit, window);
}

// Common rate limiters
export const verificationEmailLimiter = createRateLimiter('email:verification', 5, 3600); // 5 per hour
export const newsletterSubscriptionLimiter = createRateLimiter('newsletter:subscribe', 3, 3600); // 3 per hour
export const signupLimiter = createRateLimiter('auth:signup', 10, 86400); // 10 per day 