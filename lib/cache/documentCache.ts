// Document caching utilities
// Provides caching functionality for optimized documents

type CachedDocument = {
  docxBase64: string;
  pdfBase64?: string;
  originalAtsScore: number;
  improvedAtsScore: number;
  timestamp: number;
  expiryTime: number; // Time in ms after which cache is considered stale
  originalText?: string; // Original CV text
  optimizedText?: string; // Optimized CV text
  improvements?: string[]; // List of improvements made
  version?: number; // Version number of this optimization
};

type CacheEntry = {
  cvId: string;
  documents: CachedDocument;
};

type OptimizationHistory = {
  versions: CachedDocument[];
  currentVersion: number;
};

const CACHE_PREFIX = 'cv_optimizer_cache_';
const HISTORY_PREFIX = 'cv_history_';
const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_HISTORY_ENTRIES = 5; // Maximum number of history entries to keep

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
    originalText?: string;
    optimizedText?: string;
    improvements?: string[];
  }
): void => {
  if (!cvId || !data.docxBase64) return;
  
  try {
    const cacheKey = `${CACHE_PREFIX}${cvId}`;
    const historyKey = `${HISTORY_PREFIX}${cvId}`;
    
    // Get existing history
    let history: OptimizationHistory;
    const existingHistory = localStorage.getItem(historyKey);
    
    if (existingHistory) {
      history = JSON.parse(existingHistory);
    } else {
      history = { versions: [], currentVersion: 0 };
    }
    
    // Create new cache document
    const cacheEntry: CachedDocument = {
      docxBase64: data.docxBase64,
      pdfBase64: data.pdfBase64,
      originalAtsScore: data.originalAtsScore,
      improvedAtsScore: data.improvedAtsScore,
      timestamp: Date.now(),
      expiryTime: data.expiryTime || DEFAULT_EXPIRY,
      originalText: data.originalText,
      optimizedText: data.optimizedText,
      improvements: data.improvements,
      version: history.versions.length + 1
    };
    
    // Add to history and trim if needed
    history.versions.push({ ...cacheEntry });
    if (history.versions.length > MAX_HISTORY_ENTRIES) {
      history.versions = history.versions.slice(-MAX_HISTORY_ENTRIES);
    }
    history.currentVersion = history.versions.length;
    
    // Store in both cache and history
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    localStorage.setItem(historyKey, JSON.stringify(history));
    
    console.log(`Cached document for CV ID ${cvId} (version ${cacheEntry.version})`);
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
    const historyKey = `${HISTORY_PREFIX}${cvId}`;
    const cachedData = localStorage.getItem(cacheKey);
    const historyData = localStorage.getItem(historyKey);
    
    if (cachedData) {
      const cacheEntry: CachedDocument = JSON.parse(cachedData);
      cacheEntry.pdfBase64 = pdfBase64;
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`Updated cached PDF for CV ID ${cvId}`);
      
      // Also update in history if it exists
      if (historyData) {
        const history: OptimizationHistory = JSON.parse(historyData);
        if (history.currentVersion > 0 && history.versions.length >= history.currentVersion) {
          history.versions[history.currentVersion - 1].pdfBase64 = pdfBase64;
          localStorage.setItem(historyKey, JSON.stringify(history));
        }
      }
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
 * Get optimization history for a CV
 */
export const getOptimizationHistory = (
  cvId: string
): OptimizationHistory | null => {
  if (!cvId) return null;
  
  try {
    const historyKey = `${HISTORY_PREFIX}${cvId}`;
    const historyData = localStorage.getItem(historyKey);
    
    if (!historyData) return null;
    
    return JSON.parse(historyData);
  } catch (error) {
    console.error('Error retrieving optimization history:', error);
    return null;
  }
};

/**
 * Get a specific version from history
 */
export const getHistoryVersion = (
  cvId: string,
  version: number
): CachedDocument | null => {
  try {
    const history = getOptimizationHistory(cvId);
    if (!history || !history.versions || history.versions.length < version) {
      return null;
    }
    
    return history.versions[version - 1];
  } catch (error) {
    console.error('Error retrieving history version:', error);
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
 * Clear optimization history for specific CV
 */
export const clearOptimizationHistory = (cvId: string): void => {
  if (!cvId) return;
  
  try {
    const historyKey = `${HISTORY_PREFIX}${cvId}`;
    localStorage.removeItem(historyKey);
    console.log(`Cleared optimization history for CV ID ${cvId}`);
  } catch (error) {
    console.error('Error clearing optimization history:', error);
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
      if (key && (key.startsWith(CACHE_PREFIX) || key.startsWith(HISTORY_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cached documents and histories`);
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