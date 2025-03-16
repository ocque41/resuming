import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Types for cache entries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  source: string; // Track where the data came from (mistral, openai, etc.)
  hitCount: number; // Track how many times this entry was accessed
}

// Cache configuration
const CACHE_EXPIRY = {
  CV_ANALYSIS: 48 * 60 * 60 * 1000, // 48 hours (increased from 24)
  CV_OPTIMIZATION: 24 * 60 * 60 * 1000, // 24 hours (increased from 12)
  COMBINED: 24 * 60 * 60 * 1000, // 24 hours (increased from 12)
  EMBEDDING: 14 * 24 * 60 * 60 * 1000, // 14 days for embeddings (increased from 7)
  PARTIAL_RESULTS: 60 * 60 * 1000, // 60 minutes for partial results (increased from 30)
};

// In-memory cache storage
const memoryCache: Record<string, CacheEntry<any>> = {};

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  stores: 0,
  evictions: 0,
  lastCleanup: Date.now(),
};

/**
 * Generate a cache key from input data
 */
function generateCacheKey(prefix: string, data: any): string {
  // For strings, use a hash of the content
  if (typeof data === 'string') {
    return `${prefix}:${crypto.createHash('md5').update(data).digest('hex')}`;
  }
  
  // For objects, stringify and hash
  if (typeof data === 'object' && data !== null) {
    return `${prefix}:${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}`;
  }
  
  // Fallback
  return `${prefix}:${String(data)}`;
}

/**
 * Store data in cache
 */
export function cacheStore<T>(
  key: string, 
  data: T, 
  expiryMs: number = CACHE_EXPIRY.CV_ANALYSIS,
  source: string = 'default'
): void {
  // Don't cache null or undefined data
  if (data === null || data === undefined) {
    logger.debug(`Skipping cache for null/undefined data with key: ${key}`);
    return;
  }
  
  // For arrays, don't cache empty arrays
  if (Array.isArray(data) && data.length === 0) {
    logger.debug(`Skipping cache for empty array with key: ${key}`);
    return;
  }
  
  // For objects, check if it's empty or has meaningful content
  if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      logger.debug(`Skipping cache for empty object with key: ${key}`);
      return;
    }
    
    // Check if all values are null/undefined/empty
    const allEmpty = keys.every(k => {
      const val = (data as any)[k];
      return val === null || val === undefined || 
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'string' && val.trim() === '');
    });
    
    if (allEmpty) {
      logger.debug(`Skipping cache for object with all empty values with key: ${key}`);
      return;
    }
  }
  
  const now = Date.now();
  memoryCache[key] = {
    data,
    timestamp: now,
    expiresAt: now + expiryMs,
    source,
    hitCount: 0,
  };
  cacheStats.stores++;
  logger.debug(`Cached data with key: ${key}, source: ${source}, expires in ${expiryMs / 1000 / 60} minutes`);
}

/**
 * Retrieve data from cache
 * Returns null if not found or expired
 */
export function cacheGet<T>(key: string): T | null {
  const entry = memoryCache[key];
  
  // Check if entry exists
  if (!entry) {
    cacheStats.misses++;
    return null;
  }
  
  // Check if entry is expired
  if (Date.now() > entry.expiresAt) {
    logger.debug(`Cache entry expired for key: ${key}`);
    delete memoryCache[key];
    cacheStats.evictions++;
    cacheStats.misses++;
    return null;
  }
  
  // Increment hit count
  entry.hitCount++;
  cacheStats.hits++;
  
  logger.debug(`Cache hit for key: ${key}, source: ${entry.source}, hit count: ${entry.hitCount}`);
  return entry.data as T;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  let clearedCount = 0;
  
  Object.keys(memoryCache).forEach(key => {
    if (now > memoryCache[key].expiresAt) {
      delete memoryCache[key];
      clearedCount++;
      cacheStats.evictions++;
    }
  });
  
  if (clearedCount > 0) {
    logger.debug(`Cleared ${clearedCount} expired cache entries`);
  }
  
  cacheStats.lastCleanup = now;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { 
  totalEntries: number, 
  memoryUsage: number,
  hits: number,
  misses: number,
  hitRate: number,
  stores: number,
  evictions: number,
  lastCleanup: Date
} {
  const totalEntries = Object.keys(memoryCache).length;
  
  // Estimate memory usage (rough approximation)
  let memoryUsage = 0;
  Object.keys(memoryCache).forEach(key => {
    // Key size
    memoryUsage += key.length * 2;
    
    // Data size (rough estimate)
    const data = memoryCache[key].data;
    if (typeof data === 'string') {
      memoryUsage += data.length * 2;
    } else if (typeof data === 'object' && data !== null) {
      memoryUsage += JSON.stringify(data).length * 2;
    }
  });
  
  const hitRate = cacheStats.hits / Math.max(cacheStats.hits + cacheStats.misses, 1);
  
  return { 
    totalEntries, 
    memoryUsage,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate,
    stores: cacheStats.stores,
    evictions: cacheStats.evictions,
    lastCleanup: new Date(cacheStats.lastCleanup)
  };
}

// Cache specific functions for CV operations

/**
 * Cache CV analysis result
 */
export function cacheCVAnalysis(cvText: string, result: any, source: string = 'mistral'): void {
  const key = generateCacheKey('cv-analysis', cvText);
  cacheStore(key, result, CACHE_EXPIRY.CV_ANALYSIS, source);
}

/**
 * Get cached CV analysis result
 */
export function getCachedCVAnalysis(cvText: string): any | null {
  const key = generateCacheKey('cv-analysis', cvText);
  return cacheGet(key);
}

/**
 * Cache CV optimization result
 */
export function cacheCVOptimization(cvText: string, jobDescription: string, result: any, source: string = 'mistral'): void {
  const key = generateCacheKey('cv-optimization', { cv: cvText, job: jobDescription });
  cacheStore(key, result, CACHE_EXPIRY.CV_OPTIMIZATION, source);
}

/**
 * Get cached CV optimization result
 */
export function getCachedCVOptimization(cvText: string, jobDescription: string): any | null {
  const key = generateCacheKey('cv-optimization', { cv: cvText, job: jobDescription });
  return cacheGet(key);
}

/**
 * Cache combined analysis and optimization result
 */
export function cacheCombinedResult(cvText: string, jobDescription: string, result: any, source: string = 'combined'): void {
  const key = generateCacheKey('cv-combined', { cv: cvText, job: jobDescription });
  cacheStore(key, result, CACHE_EXPIRY.COMBINED, source);
}

/**
 * Get cached combined result
 */
export function getCachedCombinedResult(cvText: string, jobDescription: string): any | null {
  const key = generateCacheKey('cv-combined', { cv: cvText, job: jobDescription });
  return cacheGet(key);
}

/**
 * Cache embedding result
 */
export function cacheEmbedding(text: string, embedding: number[], source: string = 'openai'): void {
  const key = generateCacheKey('embedding', text);
  cacheStore(key, embedding, CACHE_EXPIRY.EMBEDDING, source);
}

/**
 * Get cached embedding
 */
export function getCachedEmbedding(text: string): number[] | null {
  const key = generateCacheKey('embedding', text);
  return cacheGet(key);
}

/**
 * Cache partial results
 */
export function cachePartialResults(userId: string, cvId: string, jobDescription: string, results: any): void {
  const key = generateCacheKey('partial-results', { userId, cvId, job: jobDescription });
  cacheStore(key, results, CACHE_EXPIRY.PARTIAL_RESULTS, 'partial');
}

/**
 * Get cached partial results
 */
export function getCachedPartialResults(userId: string, cvId: string, jobDescription: string): any | null {
  const key = generateCacheKey('partial-results', { userId, cvId, job: jobDescription });
  return cacheGet(key);
}

// Set up periodic cache cleanup
if (typeof window === 'undefined') { // Only run on server
  setInterval(clearExpiredCache, 10 * 60 * 1000); // Clean up every 10 minutes (reduced from 15)
  logger.info('Cache cleanup scheduled every 10 minutes');
} 