import { logger } from '@/lib/logger';
import { storePartialResults, getPartialResults, clearPartialResults, storePartialResultsError, incrementRetryCount } from '@/app/utils/partialResultsCache';

/**
 * Enum for optimization stages
 */
export enum OptimizationStage {
  // Initial state
  NOT_STARTED = 'NOT_STARTED',
  
  // Analysis stage
  ANALYZE_STARTED = 'ANALYZE_STARTED',
  SKILLS_EXTRACTED = 'SKILLS_EXTRACTED',
  KEYWORDS_EXTRACTED = 'KEYWORDS_EXTRACTED',
  KEY_REQUIREMENTS_EXTRACTED = 'KEY_REQUIREMENTS_EXTRACTED',
  FORMAT_ANALYZED = 'FORMAT_ANALYZED',
  CONTENT_ANALYZED = 'CONTENT_ANALYZED',
  INDUSTRY_DETERMINED = 'INDUSTRY_DETERMINED',
  LANGUAGE_DETECTED = 'LANGUAGE_DETECTED',
  SECTIONS_EXTRACTED = 'SECTIONS_EXTRACTED',
  ANALYZE_COMPLETED = 'ANALYZE_COMPLETED',
  
  // Optimization stage
  OPTIMIZE_STARTED = 'OPTIMIZE_STARTED',
  PROFILE_OPTIMIZED = 'PROFILE_OPTIMIZED',
  EXPERIENCE_OPTIMIZED = 'EXPERIENCE_OPTIMIZED',
  SKILLS_OPTIMIZED = 'SKILLS_OPTIMIZED',
  EDUCATION_OPTIMIZED = 'EDUCATION_OPTIMIZED',
  OPTIMIZE_COMPLETED = 'OPTIMIZE_COMPLETED',
  
  // Generate document stage
  GENERATE_STARTED = 'GENERATE_STARTED',
  GENERATE_COMPLETED = 'GENERATE_COMPLETED',
  
  // Error state
  ERROR = 'ERROR'
}

/**
 * Interface for optimization results
 */
export interface OptimizationResults {
  // Analysis results
  skills?: string[];
  keywords?: string[];
  keyRequirements?: string[];
  formatAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  contentAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  industry?: string;
  language?: string;
  sections?: Array<{ name: string; content: string }>;
  
  // Optimization results
  optimizedProfile?: string;
  optimizedExperience?: string[];
  optimizedSkills?: string[];
  optimizedEducation?: string[];
  optimizedContent?: string;
  matchScore?: number;
  recommendations?: string[];
  
  // Generate document results
  formattedDocument?: string;
  format?: string;
}

/**
 * Interface for optimization state
 */
export interface OptimizationState {
  userId: string;
  cvId: string;
  jobDescription: string;
  stage: OptimizationStage;
  progress: number;
  error?: string;
  results: OptimizationResults;
  timestamp: number;
  lastUpdated: number;
}

/**
 * Interface for optimization options
 */
export interface OptimizationOptions {
  preserveSections?: Record<string, boolean>;
  documentFormat?: string;
  maxRetries?: number;
  useSimplifiedProcess?: boolean;
  aiService?: 'auto' | 'openai'; // Which AI service to use
}

/**
 * Interface for optimization result
 */
export interface OptimizationResult {
  success: boolean;
  message: string;
  result: {
    optimizedContent: string;
    matchScore: number;
    recommendations: string[];
    progress: number;
    error?: string;
    state: OptimizationState;
  };
}

// Cache to store optimization states
const optimizationStateCache = new Map<string, OptimizationState>();

/**
 * Generates a cache key for the optimization state
 */
function generateStateKey(userId: string, cvId: string, jobDescription: string): string {
  return `${userId}:${cvId}:${jobDescription}`;
}

/**
 * Retrieves the current optimization state for a CV
 */
export function getOptimizationState(userId: string, cvId: string, jobDescription: string): OptimizationState | null {
  const key = generateStateKey(userId, cvId, jobDescription);
  return optimizationStateCache.get(key) || null;
}

/**
 * Stores the current optimization state for a CV
 */
function storeOptimizationState(userId: string, cvId: string, jobDescription: string, state: OptimizationState): void {
  const key = generateStateKey(userId, cvId, jobDescription);
  optimizationStateCache.set(key, state);
  
  // Update partial results with the current progress
  const partialResults = getPartialResults(userId, cvId, jobDescription) || {
    optimizedContent: '',
    matchScore: 0,
    recommendations: [],
    progress: 0,
    state: null
  };
  
  partialResults.state = state;
  partialResults.progress = calculateProgress(state);
  storePartialResults(userId, cvId, jobDescription, partialResults);
}

/**
 * Calculates the progress percentage based on the current state
 */
function calculateProgress(state: OptimizationState): number {
  // Define weights for each stage
  const analyzeWeight = 0.3;
  const optimizeWeight = 0.5;
  const generateWeight = 0.2;
  
  let progress = 0;
  
  // Calculate analyze stage progress
  if (state.stage === OptimizationStage.ANALYZE_COMPLETED || 
      state.stage === OptimizationStage.OPTIMIZE_COMPLETED || 
      state.stage === OptimizationStage.GENERATE_COMPLETED) {
    // Analyze stage is complete
    progress += analyzeWeight;
  } else if (state.stage.startsWith('ANALYZE_')) {
    // Calculate partial progress within analyze stage
    const analyzeStages = [
      OptimizationStage.ANALYZE_STARTED,
      OptimizationStage.SKILLS_EXTRACTED,
      OptimizationStage.KEYWORDS_EXTRACTED,
      OptimizationStage.KEY_REQUIREMENTS_EXTRACTED,
      OptimizationStage.FORMAT_ANALYZED,
      OptimizationStage.CONTENT_ANALYZED,
      OptimizationStage.INDUSTRY_DETERMINED,
      OptimizationStage.LANGUAGE_DETECTED,
      OptimizationStage.SECTIONS_EXTRACTED
    ];
    
    const currentIndex = analyzeStages.indexOf(state.stage as OptimizationStage);
    if (currentIndex >= 0) {
      progress += (analyzeWeight * (currentIndex + 1) / analyzeStages.length);
    }
  }
  
  // Calculate optimize stage progress
  if (state.stage === OptimizationStage.OPTIMIZE_COMPLETED || 
      state.stage === OptimizationStage.GENERATE_COMPLETED) {
    // Optimize stage is complete
    progress += optimizeWeight;
  } else if (state.stage.startsWith('OPTIMIZE_')) {
    // Calculate partial progress within optimize stage
    const optimizeStages = [
      OptimizationStage.OPTIMIZE_STARTED,
      OptimizationStage.PROFILE_OPTIMIZED,
      OptimizationStage.EXPERIENCE_OPTIMIZED,
      OptimizationStage.SKILLS_OPTIMIZED,
      OptimizationStage.EDUCATION_OPTIMIZED
    ];
    
    const currentIndex = optimizeStages.indexOf(state.stage as OptimizationStage);
    if (currentIndex >= 0) {
      progress += analyzeWeight + (optimizeWeight * (currentIndex + 1) / optimizeStages.length);
    }
  }
  
  // Calculate generate stage progress
  if (state.stage === OptimizationStage.GENERATE_COMPLETED) {
    // Generate stage is complete
    progress += generateWeight;
  } else if (state.stage.startsWith('GENERATE_')) {
    // Calculate partial progress within generate stage
    const generateStages = [
      OptimizationStage.GENERATE_STARTED,
      OptimizationStage.GENERATE_COMPLETED
    ];
    
    const currentIndex = generateStages.indexOf(state.stage as OptimizationStage);
    if (currentIndex >= 0) {
      progress += analyzeWeight + optimizeWeight + (generateWeight * (currentIndex + 1) / generateStages.length);
    }
  }
  
  // Convert to percentage and ensure it's between 0 and 100
  return Math.min(Math.max(progress * 100, 0), 100);
}

/**
 * Initialize the optimization state
 */
export function initializeOptimizationState(
  userId: string,
  cvId: string,
  jobDescription: string
): OptimizationState {
  const timestamp = Date.now();
  
  return {
    userId,
    cvId,
    jobDescription,
    stage: OptimizationStage.NOT_STARTED,
    progress: 0,
    results: {},
    timestamp,
    lastUpdated: timestamp
  };
}

/**
 * Update the optimization stage and store partial results
 */
export function updateOptimizationStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  stage: OptimizationStage,
  results: Partial<OptimizationResults> = {}
): OptimizationState {
  // Get the current state or initialize a new one
  let state = getPartialResults(userId, cvId, jobDescription) as OptimizationState | null;
  
  if (!state) {
    state = initializeOptimizationState(userId, cvId, jobDescription);
  }
  
  // Calculate progress based on the stage
  const progress = calculateProgress(state);
  
  // Update the state
  const updatedState: OptimizationState = {
    ...state,
    stage,
    progress,
    results: {
      ...state.results,
      ...results
    },
    lastUpdated: Date.now()
  };
  
  // Store the updated state
  storePartialResults(
    userId, 
    cvId, 
    jobDescription, 
    {
      optimizedContent: updatedState.results.optimizedContent || "Optimization in progress...",
      matchScore: updatedState.results.matchScore || 0,
      recommendations: updatedState.results.recommendations || ["Optimization in progress..."],
      progress: updatedState.progress,
      state: updatedState
    }
  );
  
  logger.info(`Updated optimization stage to ${stage} with progress ${progress}% for CV ${cvId}`);
  
  return updatedState;
}

/**
 * Record an optimization error
 */
export function recordOptimizationError(
  userId: string,
  cvId: string,
  jobDescription: string,
  error: string,
  stage: OptimizationStage
): OptimizationState {
  // Get the current state or initialize a new one
  let state = getPartialResults(userId, cvId, jobDescription) as OptimizationState | null;
  
  if (!state) {
    state = initializeOptimizationState(userId, cvId, jobDescription);
  }
  
  // Update the state with the error
  const updatedState: OptimizationState = {
    ...state,
    stage: OptimizationStage.ERROR,
    error,
    lastUpdated: Date.now()
  };
  
  // Store the error
  storePartialResultsError(
    userId, 
    cvId, 
    jobDescription, 
    error
  );
  
  // Store the updated state
  storePartialResults(
    userId, 
    cvId, 
    jobDescription, 
    {
      optimizedContent: updatedState.results.optimizedContent || "Optimization encountered an error.",
      matchScore: updatedState.results.matchScore || 0,
      recommendations: updatedState.results.recommendations || [`Error: ${error}`],
      progress: updatedState.progress,
      state: updatedState,
      error
    }
  );
  
  logger.error(`Recorded optimization error for CV ${cvId}: ${error}`);
  
  return updatedState;
}

/**
 * Check if a stage has been completed
 */
export function hasCompletedStage(state: OptimizationState, stage: OptimizationStage): boolean {
  const stageIndex = Object.values(OptimizationStage).indexOf(stage);
  const currentStageIndex = Object.values(OptimizationStage).indexOf(state.stage);
  return currentStageIndex >= stageIndex;
}

/**
 * Clear the optimization state
 */
export function clearOptimizationState(
  userId: string,
  cvId: string,
  jobDescription: string
): void {
  clearPartialResults(userId, cvId, jobDescription);
  logger.info(`Cleared optimization state for CV ${cvId}`);
}

/**
 * Updates the optimization stage and returns the updated state
 */
export function updateStage(
  state: OptimizationState,
  newStage: OptimizationStage,
  additionalResults: Partial<OptimizationResults> = {}
): OptimizationState {
  // Create a copy of the state
  const updatedState: OptimizationState = {
    ...state,
    stage: newStage,
    lastUpdated: Date.now(),
    results: {
      ...state.results,
      ...additionalResults
    }
  };
  
  // Calculate progress based on the stage
  const progress = calculateProgress(updatedState);
  updatedState.progress = progress;
  
  // Store the updated state
  const key = generateStateKey(state.userId, state.cvId, state.jobDescription);
  optimizationStateCache.set(key, updatedState);
  
  return updatedState;
} 