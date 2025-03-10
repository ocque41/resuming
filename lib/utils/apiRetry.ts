/**
 * API Retry Utility
 * 
 * This utility provides mechanisms for retrying failed API calls with configurable
 * retry counts and exponential backoff.
 */

interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableStatusCodes?: number[];
  retryableErrors?: string[];
  onRetry?: (error: any, retryCount: number, delayMs: number) => void;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EPIPE"],
};

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determines if an error should be retried based on the retry options
 */
const shouldRetry = (error: any, options: RetryOptions): boolean => {
  // Retry based on status code
  if (error.status && options.retryableStatusCodes?.includes(error.status)) {
    return true;
  }
  
  // Retry based on error code
  if (error.code && options.retryableErrors?.includes(error.code)) {
    return true;
  }
  
  // Retry network errors
  if (error.message && (
    error.message.includes("network") || 
    error.message.includes("connect") || 
    error.message.includes("timeout") ||
    error.message.includes("abort")
  )) {
    return true;
  }
  
  // Don't retry client errors (4xx) except the ones explicitly included
  if (error.status && error.status >= 400 && error.status < 500 && 
      !options.retryableStatusCodes?.includes(error.status)) {
    return false;
  }
  
  // By default, retry server errors
  return error.status ? error.status >= 500 : true;
};

/**
 * Calculates the delay time for the next retry with exponential backoff
 */
const calculateDelay = (retryCount: number, options: RetryOptions): number => {
  const delay = options.initialDelayMs * Math.pow(options.backoffFactor, retryCount);
  // Add a small random jitter to avoid thundering herd problem
  const jitter = Math.random() * 100;
  return Math.min(delay + jitter, options.maxDelayMs);
};

/**
 * Executes a function with automatic retries
 * 
 * @param fn The function to execute and potentially retry
 * @param options Retry configuration options
 * @returns Promise that resolves with the function's result or rejects after all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOptions = { ...defaultRetryOptions, ...options };
  let lastError: any;
  
  for (let retryCount = 0; retryCount <= retryOptions.maxRetries; retryCount++) {
    try {
      // If it's a retry (not the first attempt), add a delay
      if (retryCount > 0) {
        const delayMs = calculateDelay(retryCount - 1, retryOptions);
        
        // Call the onRetry callback if provided
        if (retryOptions.onRetry) {
          retryOptions.onRetry(lastError, retryCount, delayMs);
        } else {
          console.log(`Retrying after error (attempt ${retryCount}): ${lastError?.message || 'Unknown error'}`);
        }
        
        await sleep(delayMs);
      }
      
      // Execute the function
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Determine if we should retry
      if (retryCount >= retryOptions.maxRetries || !shouldRetry(error, retryOptions)) {
        break;
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}

/**
 * Fetch wrapper with automatic retries
 * 
 * @param url The URL to fetch
 * @param options Fetch options and retry options
 * @returns Promise that resolves with the fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { retryOptions?: Partial<RetryOptions> } = {}
): Promise<Response> {
  const { retryOptions, ...fetchOptions } = options;
  
  return withRetry(
    async () => {
      const response = await fetch(url, fetchOptions);
      
      // Throw an error for non-2xx status codes to trigger retry
      if (!response.ok) {
        const error: any = new Error(`HTTP error ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      return response;
    },
    retryOptions
  );
}

/**
 * Registers a global error handler for failed CV processing tasks
 * and automatically schedules retries for recoverable errors
 */
export function registerCVProcessingErrorHandler() {
  // Initialize error tracking
  const processingErrors = new Map<number, {
    cvId: number;
    error: string;
    timestamp: Date;
    retryCount: number;
    nextRetry: Date | null;
    status: 'pending' | 'retrying' | 'failed';
  }>();
  
  // Set up periodic checking for failed processes
  setInterval(() => {
    const now = new Date();
    
    // Find all pending retries that are due
    for (const [cvId, errorInfo] of processingErrors.entries()) {
      if (errorInfo.status === 'pending' && errorInfo.nextRetry && errorInfo.nextRetry <= now) {
        // Update status to retrying
        errorInfo.status = 'retrying';
        
        // Attempt to restart the process
        restartCVProcessing(cvId)
          .then(() => {
            // On success, remove from error tracking
            processingErrors.delete(cvId);
          })
          .catch(error => {
            // On failure, update retry information
            const maxRetries = 3;
            errorInfo.retryCount += 1;
            errorInfo.error = error.message || 'Retry failed';
            
            if (errorInfo.retryCount >= maxRetries) {
              errorInfo.status = 'failed';
              errorInfo.nextRetry = null;
            } else {
              errorInfo.status = 'pending';
              // Calculate next retry time with exponential backoff
              const delayMs = 1000 * Math.pow(2, errorInfo.retryCount);
              errorInfo.nextRetry = new Date(now.getTime() + delayMs);
            }
          });
      }
    }
  }, 30000); // Check every 30 seconds
  
  // Function to restart CV processing
  async function restartCVProcessing(cvId: number): Promise<void> {
    try {
      const response = await fetchWithRetry(`/api/cv/process/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId }),
        retryOptions: {
          maxRetries: 2,
          initialDelayMs: 2000,
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restart processing');
      }
    } catch (error) {
      console.error(`Failed to restart processing for CV ID ${cvId}:`, error);
      throw error;
    }
  }
  
  // Return functions to track and manage processing errors
  return {
    /**
     * Track a CV processing error for potential retry
     */
    trackProcessingError: (cvId: number, error: string) => {
      processingErrors.set(cvId, {
        cvId,
        error,
        timestamp: new Date(),
        retryCount: 0,
        nextRetry: new Date(Date.now() + 5000), // Retry after 5 seconds initially
        status: 'pending',
      });
    },
    
    /**
     * Get the current processing errors
     */
    getProcessingErrors: () => {
      return Array.from(processingErrors.values());
    },
    
    /**
     * Manually trigger a retry for a specific CV
     */
    retryProcessing: async (cvId: number) => {
      const errorInfo = processingErrors.get(cvId);
      if (errorInfo) {
        errorInfo.status = 'retrying';
        try {
          await restartCVProcessing(cvId);
          processingErrors.delete(cvId);
          return true;
        } catch (error) {
          errorInfo.error = error instanceof Error ? error.message : String(error);
          errorInfo.status = 'pending';
          errorInfo.retryCount += 1;
          errorInfo.nextRetry = new Date(Date.now() + 5000);
          return false;
        }
      }
      return false;
    },
  };
} 