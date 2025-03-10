// Document caching utilities
// Provides caching functionality for optimized documents

type CachedDocument = {
  docxBase64: string;
  pdfBase64?: string;
  originalAtsScore: number;
  improvedAtsScore: number;
  timestamp: number;
  expiryTime: number; // Time in ms after which cache is considered stale
};

type CacheEntry = {
  cvId: string;
  documents: CachedDocument;
};

const CACHE_PREFIX = 'cv_optimizer_cache_';
const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Store optimized CV document in cache
 */
export const cacheDocument = (
  cvId: string, 
  data: {
    docxBase64: string;
    pdfBase64?: string;
    originalAtsScore: number;
    improvedAtsScore: number;
    expiryTime?: number;
  }
): void => {
  if (!cvId || !data.docxBase64) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${cvId}`;
    const cacheEntry: CachedDocument = {
      docxBase64: data.docxBase64,
      pdfBase64: data.pdfBase64,
      originalAtsScore: data.originalAtsScore,
      improvedAtsScore: data.improvedAtsScore,
      timestamp: Date.now(),
      expiryTime: data.expiryTime || DEFAULT_EXPIRY,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    console.log(`Cached document for CV ID ${cvId}`);
  } catch (error) {
    console.error('Error caching document:', error);
  }
};

/**
 * Update PDF in cached document entry
 */
export const updateCachedPDF = (
  cvId: string,
  pdfBase64: string
): void => {
  if (!cvId || !pdfBase64) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${cvId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      const cacheEntry: CachedDocument = JSON.parse(cachedData);
      cacheEntry.pdfBase64 = pdfBase64;
      cacheEntry.timestamp = Date.now(); // Update timestamp
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`Updated cached PDF for CV ID ${cvId}`);
    }
  } catch (error) {
    console.error('Error updating cached PDF:', error);
  }
};

/**
 * Retrieve cached document
 * Returns null if not found or expired
 */
export const getCachedDocument = (
  cvId: string,
  ignoreExpiry: boolean = false
): CachedDocument | null => {
  if (!cvId) return null;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${cvId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const cacheEntry: CachedDocument = JSON.parse(cachedData);
    
    // Check if cache is expired
    if (!ignoreExpiry && Date.now() > cacheEntry.timestamp + cacheEntry.expiryTime) {
      console.log(`Cache expired for CV ID ${cvId}`);
      return null;
    }
    
    return cacheEntry;
  } catch (error) {
    console.error('Error retrieving cached document:', error);
    return null;
  }
};

/**
 * Clear cached document for specific CV
 */
export const clearCachedDocument = (cvId: string): void => {
  if (!cvId) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${cvId}`;
    localStorage.removeItem(cacheKey);
    console.log(`Cleared cache for CV ID ${cvId}`);
  } catch (error) {
    console.error('Error clearing cached document:', error);
  }
};

/**
 * Clear all document caches
 */
export const clearAllCachedDocuments = (): void => {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cached documents`);
  } catch (error) {
    console.error('Error clearing all cached documents:', error);
  }
};

/**
 * Get cache age in human-readable format
 */
export const getCacheAge = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  
  // Convert to minutes, hours, or days
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}; 