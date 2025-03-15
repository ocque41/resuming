import Mistral from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { cacheCVAnalysis, getCachedCVAnalysis, cacheCVOptimization, getCachedCVOptimization } from './cache.service';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';

// Initialize Mistral client
let mistralClient: Mistral | null = null;
let mistralClientInitialized = false;

// Initialize Mistral client
const getMistralClient = () => {
  if (!mistralClient) {
    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        logger.error('Mistral API key not found');
        return null;
      }
      
      mistralClient = new Mistral(apiKey);
      mistralClientInitialized = true;
      logger.info('Successfully initialized Mistral client');
    } catch (error) {
      logger.error('Failed to initialize Mistral client:', error instanceof Error ? error.message : String(error));
      mistralClientInitialized = false;
      return null;
    }
  }
  return mistralClient;
};

// Check if Mistral is available
export const isMistralAvailable = () => mistralClientInitialized;

// Helper function to extract JSON from markdown
function extractJsonFromMarkdown(content: string): string {
  // Look for JSON code blocks in markdown
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = content.match(jsonBlockRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no code blocks found, return the original content
  return content;
}

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
}

/**
 * Analyze CV content using Mistral AI
 */
export async function analyzeCVContent(cvText: string): Promise<CVAnalysisResult> {
  const client = getMistralClient();
  if (!client) {
    throw new Error('Mistral client is not available');
  }

  try {
    logger.info('Analyzing CV content with Mistral AI');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `You are a CV analysis expert. Analyze the CV provided and extract structured information.
              Return ONLY a JSON object with the following structure:
              {
                "experience": [
                  {
                    "title": "Job Title",
                    "company": "Company Name",
                    "dates": "Date Range",
                    "responsibilities": ["Responsibility 1", "Responsibility 2"]
                  }
                ],
                "education": [
                  {
                    "degree": "Degree Name",
                    "field": "Field of Study",
                    "institution": "Institution Name",
                    "year": "Year"
                  }
                ],
                "skills": {
                  "technical": ["Skill 1", "Skill 2"],
                  "professional": ["Skill 1", "Skill 2"]
                },
                "achievements": ["Achievement 1", "Achievement 2"],
                "profile": "Brief professional summary",
                "languages": ["Language 1", "Language 2"]
              }
              
              Do not include any explanations, markdown formatting, or additional text. Return only the JSON object.`
            },
            {
              role: 'user',
              content: cvText
            }
          ]
        });
      },
      { service: 'mistral', maxRetries: 3 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content;
    
    // Try to parse the response as JSON
    try {
      // First try to extract JSON from markdown if needed
      const jsonContent = extractJsonFromMarkdown(content);
      const result = JSON.parse(jsonContent);
      
      // Validate the structure
      if (!result.experience || !result.education || !result.skills) {
        throw new Error('Invalid response structure');
      }
      
      logger.info('CV analysis completed successfully');
      return result;
    } catch (parseError) {
      logger.error('Error parsing CV analysis response:', parseError instanceof Error ? parseError.message : String(parseError));
      
      // Fallback to regex extraction if JSON parsing fails
      const fallbackResult: CVAnalysisResult = {
        experience: [],
        education: [],
        skills: {
          technical: [],
          professional: []
        },
        achievements: [],
        profile: '',
        languages: []
      };
      
      // Extract profile
      const profileMatch = content.match(/profile["\s:]+([^"]+)/i);
      if (profileMatch) {
        fallbackResult.profile = profileMatch[1].trim();
      }
      
      // Extract skills
      const technicalSkillsMatch = content.match(/technical["\s:]+\[(.*?)\]/is);
      if (technicalSkillsMatch) {
        fallbackResult.skills.technical = technicalSkillsMatch[1]
          .split(',')
          .map(s => s.replace(/"/g, '').trim())
          .filter(Boolean);
      }
      
      const professionalSkillsMatch = content.match(/professional["\s:]+\[(.*?)\]/is);
      if (professionalSkillsMatch) {
        fallbackResult.skills.professional = professionalSkillsMatch[1]
          .split(',')
          .map(s => s.replace(/"/g, '').trim())
          .filter(Boolean);
      }
      
      logger.info('Used fallback extraction for CV analysis');
      return fallbackResult;
    }
  } catch (error) {
    logger.error('Error analyzing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to analyze CV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize CV for a specific job using Mistral AI
 */
export async function optimizeCVForJob(cvText: string, jobDescription: string): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  const client = getMistralClient();
  if (!client) {
    throw new Error('Mistral client is not available');
  }

  try {
    logger.info('Optimizing CV for job with Mistral AI');
    
    // Use the rate limiter with exponential backoff for the chat completion
    const response = await retryWithExponentialBackoff(
      async () => {
        return await client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `You are a CV optimization expert. Your task is to optimize the provided CV for the specific job description.
              Return a JSON object with the following structure:
              {
                "optimizedContent": "The optimized CV text",
                "matchScore": 85, // A number between 0-100 indicating how well the optimized CV matches the job
                "recommendations": ["Recommendation 1", "Recommendation 2"] // List of recommendations for further improvements
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
      { service: 'mistral', maxRetries: 3 }
    );
    
    // Extract the content from the response
    const content = response.choices[0].message.content;
    
    // Try to parse the response as JSON
    try {
      // First try to extract JSON from markdown if needed
      const jsonContent = extractJsonFromMarkdown(content);
      const result = JSON.parse(jsonContent);
      
      // Validate the structure
      if (!result.optimizedContent || typeof result.matchScore !== 'number') {
        throw new Error('Invalid response structure');
      }
      
      logger.info('CV optimization completed successfully');
      return {
        optimizedContent: result.optimizedContent,
        matchScore: result.matchScore,
        recommendations: result.recommendations || []
      };
    } catch (parseError) {
      logger.error('Error parsing optimization response:', parseError instanceof Error ? parseError.message : String(parseError));
      
      // Return the original content with a fallback message
      return {
        optimizedContent: cvText,
        matchScore: 0,
        recommendations: ['Failed to optimize CV due to a technical error. Please try again.']
      };
    }
  } catch (error) {
    logger.error('Error optimizing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to optimize CV: ${error instanceof Error ? error.message : String(error)}`);
  }
} 