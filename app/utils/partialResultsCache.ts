import { logger } from '@/lib/logger';

// In-memory cache for partial results
// In a production environment, this should be replaced with Redis or another distributed cache
const partialResultsCache: Record<string, any> = {};

/**
 * Helper function to store partial results (called from the optimization endpoint)
 */
export function storePartialResults(userId: string, cvId: string, jobDescription: string, results: any) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  partialResultsCache[cacheKey] = results;
  
  // Set an expiration for the cache entry (30 minutes)
  setTimeout(() => {
    delete partialResultsCache[cacheKey];
  }, 30 * 60 * 1000);
}

/**
 * Helper function to clear partial results (called when optimization completes)
 */
export function clearPartialResults(userId: string, cvId: string, jobDescription: string) {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  delete partialResultsCache[cacheKey];
}

/**
 * Helper function to get partial results
 */
export function getPartialResults(userId: string, cvId: string, jobDescription: string): any {
  const cacheKey = generateCacheKey(userId, cvId, jobDescription);
  return partialResultsCache[cacheKey] || null;
}

/**
 * Helper function to generate a cache key
 */
function generateCacheKey(userId: string, cvId: string, jobDescription: string): string {
  return `${userId}:${cvId}:${jobDescription.substring(0, 50)}`;
} 