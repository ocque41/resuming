import { logger } from '@/lib/logger';
import { runAnalyzeStage } from './analyzeStage';
import { runOptimizeStage } from './optimizeStage';
import { runGenerateStage } from './generateStage';
import { 
  OptimizationStage, 
  OptimizationState,
  OptimizationOptions,
  OptimizationResult,
  hasCompletedStage,
  updateStage,
  recordOptimizationError
} from './progressiveOptimization';
import { 
  clearPartialResults, 
  storePartialResults, 
  getPartialResults, 
  storePartialResultsError 
} from '@/app/utils/partialResultsCache';
import { analyzeAndOptimizeWithGPT4o } from './openaiOptimizer';
import { 
  OptimizationResults
} from './progressiveOptimization';

/**
 * Calculate progress percentage based on the current state
 */
function calculateProgress(state: OptimizationState): number {
  // Define weights for each stage
  const analyzeWeight = 30;  // 30% of total progress
  const optimizeWeight = 40; // 40% of total progress
  const generateWeight = 30; // 30% of total progress
  
  let progress = 0;
  
  // Calculate progress based on the current stage
  if (state.stage === OptimizationStage.NOT_STARTED) {
    return 0;
  } else if (state.stage === OptimizationStage.ANALYZE_COMPLETED) {
    progress = analyzeWeight;
  } else if (state.stage === OptimizationStage.OPTIMIZE_COMPLETED) {
    progress = analyzeWeight + optimizeWeight;
  } else if (state.stage === OptimizationStage.GENERATE_COMPLETED) {
    progress = 100;
  } else if (state.stage.startsWith('ANALYZE_')) {
    // Partial progress in analyze stage
    progress = (analyzeWeight / 2);
  } else if (state.stage.startsWith('OPTIMIZE_')) {
    // Analyze complete + partial progress in optimize stage
    progress = analyzeWeight + (optimizeWeight / 2);
  } else if (state.stage.startsWith('GENERATE_')) {
    // Analyze and optimize complete + partial progress in generate stage
    progress = analyzeWeight + optimizeWeight + (generateWeight / 2);
  }
  
  return progress;
}

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
  
  // Log which AI service is being used
  if (options.aiService) {
    logger.info(`Using ${options.aiService === 'auto' ? 'automatic' : options.aiService} AI service selection for CV ${cvId}`);
  }
  
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
      state = await runAnalyzeStage(userId, cvId, jobDescription, cvText, { 
        aiService: options.aiService 
      });
    } catch (analyzeError) {
      logger.warn(`Error in analyze stage: ${analyzeError instanceof Error ? analyzeError.message : String(analyzeError)}`);
      
      // If the error is related to service availability, try to continue
      if (
        analyzeError instanceof Error && (
          analyzeError.message.includes('service is not available') ||
          analyzeError.message.includes('API key') ||
          analyzeError.message.includes('Authentication failed')
        )
      ) {
        logger.info(`Continuing optimization process after service error in analyze stage`);
        
        // If we're using auto mode and got an error, switch to OpenAI for the rest of the process
        if (options.aiService === 'auto' || options.aiService === undefined) {
          logger.info(`Switching to OpenAI-only mode after service error`);
          options.aiService = 'openai';
        }
        
        // Continue with the optimize stage
        try {
          state = await runOptimizeStage(
            userId, 
            cvId, 
            jobDescription, 
            cvText, 
            state, 
            options.preserveSections || {}, 
            { aiService: options.aiService }
          );
        } catch (optimizeError) {
          logger.warn(`Error in optimize stage: ${optimizeError instanceof Error ? optimizeError.message : String(optimizeError)}`);
          
          // If the error is related to service availability, try to continue
          if (
            optimizeError instanceof Error && (
              optimizeError.message.includes('service is not available') ||
              optimizeError.message.includes('API key') ||
              optimizeError.message.includes('Authentication failed')
            )
          ) {
            logger.info(`Continuing optimization process after service error in optimize stage`);
            
            // If we're using auto mode and got an error, switch to OpenAI for the rest of the process
            if (options.aiService === undefined || (options.aiService as string) === 'auto') {
              logger.info(`Switching to OpenAI-only mode after service error`);
              options.aiService = 'openai';
            }
            
            // Continue with the generate stage
            try {
              const documentFormat = options.documentFormat || 'markdown';
              state = await runGenerateStage(
                userId, 
                cvId, 
                jobDescription, 
                cvText, 
                state, 
                documentFormat, 
                { aiService: options.aiService }
              );
            } catch (generateError) {
              logger.error(`Error in generate stage: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
              
              // Store partial results with error
              storePartialResultsError(userId, cvId.toString(), jobDescription, 
                `Document generation failed: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
              
              // Update state to indicate generate stage completed with errors
              state = updateStage(state, OptimizationStage.GENERATE_COMPLETED);
            }
          } else {
            // For other errors, rethrow
            throw optimizeError;
          }
        }
      } else {
        // For other errors, rethrow
        throw analyzeError;
      }
    }
    
    // Store partial results after analyze stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 30,
      state
    });
    
    // Run optimize stage with error handling
    try {
      state = await runOptimizeStage(
        userId, 
        cvId, 
        jobDescription, 
        cvText, 
        state, 
        options.preserveSections || {}, 
        { aiService: options.aiService }
      );
    } catch (optimizeError) {
      logger.warn(`Error in optimize stage: ${optimizeError instanceof Error ? optimizeError.message : String(optimizeError)}`);
      
      // If the error is related to service availability, try to continue
      if (
        optimizeError instanceof Error && (
          optimizeError.message.includes('service is not available') ||
          optimizeError.message.includes('API key') ||
          optimizeError.message.includes('Authentication failed')
        )
      ) {
        logger.info(`Continuing optimization process after service error in optimize stage`);
        
        // If we're using auto mode and got an error, switch to OpenAI for the rest of the process
        if (options.aiService === undefined || (options.aiService as string) === 'auto') {
          logger.info(`Switching to OpenAI-only mode after service error`);
          options.aiService = 'openai';
        }
        
        // Continue with the generate stage
        try {
          const documentFormat = options.documentFormat || 'markdown';
          state = await runGenerateStage(
            userId, 
            cvId, 
            jobDescription, 
            cvText, 
            state, 
            documentFormat, 
            { aiService: options.aiService }
          );
        } catch (generateError) {
          logger.error(`Error in generate stage: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
          
          // Store partial results with error
          storePartialResultsError(userId, cvId.toString(), jobDescription, 
            `Document generation failed: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
          
          // Update state to indicate generate stage completed with errors
          state = updateStage(state, OptimizationStage.GENERATE_COMPLETED);
        }
      } else {
        // For other errors, rethrow
        throw optimizeError;
      }
    }
    
    // Store partial results after optimize stage
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 70,
      state
    });
    
    // Run generate stage with error handling
    const documentFormat = options.documentFormat || 'markdown';
    try {
      state = await runGenerateStage(
        userId, 
        cvId, 
        jobDescription, 
        cvText, 
        state, 
        documentFormat, 
        { aiService: options.aiService }
      );
    } catch (generateError) {
      logger.error(`Error in generate stage: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
      
      // Store partial results with error
      storePartialResultsError(userId, cvId.toString(), jobDescription, 
        `Document generation failed: ${generateError instanceof Error ? generateError.message : String(generateError)}`);
      
      // Update state to indicate generate stage completed with errors
      state = updateStage(state, OptimizationStage.GENERATE_COMPLETED);
    }
    
    // Store final results
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 100,
      state
    });
    
    // Return the result
    return {
      success: true,
      message: 'CV optimization completed successfully',
      result: {
        optimizedContent: state.results.optimizedContent || '',
        matchScore: state.results.matchScore || 0,
        recommendations: state.results.recommendations || [],
        progress: 100,
        state
      }
    };
  } catch (error) {
    logger.error(`Error in progressive optimization: ${error instanceof Error ? error.message : String(error)}`);
    
    // Store error in partial results
    storePartialResultsError(userId, cvId.toString(), jobDescription, 
      error instanceof Error ? error.message : String(error));
    
    // Return error result
    return {
      success: false,
      message: `Error optimizing CV: ${error instanceof Error ? error.message : String(error)}`,
      result: {
        optimizedContent: '',
        matchScore: 0,
        recommendations: [],
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
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
      state = await runOptimizeStage(
        userId, 
        cvId, 
        jobDescription, 
        cvText, 
        state, 
        options.preserveSections || {}, 
        { aiService: options.aiService }
      );
      
      // Store partial results after optimize stage
      storePartialResults(userId, cvId.toString(), jobDescription, {
        optimizedContent: state.results.optimizedContent || '',
        matchScore: state.results.matchScore || 0,
        recommendations: state.results.recommendations || [],
        progress: 70,
        state
      });
      
      // Run generate stage
      const documentFormat = options.documentFormat || 'markdown';
      state = await runGenerateStage(
        userId, 
        cvId, 
        jobDescription, 
        cvText, 
        state, 
        documentFormat, 
        { aiService: options.aiService }
      );
    } else if (state.stage.startsWith('OPTIMIZE_') || state.stage === OptimizationStage.OPTIMIZE_COMPLETED) {
      // Resume from generate stage
      const documentFormat = options.documentFormat || 'markdown';
      state = await runGenerateStage(
        userId, 
        cvId, 
        jobDescription, 
        cvText, 
        state, 
        documentFormat, 
        { aiService: options.aiService }
      );
    }
    
    // Store final results
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: state.results.optimizedContent || '',
      matchScore: state.results.matchScore || 0,
      recommendations: state.results.recommendations || [],
      progress: 100,
      state
    });
    
    // Return the result
    return {
      success: true,
      message: 'CV optimization resumed and completed successfully',
      result: {
        optimizedContent: state.results.optimizedContent || '',
        matchScore: state.results.matchScore || 0,
        recommendations: state.results.recommendations || [],
        progress: 100,
        state
      }
    };
  } catch (error) {
    logger.error(`Error resuming optimization: ${error instanceof Error ? error.message : String(error)}`);
    
    // Store error in partial results
    storePartialResultsError(userId, cvId.toString(), jobDescription, 
      error instanceof Error ? error.message : String(error));
    
    // Return error result
    return {
      success: false,
      message: `Error resuming CV optimization: ${error instanceof Error ? error.message : String(error)}`,
      result: {
        optimizedContent: currentState.results.optimizedContent || '',
        matchScore: currentState.results.matchScore || 0,
        recommendations: currentState.results.recommendations || [],
        progress: calculateProgress(currentState),
        error: error instanceof Error ? error.message : String(error),
        state: currentState
      }
    };
  }
}

/**
 * Enhanced optimizeCV function for better progress tracking and error handling
 */
export async function optimizeCV(
  userId: string,
  cvId: string,
  input: string,
  jobDescription: string,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> {
  const startTime = Date.now();
  logger.info(`Starting CV optimization for user ${userId}, CV ${cvId} with options: ${JSON.stringify(options)}`);
  
  // Clear any previous partial results
  await clearPartialResults(userId, cvId, jobDescription);
  
  // Initialize state
  const state: OptimizationState = {
    userId,
    cvId,
    jobDescription,
    stage: OptimizationStage.NOT_STARTED,
    progress: 0,
    results: {},
    timestamp: startTime,
    lastUpdated: startTime
  };
  
  try {
    // UPDATE STAGE: NOT_STARTED -> ANALYZE_STARTED
    updateStage(state, OptimizationStage.ANALYZE_STARTED);
    logger.info(`Starting CV analysis for user ${userId}, CV ${cvId}`);
    
    try {
      const analyzeStartTime = Date.now();
      
      // Optimize with OpenAI
      const optResult = await analyzeAndOptimizeWithGPT4o(input, jobDescription);
      
      const analyzeDuration = Date.now() - analyzeStartTime;
      logger.info(`CV analysis completed in ${analyzeDuration}ms`);
      
      // Store results and update stage
      const results: Partial<OptimizationResults> = {
        optimizedContent: optResult.optimizedContent,
        matchScore: optResult.matchScore,
        recommendations: optResult.recommendations || []
      };
      
      // UPDATE STAGE: ANALYZE_STARTED -> ANALYZE_COMPLETED
      updateStage(state, OptimizationStage.ANALYZE_COMPLETED, results);
      
      // UPDATE STAGE: ANALYZE_COMPLETED -> GENERATE_STARTED
      updateStage(state, OptimizationStage.GENERATE_STARTED);
      
      // UPDATE STAGE: GENERATE_STARTED -> GENERATE_COMPLETED
      updateStage(state, OptimizationStage.GENERATE_COMPLETED);
      
      // Store partial results
      await storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: optResult.optimizedContent,
        matchScore: optResult.matchScore,
        recommendations: optResult.recommendations || [],
        progress: 100,
        state: state
      });
      
      // Calculate total duration
      const totalDuration = Date.now() - startTime;
      logger.info(`CV optimization completed successfully in ${totalDuration}ms for user ${userId}, CV ${cvId}`);
      
      // Return success result
      return {
        success: true,
        message: 'Optimization completed successfully',
        result: {
          optimizedContent: optResult.optimizedContent,
          matchScore: optResult.matchScore,
          recommendations: optResult.recommendations || [],
          progress: 100,
          state: state
        }
      };
    } catch (analyzeError) {
      const errorMessage = analyzeError instanceof Error ? analyzeError.message : String(analyzeError);
      logger.warn(`Error during analysis stage for user ${userId}, CV ${cvId}: ${errorMessage}`);
      
      // Record the error
      recordOptimizationError(userId, cvId, jobDescription, errorMessage, OptimizationStage.ANALYZE_STARTED);
      
      // Return error result with original content
      return {
        success: false,
        message: `Analysis failed: ${errorMessage}`,
        result: {
          optimizedContent: input, // Use original content
          matchScore: 0,
          recommendations: [`Error: ${errorMessage}`],
          progress: 0,
          error: errorMessage,
          state: {
            ...state,
            stage: OptimizationStage.ERROR,
            error: errorMessage,
            lastUpdated: Date.now()
          }
        }
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Unexpected error during CV optimization for user ${userId}, CV ${cvId}: ${errorMessage}`);
    
    // Record the error
    recordOptimizationError(userId, cvId, jobDescription, errorMessage, OptimizationStage.NOT_STARTED);
    
    // Return error result
    return {
      success: false,
      message: `Optimization failed: ${errorMessage}`,
      result: {
        optimizedContent: input, // Use original content
        matchScore: 0,
        recommendations: [`Error: ${errorMessage}`],
        progress: 0,
        error: errorMessage,
        state: {
          ...state,
          stage: OptimizationStage.ERROR,
          error: errorMessage,
          lastUpdated: Date.now()
        }
      }
    };
  }
} 