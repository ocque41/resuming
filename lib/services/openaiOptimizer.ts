import { OpenAI } from 'openai';
import { logger } from '@/lib/logger';
import { retryWithExponentialBackoff, getCircuitStatus } from '../utils/apiRateLimiter';
import { OptimizationOptions, OptimizationResult, OptimizationStage, OptimizationState } from './progressiveOptimization';
import { storePartialResults, clearPartialResults, storePartialResultsError, getPartialResults } from '@/app/utils/partialResultsCache';
import { getOpenAIClient } from './openai.service';

// Define CV analysis result interface
export interface CVAnalysisResult {
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    responsibilities: string[];
  }>;
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    year: string;
  }>;
  skills: {
    technical: string[];
    professional: string[];
  };
  achievements: string[];
  profile: string;
  languages: string[];
  industry?: string;
  language?: string;
  sections?: Array<{ name: string; content: string }>;
}

// Error types
const ERROR_TYPES = {
  TIMEOUT: 'TIMEOUT_ERROR',
  API_ERROR: 'API_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

// Performance metrics interface for tracking timing
interface PerformanceMetrics {
  startTime: number;
  apiCallDuration?: number;
  parsingDuration?: number;
  totalDuration?: number;
}

/**
 * Check if OpenAI is available
 */
export async function isOpenAIAvailable(): Promise<boolean> {
  try {
    // Get a client instance
    const client = getOpenAIClient();
    if (!client) {
      return false;
    }
    
    // Simple model list call to check if the API is accessible
    await client.models.list();
    return true;
  } catch (error) {
    logger.error('OpenAI API is not available:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Safe JSON parsing with error handling
 */
function safeJsonParse(content: string): any {
  try {
    // Try to parse as JSON
    return JSON.parse(content);
  } catch (error) {
    // If it fails, try to extract JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error(`Failed to parse JSON: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
      }
    }
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize a CV using OpenAI's GPT-4o
 */
export async function optimizeCV(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> {
  const processStartTime = Date.now();
  logger.info(`Starting CV optimization process for CV ${cvId} (text length: ${cvText.length}, job desc length: ${jobDescription.length})`);
  
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
    logger.debug(`Cleared existing partial results for CV ${cvId}`);
    
    // Store initial state
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 0,
      state
    });
    logger.debug(`Stored initial state for CV ${cvId}, progress: 0%`);
    
    // Update state to indicate analysis has started
    state = updateState(state, OptimizationStage.ANALYZE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 10,
      state
    });
    logger.info(`Analysis stage started for CV ${cvId}, progress: 10%`);
    
    // Call OpenAI to analyze and optimize the CV
    const analyzeStartTime = Date.now();
    logger.info(`Calling lightweight GPT-4o optimization for CV ${cvId}`);
    const result = await analyzeAndOptimizeWithGPT4o(cvText, jobDescription);
    const analyzeDuration = Date.now() - analyzeStartTime;
    logger.info(`GPT-4o optimization completed in ${analyzeDuration}ms with match score: ${result.matchScore}`);
    
    // Update state to indicate analysis is complete
    state = updateState(state, OptimizationStage.ANALYZE_COMPLETED, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore
    });
    
    // Store partial results after analysis
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: cvText,
      matchScore: 0,
      recommendations: [],
      progress: 30,
      state
    });
    logger.info(`Analysis completed for CV ${cvId}, progress: 30%`);
    
    // Update state to indicate optimization has started
    state = updateState(state, OptimizationStage.OPTIMIZE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: cvText,
      matchScore: 0,
      recommendations: [],
      progress: 40,
      state
    });
    logger.info(`Optimization stage started for CV ${cvId}, progress: 40%`);
    
    // Update state with optimization results
    state = updateState(state, OptimizationStage.OPTIMIZE_COMPLETED, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore
    });
    
    // Store partial results after optimization
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: [],
      progress: 70,
      state
    });
    logger.info(`Optimization completed for CV ${cvId}, progress: 70%`);
    
    // Update state to indicate document generation has started
    state = updateState(state, OptimizationStage.GENERATE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: [],
      progress: 80,
      state
    });
    logger.info(`Document generation started for CV ${cvId}, progress: 80%`);
    
    // Format the document (this is handled by the existing DOCX generation)
    const genStartTime = Date.now();
    state = updateState(state, OptimizationStage.GENERATE_COMPLETED);
    const genDuration = Date.now() - genStartTime;
    logger.info(`Document generation step completed in ${genDuration}ms`);
    
    // Store final results
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: [],
      progress: 100,
      state
    });
    
    const totalDuration = Date.now() - processStartTime;
    logger.info(`CV optimization process completed successfully for CV ${cvId} in ${totalDuration}ms`);
    
    // Return the final result
    return {
      success: true,
      message: "CV optimization completed successfully",
      result: {
        optimizedContent: result.optimizedContent,
        matchScore: result.matchScore,
        recommendations: [],
        progress: 100,
        state
      }
    };
  } catch (error) {
    const errorTime = Date.now() - processStartTime;
    logger.error(`Error optimizing CV ${cvId} after ${errorTime}ms: ${error instanceof Error ? error.message : String(error)}`);
    
    // Store error in partial results
    storePartialResultsError(userId, cvId.toString(), jobDescription, 
      `Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Get any partial results that might be available
    const partialResults = getPartialResults(userId, cvId.toString(), jobDescription);
    
    // Update state to indicate error
    state = updateState(state, OptimizationStage.ERROR);
    state.error = error instanceof Error ? error.message : String(error);
    
    // If we have partial results, return them
    if (partialResults && partialResults.optimizedContent) {
      logger.info(`Returning partial results for CV ${cvId} with progress: ${partialResults.progress || 0}%`);
      return {
        success: false,
        message: `Optimization failed but partial results are available: ${error instanceof Error ? error.message : String(error)}`,
        result: {
          optimizedContent: partialResults.optimizedContent,
          matchScore: partialResults.matchScore || 0,
          recommendations: partialResults.recommendations || [],
          progress: partialResults.progress || 0,
          error: error instanceof Error ? error.message : String(error),
          state
        }
      };
    }
    
    // If no partial results, return error
    logger.warn(`No partial results available for CV ${cvId}, returning error state only`);
    return {
      success: false,
      message: `Optimization failed: ${error instanceof Error ? error.message : String(error)}`,
      result: {
        optimizedContent: cvText,
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
 * Analyze and optimize CV text using GPT-4o
 * This is a combined function to reduce API calls
 */
export async function analyzeAndOptimizeWithGPT4o(
  cvText: string, 
  jobDescription: string
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  cvAnalysis: {
    industry: string;
    language: string;
    sections: string[];
    skills: string[];
    strengths: string[];
    weaknesses: string[];
    missingKeywords: string[];
    formattingIssues: string[];
    structuralIssues: string[];
  };
}> {
  // Create performance metrics object
  const metrics: PerformanceMetrics = {
    startTime: Date.now()
  };

  // Log start of optimization
  logger.info(`Starting CV analysis and optimization with GPT-4o. CV length: ${cvText.length}, Job description length: ${jobDescription.length}`);

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      reject({
        type: ERROR_TYPES.TIMEOUT,
        message: 'CV optimization timed out after 30 seconds. The system may be experiencing high load or your CV may be too complex.'
      });
    }, 30000); // 30 seconds timeout
  });

  try {
    // Create a controlled promise for the API call
    const apiCallPromise = retryWithExponentialBackoff(
      async () => {
        // Prepare a simplified prompt to reduce token usage and improve speed
        const prompt = `
You are an expert CV optimizer. Analyze the following CV and job description, then return ONLY the optimized CV text and a match score.

CV:
${cvText}

Job Description:
${jobDescription}

Please return a structured JSON response with the following fields:
- optimizedContent: The optimized CV text
- matchScore: A number between 0-100 indicating how well the optimized CV matches the job
- recommendations: A short array of 3-5 key recommendations for further improvements

NO explanations or additional text. Just return valid JSON.
`;

        logger.info('Making API call to OpenAI for CV optimization');
        const client = getOpenAIClient();
        if (!client) {
          throw new Error('OpenAI client not available');
        }
        
        const completion = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are an expert CV optimizer that returns only JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        // Track API call duration
        metrics.apiCallDuration = Date.now() - metrics.startTime;
        logger.info(`OpenAI API call completed in ${metrics.apiCallDuration}ms`);

        return completion.choices[0].message.content;
      },
      {
        service: 'openai',
        initialDelayMs: 1000,
        maxDelayMs: 8000, // Reduced from 10000
        maxRetries: 2, // Reduced retries to avoid long waits
        retryStatusCodes: [429, 500, 502, 503, 504],
        priority: 10 // High priority
      }
    );

    // Race between API call and timeout
    const responseContent = await Promise.race([apiCallPromise, timeoutPromise]);
    
    // If we've reached here, we have a response before timeout
    // Parse the JSON response
    const parseStart = Date.now();
    let parsedResponse;
    
    try {
      // Check if response content exists
      if (!responseContent) {
        throw {
          type: ERROR_TYPES.PARSING_ERROR,
          message: 'Empty response from AI service'
        };
      }
      
      parsedResponse = safeJsonParse(responseContent);
      metrics.parsingDuration = Date.now() - parseStart;
      logger.info(`Parsed OpenAI response in ${metrics.parsingDuration}ms`);
    } catch (parseError) {
      logger.error('Error parsing OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
      logger.debug('Response content that failed to parse:', responseContent);
      
      throw {
        type: ERROR_TYPES.PARSING_ERROR,
        message: 'Failed to parse AI response. The system may be experiencing issues.',
        originalError: parseError
      };
    }

    // Validate response structure
    if (!parsedResponse.optimizedContent || typeof parsedResponse.matchScore !== 'number') {
      logger.error('Invalid response structure from OpenAI:', JSON.stringify(parsedResponse));
      throw {
        type: ERROR_TYPES.PARSING_ERROR,
        message: 'Received invalid response format from AI service.'
      };
    }

    // Calculate total duration
    metrics.totalDuration = Date.now() - metrics.startTime;
    logger.info(`Total CV optimization process completed in ${metrics.totalDuration}ms`);

    // Return the lightweight response
    // For backward compatibility, include empty cvAnalysis structure
    return {
      optimizedContent: parsedResponse.optimizedContent,
      matchScore: parsedResponse.matchScore,
      recommendations: parsedResponse.recommendations || [],
      cvAnalysis: {
        industry: '',
        language: '',
        sections: [],
        skills: [],
        strengths: [],
        weaknesses: [],
        missingKeywords: [],
        formattingIssues: [],
        structuralIssues: []
      }
    };
  } catch (error: any) {
    // Calculate duration until error
    const errorDuration = Date.now() - metrics.startTime;
    
    // Handle specific error types
    if (error.type === ERROR_TYPES.TIMEOUT) {
      logger.warn(`CV optimization timed out after ${errorDuration}ms`);
    } else {
      logger.error(`Error in CV optimization after ${errorDuration}ms:`, 
        error instanceof Error ? error.message : (error.message || JSON.stringify(error)));
    }

    // Prepare user-friendly error message
    let errorMessage = 'An error occurred during CV optimization.';
    let errorType = ERROR_TYPES.SYSTEM_ERROR;
    
    if (error.type === ERROR_TYPES.TIMEOUT) {
      errorMessage = 'CV optimization timed out after 30 seconds. Please try again when the system has less load or simplify your CV.';
      errorType = ERROR_TYPES.TIMEOUT;
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = 'Connection to AI service timed out. Please try again later when the system has less load.';
      errorType = ERROR_TYPES.TIMEOUT;
    } else if (error.status === 429 || error.message?.includes('rate limit')) {
      errorMessage = 'AI service is currently at capacity. Please try again in a few minutes.';
      errorType = ERROR_TYPES.API_ERROR;
    }

    throw {
      type: errorType,
      message: errorMessage,
      originalError: error
    };
  }
}

/**
 * Update the optimization state
 */
function updateState(
  state: OptimizationState,
  newStage: OptimizationStage,
  additionalResults: any = {}
): OptimizationState {
  return {
    ...state,
    stage: newStage,
    results: {
      ...state.results,
      ...additionalResults
    },
    lastUpdated: Date.now()
  };
} 