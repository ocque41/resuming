import { logger } from '@/lib/logger';
import { queueTask } from './taskQueue';

// Track API calls per minute for different services
interface RateLimitTracker {
  mistral: {
    calls: number;
    resetTime: number;
    limit: number;
    lastCallTime: number;
    windowStart: number;
    callsInWindow: number[];
  };
  openai: {
    calls: number;
    resetTime: number;
    limit: number;
    lastCallTime: number;
    windowStart: number;
    callsInWindow: number[];
  };
}

// Default rate limits (adjust based on your API tier)
const DEFAULT_RATE_LIMITS = {
  mistral: 8, // Reduced from 10 to 8 to be more conservative
  openai: 20,  // 20 requests per minute
};

// Minimum time between API calls in milliseconds
const MIN_CALL_INTERVAL = {
  mistral: 2000, // At least 2 seconds between Mistral API calls
  openai: 500,   // At least 0.5 seconds between OpenAI API calls
};

// Sliding window size in milliseconds (60 seconds)
const WINDOW_SIZE = 60000;

// Singleton rate limit tracker
const rateLimitTracker: RateLimitTracker = {
  mistral: {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset after 1 minute
    limit: DEFAULT_RATE_LIMITS.mistral,
    lastCallTime: 0,
    windowStart: Date.now(),
    callsInWindow: [],
  },
  openai: {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset after 1 minute
    limit: DEFAULT_RATE_LIMITS.openai,
    lastCallTime: 0,
    windowStart: Date.now(),
    callsInWindow: [],
  },
};

/**
 * Check if we're approaching rate limits and should throttle
 */
export function shouldThrottle(service: 'mistral' | 'openai'): boolean {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Reset counter if we've passed the reset time
  if (now > tracker.resetTime) {
    tracker.calls = 0;
    tracker.resetTime = now + 60000; // Reset after 1 minute
  }
  
  // Update sliding window
  updateSlidingWindow(service);
  
  // Check if we're at 70% of the rate limit (more conservative)
  const isApproachingLimit = tracker.calls >= tracker.limit * 0.7;
  
  // Check if we need to enforce minimum time between calls
  const timeSinceLastCall = now - tracker.lastCallTime;
  const needsTimeBuffer = timeSinceLastCall < MIN_CALL_INTERVAL[service];
  
  // Check if we've made too many calls in the sliding window
  const tooManyCalls = tracker.callsInWindow.length >= tracker.limit * 0.8;
  
  return isApproachingLimit || needsTimeBuffer || tooManyCalls;
}

/**
 * Update the sliding window of API calls
 */
function updateSlidingWindow(service: 'mistral' | 'openai'): void {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Remove calls that are outside the window
  tracker.callsInWindow = tracker.callsInWindow.filter(
    timestamp => now - timestamp < WINDOW_SIZE
  );
  
  // If the window is empty, reset the window start
  if (tracker.callsInWindow.length === 0) {
    tracker.windowStart = now;
  }
}

/**
 * Track an API call
 */
export function trackApiCall(service: 'mistral' | 'openai'): void {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Reset counter if we've passed the reset time
  if (now > tracker.resetTime) {
    tracker.calls = 0;
    tracker.resetTime = now + 60000; // Reset after 1 minute
  }
  
  // Increment the call counter
  tracker.calls++;
  
  // Update last call time
  tracker.lastCallTime = now;
  
  // Add to sliding window
  tracker.callsInWindow.push(now);
  
  // Log if we're approaching the limit
  if (tracker.calls >= tracker.limit * 0.7) {
    logger.warn(`${service} API approaching rate limit: ${tracker.calls}/${tracker.limit} calls`);
  }
  
  // Log sliding window stats
  logger.debug(`${service} API calls in sliding window: ${tracker.callsInWindow.length}/${tracker.limit}`);
}

/**
 * Calculate appropriate throttle delay based on current usage
 */
function calculateThrottleDelay(service: 'mistral' | 'openai'): number {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Base delay is the minimum interval
  let delay = MIN_CALL_INTERVAL[service];
  
  // Add time if we're approaching the rate limit
  const usageRatio = tracker.calls / tracker.limit;
  if (usageRatio > 0.7) {
    // Exponentially increase delay as we approach the limit
    delay += Math.pow(usageRatio - 0.7, 2) * 10000; // Up to 10 seconds additional delay
  }
  
  // Add time based on sliding window
  const windowUsageRatio = tracker.callsInWindow.length / tracker.limit;
  if (windowUsageRatio > 0.7) {
    // Exponentially increase delay as we approach the limit in the sliding window
    delay += Math.pow(windowUsageRatio - 0.7, 2) * 10000; // Up to 10 seconds additional delay
  }
  
  // Add jitter to prevent thundering herd
  delay *= (0.8 + Math.random() * 0.4); // 80% to 120% of calculated delay
  
  // For Mistral, ensure a minimum delay of 2 seconds when we're over 50% capacity
  if (service === 'mistral' && (usageRatio > 0.5 || windowUsageRatio > 0.5)) {
    delay = Math.max(delay, 2000);
  }
  
  return Math.round(delay);
}

/**
 * Set custom rate limits (e.g., based on API tier)
 */
export function setRateLimit(service: 'mistral' | 'openai', limit: number): void {
  rateLimitTracker[service].limit = limit;
  logger.info(`Set ${service} rate limit to ${limit} requests per minute`);
}

/**
 * Retry a function with exponential backoff
 * Specifically designed to handle rate limit errors (429)
 * Now uses the task queue for better control
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    service: 'mistral' | 'openai';
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxRetries?: number;
    retryStatusCodes?: number[];
    priority?: number;
    taskId?: string;
    fallbackFn?: () => Promise<T>; // Optional fallback function
  }
): Promise<T> {
  const {
    service,
    initialDelayMs = 1000,
    maxDelayMs = 60000,
    maxRetries = 5,
    retryStatusCodes = [429, 500, 502, 503, 504],
    priority = 0,
    taskId,
    fallbackFn
  } = options;
  
  // Use the task queue to manage API calls
  return queueTask(
    service,
    async () => {
      let retries = 0;
      let delay = initialDelayMs;
      let lastError: Error | null = null;
      
      while (true) {
        try {
          // Track this API call
          trackApiCall(service);
          
          // If we should throttle, add a delay before proceeding
          if (shouldThrottle(service)) {
            const throttleDelay = calculateThrottleDelay(service);
            logger.info(`Throttling ${service} API call for ${throttleDelay}ms to prevent rate limit`);
            await new Promise(resolve => setTimeout(resolve, throttleDelay));
          }
          
          // Execute the function
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Check if this is a rate limit error or other retryable error
          const status = error instanceof Error && 'status' in error 
            ? (error as any).status 
            : error instanceof Response 
              ? error.status 
              : null;
          
          const isRateLimitError = status === 429 || 
            (error instanceof Error && error.message.includes('rate limit'));
          
          const isRetryableError = status !== null && retryStatusCodes.includes(status);
          
          // If we've hit max retries or it's not a retryable error, try fallback or throw
          if (retries >= maxRetries || (!isRateLimitError && !isRetryableError)) {
            // If we have a fallback function and this is a rate limit error, try the fallback
            if (fallbackFn && (isRateLimitError || retries >= maxRetries)) {
              logger.warn(`${service} API failed after ${retries} retries, using fallback`);
              return await fallbackFn();
            }
            
            throw error;
          }
          
          // Increment retry counter
          retries++;
          
          // Calculate backoff with jitter
          const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
          
          // For rate limit errors, use a more aggressive backoff
          if (isRateLimitError) {
            delay = Math.min(delay * 3 * jitter, maxDelayMs); // Triple the delay for rate limits
          } else {
            delay = Math.min(delay * 2 * jitter, maxDelayMs);
          }
          
          // Log the retry
          logger.warn(
            `${service} API ${isRateLimitError ? 'rate limit' : 'error'}, retrying (${retries}/${maxRetries}) after ${Math.round(delay)}ms delay`
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    },
    { priority, taskId }
  );
} 