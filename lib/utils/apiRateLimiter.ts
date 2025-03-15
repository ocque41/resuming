import { logger } from '@/lib/logger';
import { queueTask } from './taskQueue';

// Track API calls per minute for different services
interface RateLimitTracker {
  mistral: {
    calls: number;
    resetTime: number;
    limit: number;
  };
  openai: {
    calls: number;
    resetTime: number;
    limit: number;
  };
}

// Default rate limits (adjust based on your API tier)
const DEFAULT_RATE_LIMITS = {
  mistral: 10, // 10 requests per minute
  openai: 20,  // 20 requests per minute
};

// Singleton rate limit tracker
const rateLimitTracker: RateLimitTracker = {
  mistral: {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset after 1 minute
    limit: DEFAULT_RATE_LIMITS.mistral,
  },
  openai: {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset after 1 minute
    limit: DEFAULT_RATE_LIMITS.openai,
  },
};

/**
 * Check if we're approaching rate limits and should throttle
 */
export function shouldThrottle(service: 'mistral' | 'openai'): boolean {
  const tracker = rateLimitTracker[service];
  
  // Reset counter if we've passed the reset time
  if (Date.now() > tracker.resetTime) {
    tracker.calls = 0;
    tracker.resetTime = Date.now() + 60000; // Reset after 1 minute
  }
  
  // Check if we're at 80% of the rate limit
  return tracker.calls >= tracker.limit * 0.8;
}

/**
 * Track an API call
 */
export function trackApiCall(service: 'mistral' | 'openai'): void {
  const tracker = rateLimitTracker[service];
  
  // Reset counter if we've passed the reset time
  if (Date.now() > tracker.resetTime) {
    tracker.calls = 0;
    tracker.resetTime = Date.now() + 60000; // Reset after 1 minute
  }
  
  // Increment the call counter
  tracker.calls++;
  
  // Log if we're approaching the limit
  if (tracker.calls >= tracker.limit * 0.8) {
    logger.warn(`${service} API approaching rate limit: ${tracker.calls}/${tracker.limit} calls`);
  }
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
  }
): Promise<T> {
  const {
    service,
    initialDelayMs = 1000,
    maxDelayMs = 60000,
    maxRetries = 5,
    retryStatusCodes = [429, 500, 502, 503, 504],
    priority = 0,
    taskId
  } = options;
  
  // Use the task queue to manage API calls
  return queueTask(
    service,
    async () => {
      let retries = 0;
      let delay = initialDelayMs;
      
      while (true) {
        try {
          // Track this API call
          trackApiCall(service);
          
          // If we should throttle, add a delay before proceeding
          if (shouldThrottle(service)) {
            const throttleDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
            logger.info(`Throttling ${service} API call for ${throttleDelay}ms to prevent rate limit`);
            await new Promise(resolve => setTimeout(resolve, throttleDelay));
          }
          
          // Execute the function
          return await fn();
        } catch (error) {
          // Check if this is a rate limit error or other retryable error
          const status = error instanceof Error && 'status' in error 
            ? (error as any).status 
            : error instanceof Response 
              ? error.status 
              : null;
          
          const isRateLimitError = status === 429 || 
            (error instanceof Error && error.message.includes('rate limit'));
          
          const isRetryableError = status !== null && retryStatusCodes.includes(status);
          
          // If we've hit max retries or it's not a retryable error, throw
          if (retries >= maxRetries || (!isRateLimitError && !isRetryableError)) {
            throw error;
          }
          
          // Increment retry counter
          retries++;
          
          // Calculate backoff with jitter
          const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
          delay = Math.min(delay * 2 * jitter, maxDelayMs);
          
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