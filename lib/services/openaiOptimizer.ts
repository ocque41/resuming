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

// OpenAI client instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add performance monitoring
interface PerformanceMetrics {
  startTime: number;
  apiCallDuration?: number;
  parsingDuration?: number;
  totalDuration?: number;
}

// Add timeout for API calls
const API_TIMEOUT_MS = 30000; // 30 seconds timeout

/**
 * Check if OpenAI is available
 */
export async function isOpenAIAvailable(): Promise<boolean> {
  try {
    // Simple model list call to check if the API is accessible
    await openai.models.list();
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
 * Analyze and optimize a CV with GPT-4o
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
  // Track performance metrics
  const metrics: PerformanceMetrics = {
    startTime: Date.now()
  };

  try {
    logger.info(`Starting lightweight CV optimization with GPT-4o (content length: ${cvText.length}, job description length: ${jobDescription.length})`);
    
    // First, check if the circuit breaker is open
    const circuitStatus = getCircuitStatus('openai');
    if (circuitStatus.isOpen) {
      logger.warn(`Circuit breaker for OpenAI is open with ${circuitStatus.failures} failures. Last failure was ${circuitStatus.timeSinceLastFailure}ms ago.`);
      // If circuit breaker is open, we'll still continue with the retry logic which will handle it
    }
    
    // Create a prompt for GPT-4o
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI client is not available');
    }

    // Create a abort controller for timeout - increasing timeout to 60 seconds
    const API_TIMEOUT_MS = 60000; // 60 seconds timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.error(`API call timed out after ${API_TIMEOUT_MS}ms`);
    }, API_TIMEOUT_MS);
    
    // Track API call start time
    const apiCallStartTime = Date.now();
    logger.info('Making OpenAI API call for CV optimization (10% progress)...');
    
    try {
      const response = await retryWithExponentialBackoff(
        async () => {
          logger.debug(`Sending request to OpenAI API with ${cvText.length} chars CV text and ${jobDescription.length} chars job description`);
          
          const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are an expert CV optimization assistant. Your task is to analyze and optimize the CV content based on the job description provided.
                
                Return a JSON object with the following format:
                {
                  "optimizedContent": "The optimized CV content",
                  "matchScore": A number between 0 and 100 representing how well the CV matches the job description
                }
                
                Focus on making the content more relevant to the job description, highlighting key skills and experiences, and improving clarity and readability.`
              },
              {
                role: 'user',
                content: `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobDescription || "Optimize this CV for general professional standards and clarity."}\n\nPlease optimize my CV for this job.`
              }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          }, {
            signal: controller.signal
          });
          
          logger.debug('Received response from OpenAI API');
          
          // Calculate API call duration
          metrics.apiCallDuration = Date.now() - apiCallStartTime;
          logger.info(`OpenAI API call completed in ${metrics.apiCallDuration}ms (50% progress)`);
          
          return completion;
        },
        { 
          service: 'openai',
          initialDelayMs: 1000,
          maxRetries: 2,
          priority: 1,
          taskId: 'cv-optimization'
        }
      );
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      // Parse the response
      const parseStartTime = Date.now();
      logger.info('Parsing optimization response (75% progress)...');
      
      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No content in response from OpenAI');
      }
      
      logger.debug(`Received raw content: ${responseContent.substring(0, 100)}...`);
      
      let jsonData;
      try {
        jsonData = JSON.parse(responseContent);
        logger.debug('Successfully parsed JSON response');
      } catch (parseError) {
        logger.error(`Error parsing JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        logger.debug(`Raw response content: ${responseContent}`);
        throw new Error(`Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      // Calculate parsing duration
      metrics.parsingDuration = Date.now() - parseStartTime;
      logger.info(`Response parsing completed in ${metrics.parsingDuration}ms (90% progress)`);
      
      // Calculate total duration
      metrics.totalDuration = Date.now() - metrics.startTime;
      
      // Validate the response contains expected fields
      if (!jsonData.optimizedContent || typeof jsonData.matchScore !== 'number') {
        logger.error(`Invalid response format from OpenAI. Missing required fields. Response: ${JSON.stringify(jsonData)}`);
        throw new Error('Invalid response format from OpenAI. Missing required fields.');
      }
      
      // Return the result with empty values for backward compatibility
      const result = {
        optimizedContent: jsonData.optimizedContent,
        matchScore: jsonData.matchScore,
        recommendations: [],
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
      
      // Log completion with performance metrics
      logger.info(`CV optimization completed in ${metrics.totalDuration}ms (API: ${metrics.apiCallDuration}ms, Parsing: ${metrics.parsingDuration}ms) (100% progress)`);
      
      return result;
    } catch (apiError) {
      // Make sure to clear the timeout in case of error
      clearTimeout(timeoutId);
      
      // Log detailed error information
      logger.error(`API call error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        logger.error('API call was aborted due to timeout');
        throw new Error(`OpenAI API call timed out after ${API_TIMEOUT_MS}ms`);
      }
      
      // Re-throw the error to be handled by the outer catch block
      throw apiError;
    }
  } catch (error) {
    // Calculate duration until error
    const durationUntilError = Date.now() - metrics.startTime;
    
    // Log the error with performance information
    logger.error(`CV optimization failed after ${durationUntilError}ms: ${error instanceof Error ? error.message : String(error)}`);
    
    // Re-throw the error
    throw error;
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