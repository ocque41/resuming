import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { 
  cacheCVOptimization, 
  getCachedCVOptimization, 
  cacheCombinedResult, 
  getCachedCombinedResult 
} from './cache.service';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';

// Define the CVAnalysisResult interface directly here
export interface CVAnalysisResult {
  industry?: string;
  language?: string;
  sections?: Array<{ name: string; content: string }>;
  skills: {
    technical: string[];
    professional: string[];
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  atsScore?: number;
  formatStrengths?: string[];
  formatWeaknesses?: string[];
  formatRecommendations?: string[];
}

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;
let openaiClientInitialized = false;

export const getOpenAIClient = () => {
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
 * Analyze CV content with OpenAI
 */
export async function analyzeCVContent(cvText: string): Promise<{
  cvAnalysis: CVAnalysisResult;
}> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  try {
    logger.info('Analyzing CV content with OpenAI');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a CV analysis expert. Analyze the provided CV and extract key information.
              
              Return a JSON object with the following structure:
              {
                "industry": "Technology", // The primary industry the CV is targeting
                "language": "English", // The language of the CV
                "sections": [
                  { "name": "Profile", "content": "..." },
                  { "name": "Experience", "content": "..." }
                ],
                "skills": {
                  "technical": ["JavaScript", "React", "Node.js"],
                  "professional": ["Project Management", "Team Leadership"]
                },
                "strengths": ["Clear presentation of experience", "Strong technical skills"],
                "weaknesses": ["Lacks quantifiable achievements", "No clear career progression"],
                "recommendations": ["Add more quantifiable achievements", "Clarify career progression"],
                "atsScore": 75,
                "formatStrengths": ["Clear section headings", "Consistent formatting"],
                "formatWeaknesses": ["Dense text blocks", "Inconsistent date formats"],
                "formatRecommendations": ["Use bullet points", "Standardize date formats"]
              }
              Do not include any explanations or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: `CV: ${cvText}`
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
      const result = JSON.parse(content);
      
      // Validate the structure
      if (!result.skills) {
        throw new Error('Invalid response structure: missing skills');
      }
      
      logger.info('CV analysis with OpenAI completed successfully');
      return { cvAnalysis: result };
    } catch (parseError) {
      logger.error('Error parsing analysis response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error(`Failed to parse analysis result: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error('Error analyzing CV with OpenAI:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to analyze CV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize CV for a specific job with OpenAI
 */
export async function optimizeCVForJob(
  cvText: string, 
  jobDescription: string, 
  cvAnalysis: CVAnalysisResult
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
  // Check if we have a cached result
  const cachedResult = getCachedCVOptimization(cvText, jobDescription);
  if (cachedResult) {
    logger.info('Using cached CV optimization result');
    return cachedResult;
  }

  // If no cached result, use the optimizeCVWithGPT4o function
  const result = await optimizeCVWithGPT4o(cvText, jobDescription, cvAnalysis);
  
  // Cache the result
  cacheCVOptimization(cvText, jobDescription, result, 'openai');
  
  return result;
}

/**
 * Optimize CV with GPT-4o using analysis
 */
export async function optimizeCVWithGPT4o(
  cvText: string, 
  jobDescription: string, 
  analysis: CVAnalysisResult
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
    logger.info('Optimizing CV with GPT-4o using analysis');
    
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
                "matchScore": 85,
                "recommendations": ["Recommendation 1", "Recommendation 2"],
                "matchAnalysis": {
                  "score": 85,
                  "matchedKeywords": [{"keyword": "string", "relevance": 0.9, "frequency": 2, "placement": "profile"}],
                  "missingKeywords": [{"keyword": "string", "importance": 0.8, "suggestedPlacement": "skills"}],
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
              content: `CV: ${cvText}\n\nJob Description: ${jobDescription}\n\nCV Analysis: ${JSON.stringify(analysis)}`
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
      const result = JSON.parse(content);
      
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
 * Optimize CV with GPT-4o (without prior analysis)
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
    logger.info('Optimizing CV with GPT-4o (without prior analysis)');
    
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
      const result = JSON.parse(content);
      
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
 * Process a custom prompt with GPT-4o
 */
export async function processCustomPromptWithGPT4o(
  prompt: string,
  temperature: number = 0.3
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client is not available');
  }

  try {
    logger.info('Processing custom prompt with GPT-4o');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        });
      },
      { service: 'openai', maxRetries: 3, priority: 1 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content || '';
    logger.info('Custom prompt processing with GPT-4o completed successfully');
    return content;
  } catch (error) {
    logger.error('Error processing custom prompt with GPT-4o:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to process custom prompt: ${error instanceof Error ? error.message : String(error)}`);
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