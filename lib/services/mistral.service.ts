import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';

// Validate API key presence
const apiKey = process.env.MISTRAL_API_KEY || '';
let mistralClientInitialized = false;

if (!apiKey || apiKey.trim() === '') {
  logger.error('MISTRAL_API_KEY is not set in environment variables');
} else {
  logger.info('MISTRAL_API_KEY is configured');
}

// Initialize Mistral client with better error handling
const getMistralClient = () => {
  if (!apiKey || apiKey.trim() === '') {
    logger.error('Cannot initialize Mistral client: API key is missing');
    throw new Error('Mistral API key is not configured');
  }
  
  try {
    const client = new MistralClient(apiKey);
    mistralClientInitialized = true;
    return client;
  } catch (error) {
    mistralClientInitialized = false;
    logger.error('Failed to initialize Mistral client:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to initialize Mistral AI client');
  }
};

// Validate client on startup - but don't throw errors to prevent app from crashing
try {
  if (apiKey && apiKey.trim() !== '') {
    getMistralClient();
    logger.info('Mistral AI client initialized successfully');
  } else {
    mistralClientInitialized = false;
    logger.warn('Mistral AI client not initialized due to missing API key');
  }
} catch (error) {
  mistralClientInitialized = false;
  logger.error('Mistral AI client initialization failed:', error instanceof Error ? error.message : String(error));
}

// Export the initialization status for other components to check
export const isMistralAvailable = () => mistralClientInitialized;

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

// Helper function to extract JSON from markdown code blocks
function extractJsonFromMarkdown(content: string): string {
  try {
    // Check if the content is wrapped in a markdown code block
    const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/;
    const match = content.match(jsonBlockRegex);
    
    if (match && match[1]) {
      logger.info('Extracted JSON from markdown code block');
      return match[1].trim();
    }
    
    // If no code block is found, return the original content
    return content;
  } catch (error) {
    logger.warn('Error extracting JSON from markdown:', error instanceof Error ? error.message : String(error));
    return content;
  }
}

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
}

export async function analyzeCVContent(cvText: string): Promise<CVAnalysisResult> {
  try {
    // Validate input
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      throw new Error('Invalid CV text provided');
    }

    // Check if Mistral is available
    if (!mistralClientInitialized) {
      logger.error('Mistral AI service is not available');
      throw new Error('Mistral AI service is not available. Please check your API key configuration.');
    }

    // Check API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Mistral API key is not configured');
    }

    return await retryWithBackoff(async () => {
      const client = getMistralClient();
      
      const prompt = `Analyze the following CV and extract structured information. Format the response as JSON with the following structure:
      {
        "experience": [{"title": string, "company": string, "dates": string, "responsibilities": string[]}],
        "education": [{"degree": string, "field": string, "institution": string, "year": string}],
        "skills": {"technical": string[], "professional": string[]},
        "achievements": string[],
        "profile": string
      }

      CV Text:
      ${cvText}`;

      logger.info('Sending CV analysis request to Mistral AI');
      
      // Use a shorter timeout for the API call to ensure we can retry if needed
      const response = await withTimeout(
        client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          maxTokens: 2000
        }),
        30000, // 30 second timeout
        'CV analysis'
      );

      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('Empty response from Mistral AI');
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty content in Mistral AI response');
      }

      try {
        // Extract JSON from markdown if needed
        const jsonContent = extractJsonFromMarkdown(content);
        const result = JSON.parse(jsonContent);
        logger.info('Successfully parsed CV analysis result from Mistral AI');
        return result;
      } catch (parseError) {
        logger.error('Failed to parse Mistral AI response:', parseError instanceof Error ? parseError.message : String(parseError));
        throw new Error('Failed to parse CV analysis result');
      }
    }, 3, 2000, 10000); // 3 retries, starting with 2s delay, max 10s delay
    
  } catch (error) {
    logger.error('Error analyzing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with Mistral AI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with Mistral AI. Please try again later.');
      } else if (error.message.includes('500')) {
        throw new Error('Mistral AI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to Mistral AI timed out. Please try again.');
      }
    }
    
    throw new Error('Failed to analyze CV content');
  }
}

export async function optimizeCVForJob(cvText: string, jobDescription: string): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  try {
    // Validate inputs
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      throw new Error('Invalid CV text provided');
    }
    
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length === 0) {
      throw new Error('Invalid job description provided');
    }

    // Check if Mistral is available
    if (!mistralClientInitialized) {
      logger.error('Mistral AI service is not available');
      throw new Error('Mistral AI service is not available. Please check your API key configuration.');
    }

    // Check API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Mistral API key is not configured');
    }

    return await retryWithBackoff(async () => {
      const client = getMistralClient();
      
      const prompt = `Optimize the following CV for the given job description. Provide:
      1. Optimized CV content with relevant keywords and phrases
      2. Match score (0-100)
      3. List of recommendations for improvement

      CV Text:
      ${cvText}

      Job Description:
      ${jobDescription}

      Format the response as JSON with the following structure:
      {
        "optimizedContent": string,
        "matchScore": number,
        "recommendations": string[]
      }`;

      logger.info('Sending CV optimization request to Mistral AI');
      
      // Use a shorter timeout for the API call to ensure we can retry if needed
      const response = await withTimeout(
        client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          maxTokens: 3000
        }),
        30000, // 30 second timeout
        'CV optimization'
      );

      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('Empty response from Mistral AI');
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty content in Mistral AI response');
      }

      try {
        // Extract JSON from markdown if needed
        const jsonContent = extractJsonFromMarkdown(content);
        const result = JSON.parse(jsonContent);
        logger.info('Successfully parsed CV optimization result from Mistral AI');
        return result;
      } catch (parseError) {
        logger.error('Failed to parse Mistral AI response:', parseError instanceof Error ? parseError.message : String(parseError));
        throw new Error('Failed to parse CV optimization result');
      }
    }, 3, 2000, 10000); // 3 retries, starting with 2s delay, max 10s delay
    
  } catch (error) {
    logger.error('Error optimizing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with Mistral AI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with Mistral AI. Please try again later.');
      } else if (error.message.includes('500')) {
        throw new Error('Mistral AI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to Mistral AI timed out. Please try again.');
      }
    }
    
    throw new Error('Failed to optimize CV for job');
  }
} 