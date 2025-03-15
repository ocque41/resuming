import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Types for cache entries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache configuration
const CACHE_EXPIRY = {
  CV_ANALYSIS: 24 * 60 * 60 * 1000, // 24 hours
  CV_OPTIMIZATION: 12 * 60 * 60 * 1000, // 12 hours
  COMBINED: 12 * 60 * 60 * 1000, // 12 hours
};

// In-memory cache storage
const memoryCache: Record<string, CacheEntry<any>> = {};

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
export function cacheStore<T>(key: string, data: T, expiryMs: number = CACHE_EXPIRY.CV_ANALYSIS): void {
  const now = Date.now();
  memoryCache[key] = {
    data,
    timestamp: now,
    expiresAt: now + expiryMs,
  };
  logger.debug(`Cached data with key: ${key}, expires in ${expiryMs / 1000 / 60} minutes`);
}

/**
 * Retrieve data from cache
 * Returns null if not found or expired
 */
export function cacheGet<T>(key: string): T | null {
  const entry = memoryCache[key];
  
  // Check if entry exists
  if (!entry) {
    return null;
  }
  
  // Check if entry is expired
  if (Date.now() > entry.expiresAt) {
    logger.debug(`Cache entry expired for key: ${key}`);
    delete memoryCache[key];
    return null;
  }
  
  logger.debug(`Cache hit for key: ${key}`);
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
    }
  });
  
  if (clearedCount > 0) {
    logger.debug(`Cleared ${clearedCount} expired cache entries`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { totalEntries: number, memoryUsage: number } {
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
  
  return { totalEntries, memoryUsage };
}

// Cache specific functions for CV operations

/**
 * Cache CV analysis result
 */
export function cacheCVAnalysis(cvText: string, result: any): void {
  const key = generateCacheKey('cv-analysis', cvText);
  cacheStore(key, result, CACHE_EXPIRY.CV_ANALYSIS);
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
export function cacheCVOptimization(cvText: string, jobDescription: string, result: any): void {
  const key = generateCacheKey('cv-optimization', { cv: cvText, job: jobDescription });
  cacheStore(key, result, CACHE_EXPIRY.CV_OPTIMIZATION);
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
export function cacheCombinedResult(cvText: string, jobDescription: string, result: any): void {
  const key = generateCacheKey('cv-combined', { cv: cvText, job: jobDescription });
  cacheStore(key, result, CACHE_EXPIRY.COMBINED);
}

/**
 * Get cached combined result
 */
export function getCachedCombinedResult(cvText: string, jobDescription: string): any | null {
  const key = generateCacheKey('cv-combined', { cv: cvText, job: jobDescription });
  return cacheGet(key);
}

// Set up periodic cache cleanup
if (typeof window === 'undefined') { // Only run on server
  setInterval(clearExpiredCache, 30 * 60 * 1000); // Clean up every 30 minutes
  logger.info('Cache cleanup scheduled every 30 minutes');
} 