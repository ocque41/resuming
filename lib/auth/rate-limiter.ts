/**
 * A simple in-memory rate limiter to prevent abuse of authentication endpoints
 * This is not meant for production use with multiple server instances
 * For production, use a Redis-based rate limiter
 */

// Store attempt timestamps by key (usually IP or email)
const attempts: Record<string, number[]> = {};

// Clean up old attempts periodically
setInterval(() => {
  const now = Date.now();
  // Remove attempts older than the window
  Object.keys(attempts).forEach(key => {
    attempts[key] = attempts[key].filter(timestamp => now - timestamp < 24 * 60 * 60 * 1000);
    if (attempts[key].length === 0) {
      delete attempts[key];
    }
  });
}, 60 * 60 * 1000); // Clean up every hour

/**
 * Check if a key (IP, email) has exceeded the rate limit
 * @param key The key to check (IP, email)
 * @param maxAttempts Maximum attempts allowed in the time window
 * @param windowMs Time window in milliseconds
 * @returns Whether the key has exceeded the rate limit
 */
export function isRateLimited(
  key: string, 
  maxAttempts: number = 5,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  if (!key) return false;
  
  const now = Date.now();
  const keyAttempts = attempts[key] || [];
  
  // Filter attempts to only include those within the window
  const recentAttempts = keyAttempts.filter(
    timestamp => now - timestamp < windowMs
  );
  
  return recentAttempts.length >= maxAttempts;
}

/**
 * Record an attempt for rate limiting
 * @param key The key to record an attempt for (IP, email)
 */
export function recordAttempt(key: string): void {
  if (!key) return;
  
  const now = Date.now();
  
  if (!attempts[key]) {
    attempts[key] = [];
  }
  
  attempts[key].push(now);
} 