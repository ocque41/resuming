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
  timeoutTriggered?: boolean;
}

// Maximum timeout for OpenAI API calls (30 seconds)
const API_TIMEOUT_MS = 30000;

// Global timeout error message
const TIMEOUT_ERROR_MESSAGE = "The optimization process timed out after 30 seconds. The CV might be too complex or the system is under heavy load. Please try again later or simplify your CV.";

/**
 * Check if OpenAI is available
 */
export async function isOpenAIAvailable(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    return !!client;
  } catch (error) {
    logger.error('Error checking OpenAI availability:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Safe JSON parsing with error handling
 */
function safeJsonParse(content: string): any {
  try {
    return JSON.parse(content);
  } catch (error) {
    logger.error('Error parsing JSON:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
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
  const startTime = Date.now();
  const overallTimeout = setTimeout(() => {
    logger.error(`CV optimization timed out after ${API_TIMEOUT_MS}ms for CV ${cvId}`);
    storePartialResultsError(
      userId, 
      cvId, 
      jobDescription, 
      TIMEOUT_ERROR_MESSAGE
    );
  }, API_TIMEOUT_MS);

  try {
    logger.info(`Starting CV optimization process for CV ${cvId} (text length: ${cvText.length}, job desc length: ${jobDescription.length})`);
    
    // Clear any previous partial results
    try {
      await clearPartialResults(userId, cvId, jobDescription);
      logger.debug(`Cleared existing partial results for CV ${cvId}`);
    } catch (clearError) {
      logger.warn(`Error clearing partial results: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
      // Continue anyway - not fatal
    }
    
    // Store initial partial results to indicate we've started
    const initialProgress = {
      optimizedContent: "",
      matchScore: 0,
      recommendations: [],
      progress: 0,
      state: null
    };
    
    await storePartialResults(userId, cvId, jobDescription, initialProgress);
    logger.debug(`Stored new partial results for ${userId}:${cvId}:${jobDescription.substring(0, 10)}..., progress: 0%`);
    
    // Update progress to indicate we're starting the analysis
    const analysisStartProgress = {
      ...initialProgress,
      progress: 10
    };
    
    await storePartialResults(userId, cvId, jobDescription, analysisStartProgress);
    logger.debug(`Updated partial results for ${userId}:${cvId}:${jobDescription.substring(0, 10)}..., progress: 10%`);
    logger.info(`Analysis stage started for CV ${cvId}, progress: 10%`);
    
    // Use simplified process - go straight to GPT-4o for all processing
    logger.info(`Calling lightweight GPT-4o optimization for CV ${cvId}`);
    
    // Call GPT-4o to analyze and optimize in one step
    let result;
    try {
      // Create a promise that will be rejected after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(TIMEOUT_ERROR_MESSAGE));
        }, API_TIMEOUT_MS);
      });
      
      // Race the API call against the timeout
      result = await Promise.race([
        analyzeAndOptimizeWithGPT4o(cvText, jobDescription),
        timeoutPromise
      ]);
      
      logger.info(`Successfully completed GPT-4o analysis and optimization for CV ${cvId}`);
    } catch (optimizeError) {
      logger.error(`Error in GPT-4o optimization: ${optimizeError instanceof Error ? optimizeError.message : String(optimizeError)}`);
      
      // Store error in partial results
      const errorMessage = optimizeError instanceof Error ? optimizeError.message : String(optimizeError);
      await storePartialResultsError(userId, cvId, jobDescription, errorMessage);
      
      // Check if this was a timeout error
      if (errorMessage.includes('timed out') || errorMessage === TIMEOUT_ERROR_MESSAGE) {
        logger.warn(`Timeout occurred during optimization of CV ${cvId}`);
        
        return {
          success: false,
          message: TIMEOUT_ERROR_MESSAGE,
          result: {
            optimizedContent: "",
            matchScore: 0,
            recommendations: [],
            progress: 10, // Keep progress at analysis stage
            error: TIMEOUT_ERROR_MESSAGE,
            state: {
              userId,
              cvId,
              jobDescription,
              stage: OptimizationStage.ERROR,
              progress: 10,
              error: TIMEOUT_ERROR_MESSAGE,
              results: {},
              timestamp: Date.now(),
              lastUpdated: Date.now()
            }
          }
        };
      }
      
      // For other errors, still provide a useful error message
      return {
        success: false,
        message: `Failed to optimize CV: ${errorMessage}`,
        result: {
          optimizedContent: "",
          matchScore: 0,
          recommendations: [],
          progress: 10,
          error: errorMessage,
          state: {
            userId,
            cvId, 
            jobDescription,
            stage: OptimizationStage.ERROR,
            progress: 10,
            error: errorMessage,
            results: {},
            timestamp: Date.now(),
            lastUpdated: Date.now()
          }
        }
      };
    }
    
    // Update progress to indicate we're done with analysis
    const optimizationProgress = {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: result.recommendations,
      progress: 90,
      state: null
    };
    
    await storePartialResults(userId, cvId, jobDescription, optimizationProgress);
    logger.debug(`Updated partial results for ${userId}:${cvId}:${jobDescription.substring(0, 10)}..., progress: 90%`);
    
    // Update progress to indicate we're done
    const finalProgress = {
      ...optimizationProgress,
      progress: 100
    };
    
    await storePartialResults(userId, cvId, jobDescription, finalProgress);
    logger.debug(`Updated partial results for ${userId}:${cvId}:${jobDescription.substring(0, 10)}..., progress: 100%`);
    logger.info(`Optimization process completed for CV ${cvId} in ${Date.now() - startTime}ms`);
    
    // Return successful result
    return {
      success: true,
      message: "CV optimized successfully",
      result: {
        optimizedContent: result.optimizedContent,
        matchScore: result.matchScore,
        recommendations: result.recommendations,
        progress: 100,
        state: {
          userId,
          cvId,
          jobDescription,
          stage: OptimizationStage.OPTIMIZE_COMPLETED,
          progress: 100,
          results: {
            optimizedContent: result.optimizedContent,
            matchScore: result.matchScore,
            recommendations: result.recommendations
          },
          timestamp: startTime,
          lastUpdated: Date.now()
        }
      }
    };
  } catch (error) {
    // Log and handle any unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Unexpected error in CV optimization process: ${errorMessage}`);
    
    // Store error in partial results
    await storePartialResultsError(userId, cvId, jobDescription, errorMessage);
    
    return {
      success: false,
      message: `Failed to optimize CV: ${errorMessage}`,
      result: {
        optimizedContent: "",
        matchScore: 0,
        recommendations: [],
        progress: 10,
        error: errorMessage,
        state: {
          userId,
          cvId,
          jobDescription,
          stage: OptimizationStage.ERROR,
          progress: 10,
          error: errorMessage,
          results: {},
          timestamp: startTime,
          lastUpdated: Date.now()
        }
      }
    };
  } finally {
    clearTimeout(overallTimeout);
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
  // Track performance metrics
  const metrics: PerformanceMetrics = {
    startTime: Date.now()
  };

  try {
    logger.info(`Starting CV analysis and optimization with GPT-4o. CV length: ${cvText.length}, Job description length: ${jobDescription.length}`);
    
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI client is not available');
    }
    
    // Create a simplified system prompt to focus on optimization only
    const systemPrompt = `
You are an expert CV optimizer. Your task is to optimize the provided CV for the specific job description.
Focus on producing the optimized CV content and match score only.

Return ONLY a JSON object with the following structure:
{
  "optimizedContent": "The full optimized CV content",
  "matchScore": 85 // A number between 0-100 representing how well the optimized CV matches the job
}
`;
    
    // Create user prompt with CV and job description
    const userPrompt = `
CV:
${cvText}

Job Description:
${jobDescription}

Analyze the CV in relation to the job description and optimize it to increase the match score.
Do NOT include any explanations or additional text in your response - ONLY return a valid JSON object.
`;

    // Create a promise that will be rejected after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        metrics.timeoutTriggered = true;
        reject(new Error(TIMEOUT_ERROR_MESSAGE));
      }, API_TIMEOUT_MS);
    });
    
    // Log that we're about to make the API call
    logger.info(`Making OpenAI API call for CV optimization. Timeout set to ${API_TIMEOUT_MS}ms`);
    
    // Use the retry mechanism with exponential backoff
    const apiCallStartTime = Date.now();
    const chatCompletionPromise = retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2, // Low temperature for focused output
          response_format: { type: 'json_object' }
        });
      },
      { 
        service: 'openai',
        initialDelayMs: 1000,
        maxDelayMs: 10000, 
        maxRetries: 2, // Reduced number of retries to avoid long waits
        retryStatusCodes: [429, 500, 502, 503, 504],
        taskId: `optimize_cv_${Date.now()}` 
      }
    );
    
    // Race the API call against the timeout
    const response = await Promise.race([
      chatCompletionPromise,
      timeoutPromise
    ]);
    
    // Record API call duration
    metrics.apiCallDuration = Date.now() - apiCallStartTime;
    logger.info(`OpenAI API call completed in ${metrics.apiCallDuration}ms`);
    
    // Get the content from the response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty or invalid response from OpenAI');
    }
    
    // Parse the JSON response
    const jsonParseStartTime = Date.now();
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(content);
      metrics.parsingDuration = Date.now() - jsonParseStartTime;
    } catch (parseError) {
      logger.error(`Error parsing JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      logger.error(`Raw response content: ${content.substring(0, 200)}...`);
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    // Validate that the parsed response has the expected format
    if (!parsedResponse.optimizedContent || typeof parsedResponse.matchScore !== 'number') {
      logger.error(`Invalid response format: ${JSON.stringify(parsedResponse).substring(0, 200)}...`);
      throw new Error('Invalid response format from OpenAI: missing required fields');
    }

    // Calculate total duration
    metrics.totalDuration = Date.now() - metrics.startTime;
    logger.info(`CV optimization completed in ${metrics.totalDuration}ms. API: ${metrics.apiCallDuration}ms, JSON parsing: ${metrics.parsingDuration}ms`);
    
    // Return the optimized content and match score, with empty values for other fields
    // This maintains backward compatibility with the API contract
    return {
      optimizedContent: parsedResponse.optimizedContent,
      matchScore: parsedResponse.matchScore,
      recommendations: [], // Empty array for recommendations
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
  } catch (error) {
    // Calculate how long it took before the error
    const errorTime = Date.now() - metrics.startTime;
    
    // Check if this was a timeout error
    if (metrics.timeoutTriggered || (error instanceof Error && error.message === TIMEOUT_ERROR_MESSAGE)) {
      logger.error(`OpenAI API call timed out after ${errorTime}ms`);
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }
    
    logger.error(`Error in analyzeAndOptimizeWithGPT4o after ${errorTime}ms: ${error instanceof Error ? error.message : String(error)}`);
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