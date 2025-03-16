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
    
    // Run analyze stage with error handling
    try {
      state = await runAnalyzeStage(userId, cvId, jobDescription, cvText);
    } catch (analyzeError) {
      logger.error(`Error in analyze stage: ${analyzeError instanceof Error ? analyzeError.message : String(analyzeError)}`);
      
      // Store partial results with error
      storePartialResultsError(userId, cvId.toString(), jobDescription, 
        `Analysis failed: ${analyzeError instanceof Error ? analyzeError.message : String(analyzeError)}`);
      
      // If the error is related to Mistral, try to continue with other stages
      // This allows the process to continue even if one stage fails
      if (analyzeError instanceof Error && 
          (analyzeError.message.includes('Mistral') || 
           analyzeError.message.includes('tee is not a function'))) {
        
        logger.info(`Continuing optimization process after Mistral error in analyze stage`);
        
        // Update state to indicate analyze stage completed with errors
        state.stage = OptimizationStage.ANALYZE_COMPLETED;
        state.error = `Analysis completed with errors: ${analyzeError.message}`;
      } else {
        // For other errors, rethrow to be caught by the outer try/catch
        throw analyzeError;
      }
    }
    
    // Store partial results after analyze stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: state.progress,
      state
    });
    
    // Run optimize stage with error handling
    try {
      state = await runOptimizeStage(userId, cvId, jobDescription, cvText, state);
    } catch (optimizeError) {
      logger.error(`Error in optimize stage: ${optimizeError instanceof Error ? optimizeError.message : String(optimizeError)}`);
      
      // Store partial results with error
      storePartialResultsError(userId, cvId.toString(), jobDescription, 
        `Optimization failed: ${optimizeError instanceof Error ? optimizeError.message : String(optimizeError)}`);
      
      // If the error is related to Mistral, try to continue with other stages
      if (optimizeError instanceof Error && 
          (optimizeError.message.includes('Mistral') || 
           optimizeError.message.includes('tee is not a function'))) {
        
        logger.info(`Continuing optimization process after Mistral error in optimize stage`);
        
        // Update state to indicate optimize stage completed with errors
        state.stage = OptimizationStage.OPTIMIZE_COMPLETED;
        state.error = `Optimization completed with errors: ${optimizeError.message}`;
        
        // If we have no optimized content yet, create a simple one based on the CV text
        if (!state.results.optimizedContent) {
          state.results.optimizedContent = cvText;
          state.results.matchScore = 50; // Default middle score
          state.results.recommendations = ['Could not fully optimize due to service issues. Using original CV text.'];
        }
      } else {
        // For other errors, rethrow to be caught by the outer try/catch
        throw optimizeError;
      }
    }
    
    // Store partial results after optimize stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: state.progress,
      state
    });
    
    // Run generate stage with error handling
    const documentFormat = options.documentFormat || 'markdown';
    try {
      state = await runGenerateStage(userId, cvId, jobDescription, cvText, state, documentFormat);
    } catch (generateError) {
      logger.error(`Error in generate stage: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
      
      // Store partial results with error
      storePartialResultsError(userId, cvId.toString(), jobDescription, 
        `Document generation failed: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
      
      // If the error is related to Mistral, try to continue with a simple document
      if (generateError instanceof Error && 
          (generateError.message.includes('Mistral') || 
           generateError.message.includes('tee is not a function'))) {
        
        logger.info(`Completing optimization process after Mistral error in generate stage`);
        
        // Update state to indicate generate stage completed with errors
        state.stage = OptimizationStage.GENERATE_COMPLETED;
        state.error = `Document generation completed with errors: ${generateError.message}`;
        
        // If we have optimized content but no formatted document, use the optimized content as is
        if (state.results.optimizedContent && !state.results.formattedDocument) {
          state.results.formattedDocument = state.results.optimizedContent;
          state.results.format = documentFormat;
        }
      } else {
        // For other errors, rethrow to be caught by the outer try/catch
        throw generateError;
      }
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