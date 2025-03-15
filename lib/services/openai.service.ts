import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { CVAnalysisResult } from './mistral.service';
import { 
  cacheCVOptimization, 
  getCachedCVOptimization, 
  cacheCombinedResult, 
  getCachedCombinedResult 
} from './cache.service';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if OpenAI API key is configured
const apiKey = process.env.OPENAI_API_KEY || '';
let openaiClientInitialized = false;

if (!apiKey || apiKey.trim() === '') {
  logger.error('OPENAI_API_KEY is not set in environment variables');
} else {
  logger.info('OPENAI_API_KEY is configured');
  openaiClientInitialized = true;
}

// Export the initialization status for other components to check
export const isOpenAIAvailable = () => openaiClientInitialized;

// Enhanced JSON parsing function with better error handling
function safeJsonParse(content: string): any {
  try {
    // First, try direct parsing
    return JSON.parse(content);
  } catch (parseError) {
    // If direct parsing fails, try to extract JSON from the content
    try {
      // Check if the content contains a JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON object found, throw the original error
      throw parseError;
    } catch (extractError) {
      // Log both errors for debugging
      logger.error('Failed to parse JSON response:', 
        parseError instanceof Error ? parseError.message : String(parseError));
      logger.error('Failed to extract JSON from response:', 
        extractError instanceof Error ? extractError.message : String(extractError));
      
      // Include part of the content in the error message for debugging
      const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      throw new Error(`Failed to parse OpenAI response as JSON. Response starts with: ${contentPreview}`);
    }
  }
}

// Improved timeout wrapper with better error handling
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms. This may indicate that the request is too complex or the server is overloaded.`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        
        // Enhance error message with more context
        if (error instanceof Error) {
          // Check for common OpenAI error patterns
          if (error.message.includes('429')) {
            reject(new Error(`${operationName} failed: Rate limit exceeded. Please try again later.`));
          } else if (error.message.includes('401')) {
            reject(new Error(`${operationName} failed: Authentication error. Please check your API key.`));
          } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
            reject(new Error(`${operationName} failed: OpenAI service is currently experiencing issues. Please try again later.`));
          } else {
            reject(new Error(`${operationName} failed: ${error.message}`));
          }
        } else {
          reject(new Error(`${operationName} failed: ${String(error)}`));
        }
      });
  });
}

/**
 * Optimize a CV for a specific job using GPT-4o based on Mistral's analysis
 */
export async function optimizeCVWithGPT4o(
  cvText: string, 
  jobDescription: string, 
  mistralAnalysis: CVAnalysisResult
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  matchAnalysis: {
    score: number;
    matchedKeywords: Array<{ keyword: string; relevance: number; frequency: number; placement: string }>;
    missingKeywords: Array<{ keyword: string; importance: number; suggestedPlacement: string }>;
    recommendations: string[];
    skillGap: string;
    dimensionalScores: {
      skillsMatch: number;
      experienceMatch: number;
      educationMatch: number;
      industryFit: number;
      overallCompatibility: number;
      keywordDensity: number;
      formatCompatibility: number;
      contentRelevance: number;
    };
    detailedAnalysis: string;
    improvementPotential: number;
    sectionAnalysis: {
      profile: { score: number; feedback: string };
      skills: { score: number; feedback: string };
      experience: { score: number; feedback: string };
      education: { score: number; feedback: string };
      achievements: { score: number; feedback: string };
    };
  };
}> {
  try {
    // Validate inputs
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      throw new Error('Invalid CV text provided');
    }
    
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length === 0) {
      throw new Error('Invalid job description provided');
    }

    if (!mistralAnalysis) {
      throw new Error('Mistral analysis is required');
    }

    // Check if OpenAI is available
    if (!openaiClientInitialized) {
      logger.error('OpenAI service is not available');
      throw new Error('OpenAI service is not available. Please check your API key configuration.');
    }

    // Check API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is not configured');
    }

    // Check cache first
    const cachedResult = getCachedCombinedResult(cvText, jobDescription);
    if (cachedResult) {
      logger.info('Using cached CV optimization result from OpenAI');
      return cachedResult;
    }

    logger.info('No cached optimization found, requesting from OpenAI');

    const client = new OpenAI({ apiKey });
    
    const prompt = `Optimize the following CV for the given job description. 

IMPORTANT: You MUST preserve the existing EDUCATION, EXPERIENCE, and LANGUAGES sections exactly as they appear in the original CV. Do not remove or modify these sections - only enhance other sections.

Use the provided CV analysis to understand the candidate's background and tailor the optimization accordingly.

Provide:
1. Optimized CV content with relevant keywords and phrases
2. Match score (0-100)
3. List of recommendations for improvement
4. Detailed job match analysis

CV Text:
${cvText}

Job Description:
${jobDescription}

CV Analysis:
${JSON.stringify(mistralAnalysis, null, 2)}

Format the response as JSON with the following structure:
{
  "optimizedContent": string, // The optimized CV text with EDUCATION, EXPERIENCE, and LANGUAGES sections preserved
  "matchScore": number,
  "recommendations": string[],
  "matchAnalysis": {
    "score": number,
    "matchedKeywords": [{"keyword": string, "relevance": number, "frequency": number, "placement": string}],
    "missingKeywords": [{"keyword": string, "importance": number, "suggestedPlacement": string}],
    "recommendations": string[],
    "skillGap": string,
    "dimensionalScores": {
      "skillsMatch": number,
      "experienceMatch": number,
      "educationMatch": number,
      "industryFit": number,
      "overallCompatibility": number,
      "keywordDensity": number,
      "formatCompatibility": number,
      "contentRelevance": number
    },
    "detailedAnalysis": string,
    "improvementPotential": number,
    "sectionAnalysis": {
      "profile": {"score": number, "feedback": string},
      "skills": {"score": number, "feedback": string},
      "experience": {"score": number, "feedback": string},
      "education": {"score": number, "feedback": string},
      "achievements": {"score": number, "feedback": string}
    }
  }
}`;

    logger.info('Sending CV optimization request to OpenAI');
    
    // Increase timeout for complex CV optimization
    const response = await withTimeout(
      client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
      120000, // Increase to 120 second timeout for complex CVs
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
      // Use the enhanced JSON parsing function
      const result = safeJsonParse(content);
      logger.info('Successfully parsed CV optimization result from OpenAI');
      
      // Validate the result structure
      if (!result.optimizedContent) {
        throw new Error('Missing optimizedContent in OpenAI response');
      }
      
      // Cache the result
      cacheCombinedResult(cvText, jobDescription, result);
      
      return result;
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
      // Include part of the content in the error for debugging
      const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      throw new Error(`Failed to parse CV optimization result. Response starts with: ${contentPreview}`);
    }
  } catch (error) {
    logger.error('Error optimizing CV with OpenAI:', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with OpenAI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with OpenAI. Please try again later.');
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
        throw new Error('OpenAI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to OpenAI timed out. The CV may be too complex or the service is overloaded. Please try again with a shorter CV.');
      }
    }
    
    throw new Error('Failed to optimize CV with OpenAI: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Fallback function to optimize a CV for a specific job using GPT-4o without Mistral's analysis
 */
export async function optimizeCVWithGPT4oFallback(
  cvText: string, 
  jobDescription: string
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  matchAnalysis: {
    score: number;
    matchedKeywords: Array<{ keyword: string; relevance: number; frequency: number; placement: string }>;
    missingKeywords: Array<{ keyword: string; importance: number; suggestedPlacement: string }>;
    recommendations: string[];
    skillGap: string;
    dimensionalScores: {
      skillsMatch: number;
      experienceMatch: number;
      educationMatch: number;
      industryFit: number;
      overallCompatibility: number;
      keywordDensity: number;
      formatCompatibility: number;
      contentRelevance: number;
    };
    detailedAnalysis: string;
    improvementPotential: number;
    sectionAnalysis: {
      profile: { score: number; feedback: string };
      skills: { score: number; feedback: string };
      experience: { score: number; feedback: string };
      education: { score: number; feedback: string };
      achievements: { score: number; feedback: string };
    };
  };
}> {
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

    // Check API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is not configured');
    }

    // Check cache first
    const cachedResult = getCachedCombinedResult(cvText, jobDescription);
    if (cachedResult) {
      logger.info('Using cached CV optimization result from OpenAI');
      return cachedResult;
    }

    logger.info('No cached optimization found, requesting from OpenAI');

    const client = new OpenAI({ apiKey });
    
    const prompt = `Optimize the following CV for the given job description. 

IMPORTANT: You MUST preserve the existing EDUCATION, EXPERIENCE, and LANGUAGES sections exactly as they appear in the original CV. Do not remove or modify these sections - only enhance other sections.

Provide:
1. Optimized CV content with relevant keywords and phrases
2. Match score (0-100)
3. List of recommendations for improvement
4. Detailed job match analysis

CV Text:
${cvText}

Job Description:
${jobDescription}

Format the response as JSON with the following structure:
{
  "optimizedContent": string, // The optimized CV text with EDUCATION, EXPERIENCE, and LANGUAGES sections preserved
  "matchScore": number,
  "recommendations": string[],
  "matchAnalysis": {
    "score": number,
    "matchedKeywords": [{"keyword": string, "relevance": number, "frequency": number, "placement": string}],
    "missingKeywords": [{"keyword": string, "importance": number, "suggestedPlacement": string}],
    "recommendations": string[],
    "skillGap": string,
    "dimensionalScores": {
      "skillsMatch": number,
      "experienceMatch": number,
      "educationMatch": number,
      "industryFit": number,
      "overallCompatibility": number,
      "keywordDensity": number,
      "formatCompatibility": number,
      "contentRelevance": number
    },
    "detailedAnalysis": string,
    "improvementPotential": number,
    "sectionAnalysis": {
      "profile": {"score": number, "feedback": string},
      "skills": {"score": number, "feedback": string},
      "experience": {"score": number, "feedback": string},
      "education": {"score": number, "feedback": string},
      "achievements": {"score": number, "feedback": string}
    }
  }
}`;

    logger.info('Sending CV optimization request to OpenAI (fallback method)');
    
    // Increase timeout for complex CV optimization
    const response = await withTimeout(
      client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
      120000, // Increase to 120 second timeout for complex CVs
      'CV optimization with GPT-4o (fallback)'
    );

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('Empty response from OpenAI');
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content in OpenAI response');
    }

    try {
      // Use the enhanced JSON parsing function
      const result = safeJsonParse(content);
      logger.info('Successfully parsed CV optimization result from OpenAI');
      
      // Validate the result structure
      if (!result.optimizedContent) {
        throw new Error('Missing optimizedContent in OpenAI response');
      }
      
      // Cache the result
      cacheCombinedResult(cvText, jobDescription, result);
      
      return result;
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
      // Include part of the content in the error for debugging
      const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      throw new Error(`Failed to parse CV optimization result. Response starts with: ${contentPreview}`);
    }
  } catch (error) {
    logger.error('Error optimizing CV with OpenAI (fallback):', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with OpenAI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with OpenAI. Please try again later.');
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
        throw new Error('OpenAI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to OpenAI timed out. The CV may be too complex or the service is overloaded. Please try again with a shorter CV.');
      }
    }
    
    throw new Error('Failed to optimize CV with OpenAI (fallback): ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Combined function to analyze and optimize a CV in a single API call
 * This is more efficient when Mistral is unavailable as it reduces the number of API calls
 */
export async function analyzeAndOptimizeCVWithGPT4o(
  cvText: string, 
  jobDescription: string
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
  matchAnalysis: {
    score: number;
    matchedKeywords: Array<{ keyword: string; relevance: number; frequency: number; placement: string }>;
    missingKeywords: Array<{ keyword: string; importance: number; suggestedPlacement: string }>;
    recommendations: string[];
    skillGap: string;
    dimensionalScores: {
      skillsMatch: number;
      experienceMatch: number;
      educationMatch: number;
      industryFit: number;
      overallCompatibility: number;
      keywordDensity: number;
      formatCompatibility: number;
      contentRelevance: number;
    };
    detailedAnalysis: string;
    improvementPotential: number;
    sectionAnalysis: {
      profile: { score: number; feedback: string };
      skills: { score: number; feedback: string };
      experience: { score: number; feedback: string };
      education: { score: number; feedback: string };
      achievements: { score: number; feedback: string };
    };
  };
  cvAnalysis: CVAnalysisResult;
}> {
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

    // Check API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is not configured');
    }

    // Check cache first
    const cachedResult = getCachedCombinedResult(cvText, jobDescription);
    if (cachedResult) {
      logger.info('Using cached CV combined analysis and optimization result from OpenAI');
      return cachedResult;
    }

    logger.info('No cached combined result found, requesting from OpenAI');

    const client = new OpenAI({ apiKey });
    
    const prompt = `Analyze and optimize the following CV for the given job description. 

IMPORTANT: You MUST preserve the existing EDUCATION, EXPERIENCE, and LANGUAGES sections exactly as they appear in the original CV. Do not remove or modify these sections - only enhance other sections.

First, analyze the CV to extract structured information. Then, optimize the CV for the job description.

Provide:
1. CV analysis with structured information
2. Optimized CV content with relevant keywords and phrases
3. Match score (0-100)
4. List of recommendations for improvement
5. Detailed job match analysis

CV Text:
${cvText}

Job Description:
${jobDescription}

Format the response as JSON with the following structure:
{
  "cvAnalysis": {
    "experience": [{"title": string, "company": string, "dates": string, "responsibilities": string[]}],
    "education": [{"degree": string, "field": string, "institution": string, "year": string}],
    "skills": {"technical": string[], "professional": string[]},
    "achievements": string[],
    "profile": string
  },
  "optimizedContent": string, // The optimized CV text with EDUCATION, EXPERIENCE, and LANGUAGES sections preserved
  "matchScore": number,
  "recommendations": string[],
  "matchAnalysis": {
    "score": number,
    "matchedKeywords": [{"keyword": string, "relevance": number, "frequency": number, "placement": string}],
    "missingKeywords": [{"keyword": string, "importance": number, "suggestedPlacement": string}],
    "recommendations": string[],
    "skillGap": string,
    "dimensionalScores": {
      "skillsMatch": number,
      "experienceMatch": number,
      "educationMatch": number,
      "industryFit": number,
      "overallCompatibility": number,
      "keywordDensity": number,
      "formatCompatibility": number,
      "contentRelevance": number
    },
    "detailedAnalysis": string,
    "improvementPotential": number,
    "sectionAnalysis": {
      "profile": {"score": number, "feedback": string},
      "skills": {"score": number, "feedback": string},
      "experience": {"score": number, "feedback": string},
      "education": {"score": number, "feedback": string},
      "achievements": {"score": number, "feedback": string}
    }
  }
}`;

    logger.info('Sending combined CV analysis and optimization request to OpenAI');
    
    // Increase timeout for complex CV optimization
    const response = await withTimeout(
      client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
      120000, // Increase to 120 second timeout for complex CVs
      'Combined CV analysis and optimization with GPT-4o'
    );

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('Empty response from OpenAI');
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content in OpenAI response');
    }

    try {
      // Use the enhanced JSON parsing function
      const result = safeJsonParse(content);
      logger.info('Successfully parsed combined CV analysis and optimization result from OpenAI');
      
      // Validate the result structure
      if (!result.optimizedContent) {
        throw new Error('Missing optimizedContent in OpenAI response');
      }
      
      // Cache the result
      cacheCombinedResult(cvText, jobDescription, result);
      
      return result;
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
      // Include part of the content in the error for debugging
      const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      throw new Error(`Failed to parse combined CV analysis and optimization result. Response starts with: ${contentPreview}`);
    }
  } catch (error) {
    logger.error('Error in combined CV analysis and optimization with OpenAI:', error instanceof Error ? error.message : String(error));
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed with OpenAI. Please check your API key.');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded with OpenAI. Please try again later.');
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
        throw new Error('OpenAI service is currently experiencing issues. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Request to OpenAI timed out. The CV may be too complex or the service is overloaded. Please try again with a shorter CV.');
      }
    }
    
    throw new Error('Failed to analyze and optimize CV with OpenAI: ' + (error instanceof Error ? error.message : String(error)));
  }
} 