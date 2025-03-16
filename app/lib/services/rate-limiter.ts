import { logger } from '@/lib/logger';

interface RateLimiterOptions {
  maxRequests: number;
  interval: number; // in milliseconds
  timeout?: number; // in milliseconds
  retries?: number;
  backoffFactor?: number;
}

class RateLimiter {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private running = 0;
  private timestamps: number[] = [];
  private options: Required<RateLimiterOptions>;
  private processing = false;

  constructor(options: RateLimiterOptions) {
    this.options = {
      maxRequests: options.maxRequests,
      interval: options.interval,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      backoffFactor: options.backoffFactor || 1.5
    };
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Add the function to the queue
      this.queue.push({ fn, resolve, reject });
      
      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Check if we can run more requests
    if (this.canMakeRequest()) {
      const { fn, resolve, reject } = this.queue.shift()!;
      
      // Add timestamp
      this.timestamps.push(Date.now());
      this.running++;

      // Execute with timeout and retry
      this.executeWithRetry(fn, 0)
        .then((result) => {
          resolve(result);
          this.running--;
          this.processQueue();
        })
        .catch((error) => {
          reject(error);
          this.running--;
          this.processQueue();
        });
    } else {
      // Wait for next available slot
      const waitTime = this.getWaitTime();
      setTimeout(() => this.processQueue(), waitTime);
    }
  }

  private canMakeRequest(): boolean {
    // Clean up old timestamps
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.options.interval
    );

    return this.timestamps.length < this.options.maxRequests && this.running < this.options.maxRequests;
  }

  private getWaitTime(): number {
    if (this.timestamps.length === 0) return 0;
    
    const now = Date.now();
    const oldestTimestamp = this.timestamps[0];
    const timeToWait = this.options.interval - (now - oldestTimestamp);
    
    return Math.max(timeToWait, 50); // At least 50ms to avoid tight loops
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, retryCount: number): Promise<T> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${this.options.timeout}ms`));
        }, this.options.timeout);
      });

      // Race the original function against the timeout
      return await Promise.race([fn(), timeoutPromise]) as T;
    } catch (error) {
      // Log the error
      logger.warn(
        `API call failed (attempt ${retryCount + 1}/${this.options.retries}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Check if we should retry
      if (retryCount < this.options.retries - 1) {
        // Calculate backoff time
        const backoffTime = Math.pow(this.options.backoffFactor, retryCount) * 1000;
        
        logger.info(`Retrying in ${backoffTime}ms...`);
        
        // Wait for the backoff time
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry
        return this.executeWithRetry(fn, retryCount + 1);
      }

      // Max retries reached, throw the error
      throw error;
    }
  }
}

// Singleton instance for Mistral API
const mistralRateLimiter = new RateLimiter({
  maxRequests: 10,  // Max 10 requests
  interval: 60000,  // Per minute
  timeout: 60000,   // 60 second timeout
  retries: 3,       // 3 retries
  backoffFactor: 2  // Exponential backoff
});

export { RateLimiter, mistralRateLimiter }; 