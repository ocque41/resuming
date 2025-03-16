import { OptimizationState } from "./progressiveOptimization";

// In-memory storage for partial results (in a production app, this would use a database)
const partialResultsStore: Record<string, any> = {};

/**
 * Generate a unique key for storing partial results
 */
function getPartialResultsKey(userId: string, cvId: string): string {
  return `${userId}:${cvId}`;
}

/**
 * Store partial results for a CV optimization process
 */
export async function storePartialResults(
  userId: string,
  cvId: string,
  results: any,
  optimizationState?: OptimizationState
): Promise<void> {
  const key = getPartialResultsKey(userId, cvId);
  
  partialResultsStore[key] = {
    ...results,
    optimizationState,
    timestamp: Date.now()
  };
}

/**
 * Get partial results for a CV optimization process
 */
export async function getPartialResults(
  userId: string,
  cvId: string
): Promise<any | null> {
  const key = getPartialResultsKey(userId, cvId);
  return partialResultsStore[key] || null;
}

/**
 * Clear partial results for a CV optimization process
 */
export async function clearPartialResults(
  userId: string,
  cvId: string
): Promise<void> {
  const key = getPartialResultsKey(userId, cvId);
  delete partialResultsStore[key];
}

/**
 * Store error information in partial results
 */
export async function storePartialResultsError(
  userId: string,
  cvId: string,
  error: Error | string
): Promise<void> {
  const key = getPartialResultsKey(userId, cvId);
  const existingResults = partialResultsStore[key] || {};
  
  partialResultsStore[key] = {
    ...existingResults,
    error: error instanceof Error ? error.message : error,
    errorTimestamp: Date.now()
  };
} 