import { logger } from '@/lib/logger';
import { queueTask } from './taskQueue';

// Track API calls per minute for different services
interface RateLimitTracker {
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
  openai: 20,  // 20 requests per minute
};

// Minimum time between API calls in milliseconds
const MIN_CALL_INTERVAL = {
  openai: 500,   // At least 0.5 seconds between OpenAI API calls
};

// Sliding window size in milliseconds (60 seconds)
const WINDOW_SIZE = 60000;

// Initialize rate limit tracker
const rateLimitTracker: RateLimitTracker = {
  openai: {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset every minute
    limit: DEFAULT_RATE_LIMITS.openai,
    lastCallTime: 0,
    windowStart: Date.now(),
    callsInWindow: [],
  },
};

// Add circuit breaker implementation

// Add circuit breaker state tracking
const circuitBreakers = {
  openai: {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    resetTimeout: 30000, // 30 seconds timeout before trying again
    failureThreshold: 5,  // Increased threshold to be more lenient - Number of failures before opening circuit
    consecutiveFailures: 0, // Track consecutive failures
    totalFailures: 0, // Track total failures
    totalSuccesses: 0, // Track total successes
    lastSuccess: 0 // Track last successful call
  }
};

// Add function to check if circuit is open
function isCircuitOpen(service: 'openai'): boolean {
  const breaker = circuitBreakers[service];
  
  // If circuit is open (too many failures), check if reset timeout has passed
  if (breaker.isOpen) {
    if (Date.now() - breaker.lastFailure > breaker.resetTimeout) {
      // Reset the circuit breaker - but keep the failure counter in half-open state
      breaker.isOpen = false;
      breaker.consecutiveFailures = Math.floor(breaker.consecutiveFailures / 2); // Reduce but not eliminate failures
      logger.info(`Circuit breaker for ${service} reset after ${breaker.resetTimeout}ms timeout (half-open state with ${breaker.consecutiveFailures} failures remaining)`);
      return false; // Circuit is now closed (in half-open state)
    }
    logger.warn(`Circuit breaker for ${service} is still open after ${Date.now() - breaker.lastFailure}ms (reset after ${breaker.resetTimeout}ms)`);
    return true; // Circuit is still open
  }
  
  return false; // Circuit is closed
}

// Add function to record API success for circuit breaker
function recordApiSuccess(service: 'openai'): void {
  const breaker = circuitBreakers[service];
  breaker.lastSuccess = Date.now();
  breaker.totalSuccesses++;
  
  // Only reset consecutive failures if we've had a real success
  breaker.consecutiveFailures = 0;
  
  // If we were in a half-open state, log that we're fully closed now
  if (breaker.failures > 0) {
    logger.info(`Circuit breaker for ${service} fully closed after successful API call`);
    breaker.failures = 0;
  }
}

// Add function to record failures for circuit breaker
function recordApiFailure(service: 'openai'): void {
  const breaker = circuitBreakers[service];
  breaker.failures++;
  breaker.totalFailures++;
  breaker.consecutiveFailures++;
  breaker.lastFailure = Date.now();
  
  logger.warn(`API call to ${service} failed. Consecutive failures: ${breaker.consecutiveFailures}, Total failures: ${breaker.totalFailures}`);
  
  // If too many consecutive failures, open the circuit
  if (breaker.consecutiveFailures >= breaker.failureThreshold) {
    if (!breaker.isOpen) {
      breaker.isOpen = true;
      logger.warn(`Circuit breaker for ${service} opened after ${breaker.consecutiveFailures} consecutive failures. Will retry after ${breaker.resetTimeout}ms`);
    } else {
      // If already open, extend the timeout
      logger.warn(`Circuit breaker for ${service} remains open after another failure. Total consecutive failures: ${breaker.consecutiveFailures}`);
    }
  }
}

// Add function to get circuit breaker status
export function getCircuitStatus(service: 'openai'): { 
  isOpen: boolean; 
  failures: number; 
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailure: number;
  lastSuccess: number;
  timeSinceLastFailure: number;
  timeSinceLastSuccess: number;
} {
  const breaker = circuitBreakers[service];
  return {
    isOpen: breaker.isOpen,
    failures: breaker.failures,
    consecutiveFailures: breaker.consecutiveFailures,
    totalFailures: breaker.totalFailures,
    totalSuccesses: breaker.totalSuccesses,
    lastFailure: breaker.lastFailure,
    lastSuccess: breaker.lastSuccess,
    timeSinceLastFailure: breaker.lastFailure ? Date.now() - breaker.lastFailure : -1,
    timeSinceLastSuccess: breaker.lastSuccess ? Date.now() - breaker.lastSuccess : -1
  };
}

/**
 * Check if we're approaching rate limits and should throttle
 */
export function shouldThrottle(service: 'openai'): boolean {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Reset counter if we've passed the reset time
  if (now > tracker.resetTime) {
    tracker.calls = 0;
    tracker.resetTime = now + 60000; // Reset after 1 minute
  }
  
  // Update sliding window
  updateSlidingWindow(service);
  
  // More aggressive throttling for OpenAI
  const limitThreshold = 0.7; // Lower threshold for OpenAI (70%)
  const isApproachingLimit = tracker.calls >= tracker.limit * limitThreshold;
  
  // Check if we need to enforce minimum time between calls
  const minTimeBetweenCalls = MIN_CALL_INTERVAL[service];
  const timeSinceLastCall = now - tracker.lastCallTime;
  const needsTimeBuffer = timeSinceLastCall < minTimeBetweenCalls;
  
  // Check if we've made too many calls in the sliding window
  const windowThreshold = 0.8; // 80%
  const tooManyCalls = tracker.callsInWindow.length >= tracker.limit * windowThreshold;
  
  // Log throttling decisions for debugging
  if (isApproachingLimit || needsTimeBuffer || tooManyCalls) {
    logger.debug(`Throttling ${service} API: approaching limit=${isApproachingLimit}, needs buffer=${needsTimeBuffer}, too many calls=${tooManyCalls}`);
  }
  
  return isApproachingLimit || needsTimeBuffer || tooManyCalls;
}

/**
 * Update the sliding window of API calls
 */
function updateSlidingWindow(service: 'openai'): void {
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
export function trackApiCall(service: 'openai'): void {
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
function calculateThrottleDelay(service: 'openai'): number {
  const tracker = rateLimitTracker[service];
  const now = Date.now();
  
  // Base delay is the minimum interval
  let delay = MIN_CALL_INTERVAL[service];
  
  // Add time if we're approaching the rate limit
  const usageRatio = tracker.calls / tracker.limit;
  if (usageRatio > 0.5) {
    // Exponentially increase delay as we approach the limit
    delay += Math.pow(usageRatio - 0.5, 2) * 15000; // Up to 15 seconds additional delay
  }
  
  // Add time based on sliding window
  const windowUsageRatio = tracker.callsInWindow.length / tracker.limit;
  if (windowUsageRatio > 0.5) {
    // Exponentially increase delay as we approach the limit in the sliding window
    delay += Math.pow(windowUsageRatio - 0.5, 2) * 15000; // Up to 15 seconds additional delay
  }
  
  // Add jitter to prevent thundering herd
  delay *= (0.8 + Math.random() * 0.4); // 80% to 120% of calculated delay
  
  // For OpenAI, ensure a minimum delay of 3 seconds when we're over 40% capacity
  if (usageRatio > 0.4 || windowUsageRatio > 0.4) {
    delay = Math.max(delay, 3000);
  }
  
  return Math.round(delay);
}

/**
 * Set custom rate limits (e.g., based on API tier)
 */
export function setRateLimit(service: 'openai', limit: number): void {
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
    service: 'openai';
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
    maxDelayMs = 8000, // Reduced from 10000
    maxRetries = 2,    // Reduced from 3
    retryStatusCodes = [429, 500, 502, 503, 504],
    priority = 0,
    taskId
  } = options;

  // Check if circuit breaker is open
  if (isCircuitOpen(service)) {
    logger.warn(`Circuit breaker for ${service} is open, using fallback if available`);
    // Use fallback function if available
    if (options.fallbackFn) {
      try {
        return await options.fallbackFn();
      } catch (fallbackError) {
        logger.error(`Fallback function failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        throw new Error(`Service ${service} is unavailable due to multiple failures and fallback failed`);
      }
    }
    throw new Error(`Service ${service} is currently unavailable due to multiple failures`);
  }

  // Existing task queue logic
  return await queueTask(service, async () => {
    let retries = 0;
    let delay = initialDelayMs;

    while (true) {
      try {
        // Check for throttling
        if (shouldThrottle(service)) {
          const throttleDelay = calculateThrottleDelay(service);
          logger.info(`Throttling ${service} API call for ${throttleDelay}ms to prevent rate limit`);
          await new Promise(resolve => setTimeout(resolve, throttleDelay));
        }

        // Track the API call
        trackApiCall(service);

        // Execute the function
        const result = await fn();
        
        // Record success for circuit breaker
        recordApiSuccess(service);
        
        return result;
      } catch (error: any) {
        // Format the error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if this is a timeout error
        const isTimeoutError = error.type === 'TIMEOUT_ERROR' || 
                               error.isTimeout === true || 
                               errorMessage.includes('timeout') || 
                               errorMessage.includes('timed out');
        
        // If it's a timeout, handle it specially - don't retry timeouts
        if (isTimeoutError) {
          logger.warn(`API call to ${service} timed out. Not retrying to prevent cascading timeouts.`);
          recordApiFailure(service);
          throw error; // Don't retry timeouts
        }
                               
        // Record failure for circuit breaker
        recordApiFailure(service);
        
        // Log the error
        logger.error(`API call to ${service} failed: ${errorMessage}`);

        // Check if we've reached the max retries
        if (retries >= maxRetries) {
          logger.error(`Max retries (${maxRetries}) reached for ${service} API call`);
          throw error;
        }

        // Determine if the error is retryable
        let statusCode: number | undefined;
        
        // Extract status code from various error types
        if (error instanceof Error) {
          if ('status' in error) {
            statusCode = (error as any).status;
          } else if ('statusCode' in error) {
            statusCode = (error as any).statusCode;
          } else if ('code' in error) {
            // Try to convert error codes like 'ECONNREFUSED' to HTTP status
            const code = (error as any).code;
            if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
              statusCode = 503; // Service Unavailable
            } else if (code === 'ECONNRESET') {
              statusCode = 500; // Internal Server Error
            }
          }
        }
        
        // Also check for response property that might contain status
        if (!statusCode && error instanceof Error && 'response' in error) {
          const response = (error as any).response;
          if (response && typeof response === 'object' && 'status' in response) {
            statusCode = response.status;
          }
        }
        
        // Default to checking if error contains text that suggests it's retryable
        const isTextRetryable = errorMessage.includes('rate limit') || 
                                errorMessage.includes('throttled') || 
                                errorMessage.includes('capacity') ||
                                errorMessage.includes('overloaded') ||
                                errorMessage.includes('busy') ||
                                errorMessage.includes('retry');
        
        // Explicitly exclude timeouts from retry
        const isRetryable = (isTextRetryable || !statusCode || retryStatusCodes.includes(statusCode)) && !isTimeoutError;

        if (!isRetryable) {
          logger.error(`Non-retryable error (status ${statusCode}) for ${service} API call`);
          throw error;
        }

        // Increment retries
        retries++;

        // Calculate delay with exponential backoff and jitter
        delay = Math.min(delay * 1.5, maxDelayMs);
        const jitter = delay * 0.2 * Math.random();
        const actualDelay = delay + jitter;

        logger.info(`Retrying ${service} API call after ${actualDelay}ms delay (retry ${retries}/${maxRetries})`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }
  }, { priority, taskId });
} 