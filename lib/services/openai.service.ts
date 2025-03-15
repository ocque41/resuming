import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { CVAnalysisResult } from './mistral.service';

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

    logger.info('Starting CV optimization with GPT-4o based on Mistral analysis');
    
    // Create a system message that instructs GPT-4o on how to optimize the CV
    const systemMessage = `
You are an expert CV optimizer. Your task is to optimize a CV for a specific job description.
You have been provided with:
1. The original CV text
2. The job description
3. An analysis of the CV by Mistral AI

Your goal is to create an optimized version of the CV that:
- Highlights relevant skills and experience for the job
- Incorporates keywords from the job description
- Maintains the original structure and formatting of the CV
- Improves the overall match score

Please provide:
1. The optimized CV content
2. A match score (0-100) indicating how well the optimized CV matches the job description
3. A list of recommendations for further improvement
4. A detailed match analysis with:
   - Matched keywords with relevance, frequency, and placement
   - Missing keywords with importance and suggested placement
   - Skill gap analysis
   - Dimensional scores (skills match, experience match, education match, etc.)
   - Section-by-section analysis with scores and feedback

Format your response as JSON with the following structure:
{
  "optimizedContent": string,
  "matchScore": number,
  "recommendations": string[],
  "matchAnalysis": {
    "score": number,
    "matchedKeywords": [{ "keyword": string, "relevance": number, "frequency": number, "placement": string }],
    "missingKeywords": [{ "keyword": string, "importance": number, "suggestedPlacement": string }],
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
      "profile": { "score": number, "feedback": string },
      "skills": { "score": number, "feedback": string },
      "experience": { "score": number, "feedback": string },
      "education": { "score": number, "feedback": string },
      "achievements": { "score": number, "feedback": string }
    }
  }
}
`;

    // Create a user message with the CV, job description, and Mistral analysis
    const userMessage = `
Original CV:
${cvText}

Job Description:
${jobDescription}

Mistral Analysis:
${JSON.stringify(mistralAnalysis, null, 2)}
`;

    // Call GPT-4o with a timeout
    const response = await withTimeout(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
      60000, // 60 second timeout
      'GPT-4o CV optimization'
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
      logger.info('Successfully parsed GPT-4o CV optimization result');
      return result;
    } catch (parseError) {
      logger.error('Failed to parse GPT-4o response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error('Failed to parse CV optimization result');
    }
  } catch (error) {
    logger.error('Error optimizing CV with GPT-4o:', error instanceof Error ? error.message : String(error));
    
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

    logger.info('Starting CV optimization with GPT-4o (fallback mode without Mistral analysis)');
    
    // Create a system message that instructs GPT-4o on how to optimize the CV
    const systemMessage = `
You are an expert CV optimizer. Your task is to optimize a CV for a specific job description.
You have been provided with:
1. The original CV text
2. The job description

Your goal is to create an optimized version of the CV that:
- Highlights relevant skills and experience for the job
- Incorporates keywords from the job description
- Maintains the original structure and formatting of the CV
- Improves the overall match score

Please provide:
1. The optimized CV content
2. A match score (0-100) indicating how well the optimized CV matches the job description
3. A list of recommendations for further improvement
4. A detailed match analysis with:
   - Matched keywords with relevance, frequency, and placement
   - Missing keywords with importance and suggested placement
   - Skill gap analysis
   - Dimensional scores (skills match, experience match, education match, etc.)
   - Section-by-section analysis with scores and feedback

Format your response as JSON with the following structure:
{
  "optimizedContent": string,
  "matchScore": number,
  "recommendations": string[],
  "matchAnalysis": {
    "score": number,
    "matchedKeywords": [{ "keyword": string, "relevance": number, "frequency": number, "placement": string }],
    "missingKeywords": [{ "keyword": string, "importance": number, "suggestedPlacement": string }],
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
      "profile": { "score": number, "feedback": string },
      "skills": { "score": number, "feedback": string },
      "experience": { "score": number, "feedback": string },
      "education": { "score": number, "feedback": string },
      "achievements": { "score": number, "feedback": string }
    }
  }
}
`;

    // Create a user message with the CV and job description
    const userMessage = `
Original CV:
${cvText}

Job Description:
${jobDescription}
`;

    // Call GPT-4o with a timeout
    const response = await withTimeout(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
      60000, // 60 second timeout
      'GPT-4o CV optimization (fallback)'
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
      logger.info('Successfully parsed GPT-4o CV optimization result (fallback mode)');
      return result;
    } catch (parseError) {
      logger.error('Failed to parse GPT-4o response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error('Failed to parse CV optimization result');
    }
  } catch (error) {
    logger.error('Error optimizing CV with GPT-4o (fallback):', error instanceof Error ? error.message : String(error));
    
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
    
    throw new Error('Failed to optimize CV with GPT-4o (fallback mode)');
  }
} 