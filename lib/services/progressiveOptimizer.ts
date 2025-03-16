import { logger } from '@/lib/logger';
import { storePartialResults, storePartialResultsError, clearPartialResults } from '@/app/utils/partialResultsCache';
import { OptimizationStage, OptimizationState, OptimizationResult, OptimizationOptions } from './progressiveOptimization';
import { runAnalyzeStage } from './analyzeStage';
import { runOptimizeStage } from './optimizeStage';
import { runGenerateStage } from './generateStage';

/**
 * Optimizes a CV progressively, breaking the process into stages
 */
export async function optimizeCVProgressively(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> {
  // Initialize state
  let state: OptimizationState = {
    userId,
    cvId,
    jobDescription,
    stage: OptimizationStage.NOT_STARTED,
    progress: 0,
    results: {},
    timestamp: Date.now(),
    lastUpdated: Date.now()
  };
  
  try {
    // Clear any existing partial results
    clearPartialResults(userId, cvId.toString(), jobDescription);
    
    // Store initial state
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 0,
      state
    });
    
    // Run analyze stage
    state = await runAnalyzeStage(userId, cvId, jobDescription, cvText);
    
    // Store partial results after analyze stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: state.progress,
      state
    });
    
    // Run optimize stage
    state = await runOptimizeStage(userId, cvId, jobDescription, cvText, state);
    
    // Store partial results after optimize stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: state.progress,
      state
    });
    
    // Run generate stage
    const documentFormat = options.documentFormat || 'markdown';
    state = await runGenerateStage(userId, cvId, jobDescription, cvText, state, documentFormat);
    
    // Store final results
    const finalResults = {
      optimizedContent: state.results.formattedDocument || state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 100,
      state
    };
    
    storePartialResults(userId, cvId.toString(), jobDescription, finalResults);
    
    // Return the final result
    return {
      success: true,
      message: 'CV optimization completed successfully',
      result: finalResults
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error optimizing CV ${cvId}: ${errorMessage}`);
    
    // Store error in partial results
    storePartialResultsError(userId, cvId.toString(), jobDescription, errorMessage);
    
    // Return error result
    return {
      success: false,
      message: `CV optimization failed: ${errorMessage}`,
      result: {
        optimizedContent: state.results.optimizedContent || '',
        matchScore: state.results.matchScore || 0,
        recommendations: state.results.recommendations || [],
        progress: state.progress,
        error: errorMessage,
        state
      }
    };
  }
}

/**
 * Resumes optimization from a specific stage
 */
export async function resumeOptimization(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> {
  try {
    let state = currentState;
    
    // Determine which stage to resume from
    if (state.stage.startsWith('ANALYZE_') || state.stage === OptimizationStage.ANALYZE_COMPLETED) {
      // Resume from optimize stage
      state = await runOptimizeStage(userId, cvId, jobDescription, cvText, state);
      
      // Store partial results after optimize stage
      storePartialResults(userId, cvId.toString(), jobDescription, {
        optimizedContent: state.results.optimizedContent || '',
        matchScore: state.results.matchScore || 0,
        recommendations: state.results.recommendations || [],
        progress: state.progress,
        state
      });
      
      // Run generate stage
      const documentFormat = options.documentFormat || 'markdown';
      state = await runGenerateStage(userId, cvId, jobDescription, cvText, state, documentFormat);
    } else if (state.stage.startsWith('OPTIMIZE_') || state.stage === OptimizationStage.OPTIMIZE_COMPLETED) {
      // Resume from generate stage
      const documentFormat = options.documentFormat || 'markdown';
      state = await runGenerateStage(userId, cvId, jobDescription, cvText, state, documentFormat);
    }
    
    // Store final results
    const finalResults = {
      optimizedContent: state.results.formattedDocument || state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 100,
      state
    };
    
    storePartialResults(userId, cvId.toString(), jobDescription, finalResults);
    
    // Return the final result
    return {
      success: true,
      message: 'CV optimization resumed and completed successfully',
      result: finalResults
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error resuming CV optimization for ${cvId}: ${errorMessage}`);
    
    // Store error in partial results
    storePartialResultsError(userId, cvId.toString(), jobDescription, errorMessage);
    
    // Return error result
    return {
      success: false,
      message: `CV optimization resume failed: ${errorMessage}`,
      result: {
        optimizedContent: currentState.results.optimizedContent || '',
        matchScore: currentState.results.matchScore || 0,
        recommendations: currentState.results.recommendations || [],
        progress: currentState.progress,
        error: errorMessage,
        state: currentState
      }
    };
  }
} 