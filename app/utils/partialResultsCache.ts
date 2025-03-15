import { logger } from '@/lib/logger';

// Define a more structured type for partial results
interface PartialResult {
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  progress: number;
  timestamp: number;
  lastUpdated: number;
}

// In-memory cache for partial results
// In a production environment, this should be replaced with Redis or another distributed cache
const partialResultsCache: Record<string, PartialResult> = {};

// Cache cleanup interval (every 5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

// Cache entry expiration (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

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
  }
) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  const now = Date.now();
  
  // If entry already exists, update it
  if (partialResultsCache[cacheKey]) {
    // Only update if the new progress is higher
    if (results.progress > partialResultsCache[cacheKey].progress) {
      partialResultsCache[cacheKey] = {
        ...results,
        timestamp: partialResultsCache[cacheKey].timestamp, // Keep original timestamp
        lastUpdated: now
      };
      logger.debug(`Updated partial results for ${cacheKey}, progress: ${results.progress}%`);
    }
  } else {
    // Create new entry
    partialResultsCache[cacheKey] = {
      ...results,
      timestamp: now,
      lastUpdated: now
    };
    logger.debug(`Stored new partial results for ${cacheKey}, progress: ${results.progress}%`);
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
  return partialResultsCache[cacheKey] || null;
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