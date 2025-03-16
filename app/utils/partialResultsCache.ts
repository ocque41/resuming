import { logger } from '@/lib/logger';

// Define a more structured type for partial results
interface PartialResult {
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  progress: number;
  timestamp: number;
  lastUpdated: number;
  retryCount?: number; // Track retry attempts
  error?: string; // Store any error messages
}

// In-memory cache for partial results
// In a production environment, this should be replaced with Redis or another distributed cache
const partialResultsCache: Record<string, PartialResult> = {};

// Cache cleanup interval (every 3 minutes - reduced from 5)
const CACHE_CLEANUP_INTERVAL = 3 * 60 * 1000;

// Cache entry expiration (60 minutes - increased from 30)
const CACHE_EXPIRATION = 60 * 60 * 1000;

// Set up periodic cache cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredCache();
  }, CACHE_CLEANUP_INTERVAL);
}

/**
 * Helper function to store partial results (called from the optimization endpoint)
 */
export function storePartialResults(
  userId: string, 
  cvId: string, 
  jobDescription: string, 
  results: {
    optimizedContent: string;
    matchScore: number;
    recommendations: string[];
    progress: number;
    error?: string;
  }
) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  const now = Date.now();
  
  // If entry already exists, update it
  if (partialResultsCache[cacheKey]) {
    const currentEntry = partialResultsCache[cacheKey];
    
    // Only update if the new progress is higher or if there was an error
    if (results.progress > currentEntry.progress || results.error) {
      partialResultsCache[cacheKey] = {
        ...results,
        timestamp: currentEntry.timestamp, // Keep original timestamp
        lastUpdated: now,
        retryCount: currentEntry.retryCount || 0 // Preserve retry count
      };
      logger.debug(`Updated partial results for ${cacheKey}, progress: ${results.progress}%`);
    }
  } else {
    // Create new entry
    partialResultsCache[cacheKey] = {
      ...results,
      timestamp: now,
      lastUpdated: now,
      retryCount: 0
    };
    logger.debug(`Stored new partial results for ${cacheKey}, progress: ${results.progress}%`);
  }
}

/**
 * Helper function to increment retry count for partial results
 */
export function incrementRetryCount(userId: string, cvId: string, jobDescription: string): number {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  if (partialResultsCache[cacheKey]) {
    const retryCount = (partialResultsCache[cacheKey].retryCount || 0) + 1;
    partialResultsCache[cacheKey].retryCount = retryCount;
    partialResultsCache[cacheKey].lastUpdated = Date.now();
    logger.debug(`Incremented retry count for ${cacheKey} to ${retryCount}`);
    return retryCount;
  }
  return 0;
}

/**
 * Helper function to store error in partial results
 */
export function storePartialResultsError(
  userId: string, 
  cvId: string, 
  jobDescription: string, 
  error: string
) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  const now = Date.now();
  
  if (partialResultsCache[cacheKey]) {
    partialResultsCache[cacheKey].error = error;
    partialResultsCache[cacheKey].lastUpdated = now;
    logger.debug(`Stored error in partial results for ${cacheKey}: ${error}`);
  } else {
    // Create new entry with error
    partialResultsCache[cacheKey] = {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 0,
      timestamp: now,
      lastUpdated: now,
      retryCount: 0,
      error
    };
    logger.debug(`Created new partial results with error for ${cacheKey}: ${error}`);
  }
}

/**
 * Helper function to clear partial results (called when optimization completes)
 */
export function clearPartialResults(userId: string, cvId: string, jobDescription: string) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  if (partialResultsCache[cacheKey]) {
    delete partialResultsCache[cacheKey];
    logger.debug(`Cleared partial results for ${cacheKey}`);
  }
}

/**
 * Helper function to get partial results
 */
export function getPartialResults(userId: string, cvId: string, jobDescription: string): PartialResult | null {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  const result = partialResultsCache[cacheKey];
  
  if (result) {
    // Update last accessed time
    result.lastUpdated = Date.now();
  }
  
  return result || null;
}

/**
 * Helper function to generate a cache key
 */
function generateCacheKey(userId: string, cvId: string, jobDescription: string): string {
  // Use a hash of the job description to avoid very long keys
  const jobHash = hashString(jobDescription);
  return `${userId}:${cvId}:${jobHash}`;
}

/**
 * Simple string hashing function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16); // Convert to hex
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache() {
  const now = Date.now();
  let cleanedCount = 0;
  
  Object.keys(partialResultsCache).forEach(key => {
    const entry = partialResultsCache[key];
    if (now - entry.lastUpdated > CACHE_EXPIRATION) {
      delete partialResultsCache[key];
      cleanedCount++;
    }
  });
  
  if (cleanedCount > 0) {
    logger.debug(`Cleaned up ${cleanedCount} expired partial results cache entries`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    entries: Object.keys(partialResultsCache).length,
    memoryUsage: estimateCacheSize()
  };
}

/**
 * Estimate the size of the cache in bytes (rough approximation)
 */
function estimateCacheSize(): number {
  let size = 0;
  
  Object.keys(partialResultsCache).forEach(key => {
    // Key size
    size += key.length * 2; // Approximate 2 bytes per character
    
    // Value size
    const entry = partialResultsCache[key];
    size += entry.optimizedContent.length * 2; // Content
    size += JSON.stringify(entry.recommendations).length * 2; // Recommendations
    size += 32; // Numbers and timestamps (8 bytes each)
  });
  
  return size;
} 