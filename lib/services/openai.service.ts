import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { CVAnalysisResult } from './mistral.service';
import { 
  cacheCVOptimization, 
  getCachedCVOptimization, 
  cacheCombinedResult, 
  getCachedCombinedResult 
} from './cache.service';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;
let openaiClientInitialized = false;

// Initialize OpenAI client
const getOpenAIClient = () => {
  if (!openaiClient) {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.error('OpenAI API key not found');
        return null;
      }
      
      openaiClient = new OpenAI({ apiKey });
      openaiClientInitialized = true;
      logger.info('Successfully initialized OpenAI client');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error instanceof Error ? error.message : String(error));
      openaiClientInitialized = false;
      return null;
    }
  }
  return openaiClient;
};

// Check if OpenAI is available
export const isOpenAIAvailable = async () => {
  const client = getOpenAIClient();
  if (!client) return false;
  
  try {
    // Test the API with a simple request
    await retryWithExponentialBackoff(
      async () => {
        return await client.models.list();
      },
      { service: 'openai', maxRetries: 1 }
    );
    return true;
  } catch (error) {
    logger.error('OpenAI API test failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// Helper function to safely parse JSON
function safeJsonParse(content: string): any {
  try {
    // Look for JSON code blocks in markdown
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const match = content.match(jsonBlockRegex);
    
    if (match && match[1]) {
      return JSON.parse(match[1].trim());
    }
    
    // If no code blocks found, try parsing the content directly
    return JSON.parse(content);
  } catch (error) {
    logger.error('Error parsing JSON:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize CV with GPT-4o using Mistral analysis
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
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  try {
    logger.info('Optimizing CV with GPT-4o using Mistral analysis');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a CV optimization expert. Your task is to optimize the provided CV for the specific job description.
              Use the provided CV analysis to understand the CV structure and content.
              
              Return a JSON object with the following structure:
              {
                "optimizedContent": "The optimized CV text",
                "matchScore": 85, // A number between 0-100 indicating how well the optimized CV matches the job
                "recommendations": ["Recommendation 1", "Recommendation 2"], // List of recommendations for further improvements
                "matchAnalysis": {
                  "score": 85, // Overall match score (0-100)
                  "matchedKeywords": [
                    {"keyword": "string", "relevance": 0.9, "frequency": 2, "placement": "profile"}
                  ],
                  "missingKeywords": [
                    {"keyword": "string", "importance": 0.8, "suggestedPlacement": "skills"}
                  ],
                  "recommendations": ["string"],
                  "skillGap": "string",
                  "dimensionalScores": {
                    "skillsMatch": 80,
                    "experienceMatch": 85,
                    "educationMatch": 90,
                    "industryFit": 75,
                    "overallCompatibility": 82,
                    "keywordDensity": 70,
                    "formatCompatibility": 95,
                    "contentRelevance": 88
                  },
                  "detailedAnalysis": "string",
                  "improvementPotential": 15,
                  "sectionAnalysis": {
                    "profile": {"score": 85, "feedback": "string"},
                    "skills": {"score": 80, "feedback": "string"},
                    "experience": {"score": 90, "feedback": "string"},
                    "education": {"score": 85, "feedback": "string"},
                    "achievements": {"score": 75, "feedback": "string"}
                  }
                }
              }
              
              Do not include any explanations or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: `CV: ${cvText}\n\nJob Description: ${jobDescription}\n\nCV Analysis: ${JSON.stringify(mistralAnalysis)}`
            }
          ]
        });
      },
      { service: 'openai', maxRetries: 3, priority: 1 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content || '';
    
    // Try to parse the response as JSON
    try {
      const result = safeJsonParse(content);
      
      // Validate the structure
      if (!result.optimizedContent || typeof result.matchScore !== 'number') {
        throw new Error('Invalid response structure');
      }
      
      logger.info('CV optimization with GPT-4o completed successfully');
      return result;
    } catch (parseError) {
      logger.error('Error parsing optimization response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error(`Failed to parse optimization result: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error('Error optimizing CV with GPT-4o:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to optimize CV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize CV with GPT-4o fallback (without Mistral analysis)
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
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  try {
    logger.info('Optimizing CV with GPT-4o fallback (without Mistral analysis)');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a CV optimization expert. Your task is to optimize the provided CV for the specific job description.
              First, analyze the CV to understand its structure and content.
              Then, optimize it to better match the job description.
              
              Return a JSON object with the following structure:
              {
                "optimizedContent": "The optimized CV text",
                "matchScore": 85, // A number between 0-100 indicating how well the optimized CV matches the job
                "recommendations": ["Recommendation 1", "Recommendation 2"], // List of recommendations for further improvements
                "matchAnalysis": {
                  "score": 85, // Overall match score (0-100)
                  "matchedKeywords": [
                    {"keyword": "string", "relevance": 0.9, "frequency": 2, "placement": "profile"}
                  ],
                  "missingKeywords": [
                    {"keyword": "string", "importance": 0.8, "suggestedPlacement": "skills"}
                  ],
                  "recommendations": ["string"],
                  "skillGap": "string",
                  "dimensionalScores": {
                    "skillsMatch": 80,
                    "experienceMatch": 85,
                    "educationMatch": 90,
                    "industryFit": 75,
                    "overallCompatibility": 82,
                    "keywordDensity": 70,
                    "formatCompatibility": 95,
                    "contentRelevance": 88
                  },
                  "detailedAnalysis": "string",
                  "improvementPotential": 15,
                  "sectionAnalysis": {
                    "profile": {"score": 85, "feedback": "string"},
                    "skills": {"score": 80, "feedback": "string"},
                    "experience": {"score": 90, "feedback": "string"},
                    "education": {"score": 85, "feedback": "string"},
                    "achievements": {"score": 75, "feedback": "string"}
                  }
                }
              }
              
              Do not include any explanations or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: `CV: ${cvText}\n\nJob Description: ${jobDescription}`
            }
          ]
        });
      },
      { service: 'openai', maxRetries: 3, priority: 1 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content || '';
    
    // Try to parse the response as JSON
    try {
      const result = safeJsonParse(content);
      
      // Validate the structure
      if (!result.optimizedContent || typeof result.matchScore !== 'number') {
        throw new Error('Invalid response structure');
      }
      
      logger.info('CV optimization with GPT-4o fallback completed successfully');
      return result;
    } catch (parseError) {
      logger.error('Error parsing optimization response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error(`Failed to parse optimization result: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error('Error optimizing CV with GPT-4o fallback:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to optimize CV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze and optimize CV with GPT-4o (combined operation)
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
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  try {
    logger.info('Analyzing and optimizing CV with GPT-4o (combined operation)');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
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
                "languages": string[]
              }
              
              Then, optimize the CV to better match the job description.
              
              Return a JSON object with the following structure:
              {
                "optimizedContent": "The optimized CV text",
                "matchScore": 85, // A number between 0-100 indicating how well the optimized CV matches the job
                "recommendations": ["Recommendation 1", "Recommendation 2"], // List of recommendations for further improvements
                "matchAnalysis": {
                  "score": 85, // Overall match score (0-100)
                  "matchedKeywords": [
                    {"keyword": "string", "relevance": 0.9, "frequency": 2, "placement": "profile"}
                  ],
                  "missingKeywords": [
                    {"keyword": "string", "importance": 0.8, "suggestedPlacement": "skills"}
                  ],
                  "recommendations": ["string"],
                  "skillGap": "string",
                  "dimensionalScores": {
                    "skillsMatch": 80,
                    "experienceMatch": 85,
                    "educationMatch": 90,
                    "industryFit": 75,
                    "overallCompatibility": 82,
                    "keywordDensity": 70,
                    "formatCompatibility": 95,
                    "contentRelevance": 88
                  },
                  "detailedAnalysis": "string",
                  "improvementPotential": 15,
                  "sectionAnalysis": {
                    "profile": {"score": 85, "feedback": "string"},
                    "skills": {"score": 80, "feedback": "string"},
                    "experience": {"score": 90, "feedback": "string"},
                    "education": {"score": 85, "feedback": "string"},
                    "achievements": {"score": 75, "feedback": "string"}
                  }
                },
                "cvAnalysis": {
                  // Include the CV analysis here with the structure defined above
                }
              }
              
              Do not include any explanations or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: `CV: ${cvText}\n\nJob Description: ${jobDescription}`
            }
          ]
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