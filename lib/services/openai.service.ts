import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { CVAnalysisResult } from './mistral.service';

// Validate API key presence
const apiKey = process.env.OPENAI_API_KEY || '';
let openaiClientInitialized = false;

if (!apiKey || apiKey.trim() === '') {
  logger.error('OPENAI_API_KEY is not set in environment variables');
} else {
  logger.info('OPENAI_API_KEY is configured');
}

// Initialize OpenAI client with error handling
const getOpenAIClient = () => {
  if (!apiKey || apiKey.trim() === '') {
    logger.error('Cannot initialize OpenAI client: API key is missing');
    throw new Error('OpenAI API key is not configured');
  }
  
  try {
    const client = new OpenAI({
      apiKey: apiKey,
    });
    openaiClientInitialized = true;
    return client;
  } catch (error) {
    openaiClientInitialized = false;
    logger.error('Failed to initialize OpenAI client:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to initialize OpenAI client');
  }
};

// Validate client on startup - but don't throw errors to prevent app from crashing
try {
  if (apiKey && apiKey.trim() !== '') {
    getOpenAIClient();
    logger.info('OpenAI client initialized successfully');
  } else {
    openaiClientInitialized = false;
    logger.warn('OpenAI client not initialized due to missing API key');
  }
} catch (error) {
  openaiClientInitialized = false;
  logger.error('OpenAI client initialization failed:', error instanceof Error ? error.message : String(error));
}

// Export the initialization status for other components to check
export const isOpenAIAvailable = () => openaiClientInitialized;

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry attempt ${attempt}/${retries} after ${delay}ms delay`);
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on authentication errors
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        logger.error(`Authentication error, not retrying: ${lastError.message}`);
        throw lastError;
      }
      
      if (attempt === retries) {
        logger.error(`All ${retries} retry attempts failed: ${lastError.message}`);
        throw lastError;
      }
      
      // Log the error but continue with retry
      logger.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * 2, maxDelay) * (0.8 + Math.random() * 0.4);
    }
  }

  // This should never happen due to the throw in the loop
  throw lastError || new Error('Retry failed for unknown reason');
}

export interface OptimizedCVResult {
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
  structuredContent: {
    header: string;
    profile: string;
    achievements: string[];
    goals: string[];
    skills: string;
    languages: string;
    education: string;
  };
}

/**
 * Optimize CV content using GPT-4o based on Mistral's analysis and job description
 */
export async function optimizeCVWithGPT4o(
  cvText: string,
  jobDescription: string,
  mistralAnalysis: CVAnalysisResult
): Promise<OptimizedCVResult> {
  try {
    // Validate inputs
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      throw new Error('Invalid CV text provided');
    }
    
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length === 0) {
      throw new Error('Invalid job description provided');
    }

    // Check if OpenAI is available
    if (!openaiClientInitialized) {
      logger.error('OpenAI service is not available');
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    return await retryWithBackoff(async () => {
      const client = getOpenAIClient();
      
      logger.info('Sending CV optimization request to OpenAI GPT-4o');
      
      // Create a structured prompt with Mistral's analysis
      const mistralAnalysisJson = JSON.stringify(mistralAnalysis, null, 2);
      
      const prompt = `You are an expert CV optimizer. Your task is to optimize a CV for a specific job description.

I have a CV that has been analyzed by Mistral AI, and I need you to optimize it for a specific job.

Here is the original CV text:
"""
${cvText}
"""

Here is the job description:
"""
${jobDescription}
"""

Here is Mistral's analysis of the CV:
"""
${mistralAnalysisJson}
"""

Based on this information, please:
1. Create an optimized version of the CV that highlights relevant skills and experience for the job
2. Structure the CV into clear sections (Header, Profile, Achievements, Goals, Skills, Languages, Education)
3. Provide a match score (0-100) indicating how well the optimized CV matches the job requirements
4. Provide specific recommendations for further improvement
5. Analyze each section of the CV and provide a score and feedback

Format your response as JSON with the following structure:
{
  "optimizedContent": string, // The full optimized CV text
  "matchScore": number, // 0-100 score
  "recommendations": string[], // List of recommendations
  "sectionAnalysis": {
    "profile": { "score": number, "feedback": string },
    "skills": { "score": number, "feedback": string },
    "experience": { "score": number, "feedback": string },
    "education": { "score": number, "feedback": string },
    "achievements": { "score": number, "feedback": string }
  },
  "structuredContent": {
    "header": string,
    "profile": string,
    "achievements": string[],
    "goals": string[],
    "skills": string,
    "languages": string,
    "education": string
  }
}`;

      // Use a timeout for the API call to ensure we can retry if needed
      const response = await withTimeout(
        client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert CV optimizer that helps users optimize their CVs for specific job descriptions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        }),
        60000, // 60 second timeout
        'CV optimization with GPT-4o'
      );

      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('Empty response from OpenAI');
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty content in OpenAI response');
      }

      try {
        const result = JSON.parse(content);
        logger.info('Successfully parsed CV optimization result from OpenAI');
        return result;
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
        logger.error('Raw response content:', content);
        throw new Error('Failed to parse CV optimization result');
      }
    }, 2, 3000, 15000); // 2 retries, starting with 3s delay, max 15s delay
    
  } catch (error) {
    logger.error('Error optimizing CV with OpenAI:', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with OpenAI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with OpenAI. Please try again later.');
      } else if (error.message.includes('500')) {
        throw new Error('OpenAI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to OpenAI timed out. Please try again.');
      }
    }
    
    throw new Error('Failed to optimize CV with GPT-4o');
  }
} 