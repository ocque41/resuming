import { OpenAI } from 'openai';
import { logger } from '@/lib/logger';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';
import { OptimizationOptions, OptimizationResult, OptimizationStage, OptimizationState } from './progressiveOptimization';
import { storePartialResults, clearPartialResults, storePartialResultsError, getPartialResults } from '@/app/utils/partialResultsCache';

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
    
    // Update state to indicate analysis has started
    state = updateState(state, OptimizationStage.ANALYZE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 10,
      state
    });
    
    logger.info(`Starting CV optimization with OpenAI for CV ${cvId}`);
    
    // Call OpenAI to analyze and optimize the CV
    const result = await analyzeAndOptimizeWithGPT4o(cvText, jobDescription);
    
    // Update state to indicate analysis is complete
    state = updateState(state, OptimizationStage.ANALYZE_COMPLETED);
    state.results = {
      ...state.results,
      skills: result.cvAnalysis.skills.technical.concat(result.cvAnalysis.skills.professional),
      industry: result.cvAnalysis.industry || '',
      language: result.cvAnalysis.language || '',
      sections: result.cvAnalysis.sections || []
    };
    
    // Store partial results after analysis
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: cvText,
      matchScore: 0,
      recommendations: [],
      progress: 30,
      state
    });
    
    // Update state to indicate optimization has started
    state = updateState(state, OptimizationStage.OPTIMIZE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: cvText,
      matchScore: 0,
      recommendations: [],
      progress: 40,
      state
    });
    
    // Update state with optimization results
    state = updateState(state, OptimizationStage.OPTIMIZE_COMPLETED);
    state.results = {
      ...state.results,
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: result.recommendations
    };
    
    // Store partial results after optimization
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: result.recommendations,
      progress: 70,
      state
    });
    
    // Update state to indicate document generation has started
    state = updateState(state, OptimizationStage.GENERATE_STARTED);
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: result.recommendations,
      progress: 80,
      state
    });
    
    // Format the document (this is handled by the existing DOCX generation)
    state = updateState(state, OptimizationStage.GENERATE_COMPLETED);
    
    // Store final results
    storePartialResults(userId, cvId.toString(), jobDescription, {
      optimizedContent: result.optimizedContent,
      matchScore: result.matchScore,
      recommendations: result.recommendations,
      progress: 100,
      state
    });
    
    logger.info(`CV optimization completed successfully for CV ${cvId}`);
    
    // Return the final result
    return {
      success: true,
      message: "CV optimization completed successfully",
      result: {
        optimizedContent: result.optimizedContent,
        matchScore: result.matchScore,
        recommendations: result.recommendations,
        progress: 100,
        state
      }
    };
  } catch (error) {
    logger.error(`Error optimizing CV: ${error instanceof Error ? error.message : String(error)}`);
    
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
      logger.info(`Returning partial results for CV ${cvId}`);
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
  cvAnalysis: CVAnalysisResult & {
    industry?: string;
    language?: string;
    sections?: Array<{ name: string; content: string }>;
  };
}> {
  try {
    logger.info('Analyzing and optimizing CV with GPT-4o');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a CV optimization expert. Your task is to analyze and optimize the provided CV for the specific job description.
              
              First, analyze the CV to extract structured information with this format:
              {
                "experience": [{"title": string, "company": string, "dates": string, "responsibilities": string[]}],
                "education": [{"degree": string, "field": string, "institution": string, "year": string}],
                "skills": {"technical": string[], "professional": string[]},
                "achievements": string[],
                "profile": string,
                "languages": string[],
                "industry": string,
                "language": string,
                "sections": [{"name": string, "content": string}]
              }
              
              Then, optimize the CV to better match the job description.
              
              Return a JSON object with the following structure:
              {
                "optimizedContent": "The optimized CV text",
                "matchScore": 85, // A number between 0-100 indicating how well the optimized CV matches the job
                "recommendations": ["Recommendation 1", "Recommendation 2"], // List of recommendations for further improvements
                "cvAnalysis": {
                  // Include the CV analysis here with the structure defined above
                }
              }
              
              Do not include any explanations or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: `CV: ${cvText}\n\nJob Description: ${jobDescription || "General optimization for ATS compatibility"}`
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        });
      },
      { service: 'openai', maxRetries: 3, priority: 2 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content || '';
    
    // Try to parse the response as JSON
    try {
      const result = safeJsonParse(content);
      
      // Validate the structure
      if (!result.optimizedContent || typeof result.matchScore !== 'number' || !result.cvAnalysis) {
        throw new Error('Invalid response structure');
      }
      
      logger.info('CV analysis and optimization with GPT-4o completed successfully');
      return result;
    } catch (parseError) {
      logger.error('Error parsing analysis and optimization response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error(`Failed to parse analysis and optimization result: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error('Error analyzing and optimizing CV with GPT-4o:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to analyze and optimize CV: ${error instanceof Error ? error.message : String(error)}`);
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