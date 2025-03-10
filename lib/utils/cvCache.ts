/**
 * CV Caching Service
 * 
 * This service provides caching capabilities for the CV optimization workflow to improve performance.
 * It caches both the intermediate results (like analysis data) and generated files (DOCX, PDF).
 */

import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { LRUCache } from 'lru-cache';

// Constants
const CACHE_DIR = path.join(process.cwd(), '.cache');
const MAX_ANALYSIS_CACHE_SIZE = 100; // Number of CV analyses to cache
const MAX_FILE_CACHE_SIZE = 50; // Number of files to cache
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in production environment
const isProd = process.env.NODE_ENV === 'production';

// In-memory cache for analysis results
const analysisCache = new LRUCache<string, any>({
  max: MAX_ANALYSIS_CACHE_SIZE,
});

// In-memory cache for file paths
const filePathCache = new LRUCache<string, string>({
  max: MAX_FILE_CACHE_SIZE,
  ttl: MAX_FILE_AGE_MS,
});

/**
 * Initialize the cache service
 */
export async function initCVCache(): Promise<void> {
  try {
    // Create cache directory if it doesn't exist
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    
    // Create subdirectories for different cache types
    await fsPromises.mkdir(path.join(CACHE_DIR, 'docx'), { recursive: true });
    await fsPromises.mkdir(path.join(CACHE_DIR, 'pdf'), { recursive: true });
    await fsPromises.mkdir(path.join(CACHE_DIR, 'analysis'), { recursive: true });
    
    console.log(`CV Cache initialized at ${CACHE_DIR}`);
  } catch (error) {
    console.error('Failed to initialize CV cache:', error);
  }
}

/**
 * Clear all cached data
 */
export async function clearCVCache(): Promise<void> {
  try {
    // Clear in-memory caches
    analysisCache.clear();
    filePathCache.clear();
    
    // Remove and recreate cache directories
    if (fs.existsSync(CACHE_DIR)) {
      await fsPromises.rm(CACHE_DIR, { recursive: true, force: true });
    }
    
    await initCVCache();
    console.log('CV Cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear CV cache:', error);
  }
}

/**
 * Generate a cache key for a CV
 */
function getCVCacheKey(cvId: number | string, type: string, extra?: string): string {
  return `cv_${cvId}_${type}${extra ? `_${extra}` : ''}`;
}

/**
 * Cache CV analysis results
 */
export function cacheAnalysis(cvId: number | string, analysisData: any): void {
  const cacheKey = getCVCacheKey(cvId, 'analysis');
  analysisCache.set(cacheKey, analysisData);
  
  // Also save to file if in production for persistence
  if (isProd) {
    const filePath = path.join(CACHE_DIR, 'analysis', `${cacheKey}.json`);
    fsPromises.writeFile(filePath, JSON.stringify(analysisData))
      .catch(error => console.error(`Failed to cache analysis to file for CV ${cvId}:`, error));
  }
}

/**
 * Get cached CV analysis
 */
export async function getCachedAnalysis(cvId: number | string): Promise<any | null> {
  const cacheKey = getCVCacheKey(cvId, 'analysis');
  
  // Check in-memory cache first
  const memoryCache = analysisCache.get(cacheKey);
  if (memoryCache) {
    return memoryCache;
  }
  
  // If not found in memory and in production, check file cache
  if (isProd) {
    const filePath = path.join(CACHE_DIR, 'analysis', `${cacheKey}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const data = await fsPromises.readFile(filePath, 'utf-8');
        const analysisData = JSON.parse(data);
        
        // Add to in-memory cache
        analysisCache.set(cacheKey, analysisData);
        
        return analysisData;
      }
    } catch (error) {
      console.error(`Failed to read cached analysis for CV ${cvId}:`, error);
    }
  }
  
  return null;
}

/**
 * Cache a generated file
 */
export async function cacheFile(
  cvId: number | string, 
  fileType: 'docx' | 'pdf', 
  fileBuffer: Buffer,
  version?: string
): Promise<string> {
  const timestamp = Date.now();
  const versionStr = version || 'latest';
  const fileName = `cv_${cvId}_${fileType}_${versionStr}_${timestamp}.${fileType}`;
  const filePath = path.join(CACHE_DIR, fileType, fileName);
  
  // Cache the file path
  const cacheKey = getCVCacheKey(cvId, fileType, versionStr);
  filePathCache.set(cacheKey, filePath);
  
  // Write the file to disk
  await fsPromises.writeFile(filePath, fileBuffer);
  
  return filePath;
}

/**
 * Get cached file path
 */
export function getCachedFilePath(
  cvId: number | string, 
  fileType: 'docx' | 'pdf',
  version?: string
): string | null {
  const cacheKey = getCVCacheKey(cvId, fileType, version || 'latest');
  const filePath = filePathCache.get(cacheKey);
  
  if (filePath && fs.existsSync(filePath)) {
    return filePath;
  }
  
  return null;
}

/**
 * Get cached file content
 */
export async function getCachedFile(
  cvId: number | string, 
  fileType: 'docx' | 'pdf',
  version?: string
): Promise<Buffer | null> {
  const filePath = getCachedFilePath(cvId, fileType, version);
  
  if (filePath) {
    try {
      return await fsPromises.readFile(filePath);
    } catch (error) {
      console.error(`Failed to read cached ${fileType} for CV ${cvId}:`, error);
    }
  }
  
  return null;
}

/**
 * Cache the base64 representation of a file
 */
export function cacheBase64(
  cvId: number | string, 
  fileType: 'docx' | 'pdf', 
  base64Data: string
): void {
  const cacheKey = getCVCacheKey(cvId, `${fileType}_base64`);
  analysisCache.set(cacheKey, base64Data);
}

/**
 * Get cached base64 data
 */
export function getCachedBase64(
  cvId: number | string, 
  fileType: 'docx' | 'pdf'
): string | null {
  const cacheKey = getCVCacheKey(cvId, `${fileType}_base64`);
  return analysisCache.get(cacheKey) || null;
}

/**
 * Invalidate cache for a specific CV
 */
export async function invalidateCVCache(cvId: number | string): Promise<void> {
  // Clear in-memory caches for this CV
  const analysisKey = getCVCacheKey(cvId, 'analysis');
  const docxKey = getCVCacheKey(cvId, 'docx', 'latest');
  const pdfKey = getCVCacheKey(cvId, 'pdf', 'latest');
  const docxBase64Key = getCVCacheKey(cvId, 'docx_base64');
  const pdfBase64Key = getCVCacheKey(cvId, 'pdf_base64');
  
  analysisCache.delete(analysisKey);
  filePathCache.delete(docxKey);
  filePathCache.delete(pdfKey);
  analysisCache.delete(docxBase64Key);
  analysisCache.delete(pdfBase64Key);
  
  // Remove the files from disk
  if (isProd) {
    try {
      const analysisPath = path.join(CACHE_DIR, 'analysis', `${analysisKey}.json`);
      if (fs.existsSync(analysisPath)) {
        await fsPromises.unlink(analysisPath);
      }
      
      // Remove all files for this CV from the file directories
      const removeMatchingFiles = async (dir: string) => {
        const files = await fsPromises.readdir(dir);
        const matchingFiles = files.filter(file => file.startsWith(`cv_${cvId}_`));
        
        for (const file of matchingFiles) {
          await fsPromises.unlink(path.join(dir, file));
        }
      };
      
      await removeMatchingFiles(path.join(CACHE_DIR, 'docx'));
      await removeMatchingFiles(path.join(CACHE_DIR, 'pdf'));
    } catch (error) {
      console.error(`Failed to remove cached files for CV ${cvId}:`, error);
    }
  }
} 