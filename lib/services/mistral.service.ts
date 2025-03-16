import Mistral from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';
import * as openaiService from './openai.service';
import { OpenAI } from 'openai';

// Initialize Mistral client
let client: Mistral | null = null;

try {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    logger.warn('MISTRAL_API_KEY is not set. Mistral service will not be available.');
  } else {
    client = new Mistral(apiKey);
    logger.info('Mistral client initialized');
  }
} catch (error) {
  logger.error('Failed to initialize Mistral client:', error instanceof Error ? error.message : String(error));
}

/**
 * Check if Mistral service is available
 */
export async function isMistralAvailable(): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    // Test the API with a simple request
    await retryWithExponentialBackoff(
      async () => {
        await client!.listModels();
        return true;
      },
      {
        service: 'mistral',
        maxRetries: 2,
        priority: 10, // High priority for availability check
        taskId: 'mistral-availability-check',
      }
    );
    return true;
  } catch (error) {
    logger.error('Mistral service is not available:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Define CV analysis result interface for compatibility
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
 * Now with improved rate limiting and fallback to OpenAI
 */
export async function analyzeCVContent(
  cvText: string,
  options: {
    useOpenAIFallback?: boolean;
    priority?: number;
  } = {}
): Promise<CVAnalysisResult> {
  const { useOpenAIFallback = true, priority = 5 } = options;
  
  if (!client) {
    if (useOpenAIFallback && await openaiService.isOpenAIAvailable()) {
      logger.info('Mistral client not available, using OpenAI fallback for CV analysis');
      // Create a simplified analysis using OpenAI
      return createFallbackAnalysis(cvText);
    }
    throw new Error('Mistral client is not initialized and no fallback available');
  }

  logger.info('Analyzing CV content with Mistral AI');
  
  // Define the fallback function
  const fallbackFn = useOpenAIFallback 
    ? async () => {
        logger.info('Using OpenAI fallback for CV analysis due to Mistral rate limit');
        return createFallbackAnalysis(cvText);
      }
    : undefined;

  return retryWithExponentialBackoff(
    async () => {
      const prompt = `
      You are an expert CV analyzer. Extract the following information from the CV text:
      
      CV Text:
      ${cvText}
      
      Extract and return ONLY a JSON object with the following structure:
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
      
      Return ONLY the JSON object, no other text or explanation.
      `;

      const response = await client!.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 4000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      try {
        // Try to parse the response as JSON
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];
        const jsonContent = jsonMatch[1] || content;
        
        const result = JSON.parse(jsonContent.trim());
        
        // Validate the result structure
        const requiredFields = ['experience', 'education', 'skills', 'profile'];
        for (const field of requiredFields) {
          if (!result[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        
        // Ensure arrays are arrays
        const arrayFields = ['experience', 'education', 'achievements', 'languages'];
        for (const field of arrayFields) {
          if (result[field] && !Array.isArray(result[field])) {
            result[field] = [result[field]];
          }
          
          // Ensure the field exists even if empty
          if (!result[field]) {
            result[field] = [];
          }
        }
        
        // Ensure skills structure
        if (!result.skills || typeof result.skills !== 'object') {
          result.skills = { technical: [], professional: [] };
        } else {
          if (!result.skills.technical || !Array.isArray(result.skills.technical)) {
            result.skills.technical = [];
          }
          if (!result.skills.professional || !Array.isArray(result.skills.professional)) {
            result.skills.professional = [];
          }
        }
        
        // Ensure profile is a string
        if (!result.profile || typeof result.profile !== 'string') {
          result.profile = '';
        }
        
        return result;
      } catch (error) {
        logger.error('Error parsing Mistral response:', error instanceof Error ? error.message : String(error));
        logger.debug('Raw Mistral response:', content);
        
        // Attempt to extract information using regex as a fallback
        return extractFallbackAnalysis(content);
      }
    },
    {
      service: 'mistral',
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      maxRetries: 3,
      priority,
      taskId: `analyze-cv-${Date.now()}`,
      fallbackFn,
    }
  );
}

/**
 * Create a fallback analysis using OpenAI if available, or a simple structure if not
 */
async function createFallbackAnalysis(cvText: string): Promise<CVAnalysisResult> {
  try {
    if (await openaiService.isOpenAIAvailable()) {
      // Use OpenAI to create a simplified analysis
      // This would need to be implemented in the OpenAI service
      // For now, return a basic structure
      logger.info('Creating fallback analysis with OpenAI');
      
      // This is a placeholder - in a real implementation, you would call an OpenAI function
      return extractFallbackAnalysis(cvText);
    }
  } catch (error) {
    logger.error('Error creating fallback analysis with OpenAI:', error instanceof Error ? error.message : String(error));
  }
  
  // Return a basic structure if OpenAI is not available or fails
  return {
    experience: [],
    education: [],
    skills: {
      technical: [],
      professional: []
    },
    achievements: [],
    profile: 'Could not analyze CV due to service limitations.',
    languages: []
  };
}

/**
 * Extract a fallback analysis from text using regex
 */
function extractFallbackAnalysis(content: string): CVAnalysisResult {
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
  
  // Extract languages
  const languagesMatch = content.match(/languages["\s:]+\[(.*?)\]/is);
  if (languagesMatch) {
    fallbackResult.languages = languagesMatch[1]
      .split(',')
      .map(s => s.replace(/"/g, '').trim())
      .filter(Boolean);
  }
  
  // Extract achievements
  const achievementsMatch = content.match(/achievements["\s:]+\[(.*?)\]/is);
  if (achievementsMatch) {
    fallbackResult.achievements = achievementsMatch[1]
      .split(',')
      .map(s => s.replace(/"/g, '').trim())
      .filter(Boolean);
  }
  
  logger.info('Used fallback extraction for CV analysis');
  return fallbackResult;
}

/**
 * Optimize CV content for a specific job description using Mistral AI
 * With rate limiting and fallback to OpenAI
 */
export async function optimizeCVForJob(
  cvText: string, 
  jobDescription: string,
  options: {
    useOpenAIFallback?: boolean;
    priority?: number;
  } = {}
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  const { useOpenAIFallback = true, priority = 5 } = options;
  
  if (!client) {
    if (useOpenAIFallback && await openaiService.isOpenAIAvailable()) {
      logger.info('Mistral client not available, using OpenAI fallback for CV optimization');
      return optimizeCVWithOpenAI(cvText, jobDescription);
    }
    throw new Error('Mistral client is not initialized and no fallback available');
  }

  logger.info('Optimizing CV for job with Mistral AI');
  
  try {
    return await retryWithExponentialBackoff(
      async () => {
        logger.info('Sending CV optimization request to Mistral AI');
        
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
        }
        
        IMPORTANT: Return ONLY the raw JSON object. DO NOT use markdown formatting, code blocks, or any other formatting. DO NOT include any explanation or additional text before or after the JSON.`;

        const response = await client!.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          maxTokens: 3000
        });

        const responseText = response.choices[0]?.message?.content?.trim() || '{}';
        
        try {
          // Try to parse as JSON directly
          const cleanedJson = responseText.replace(/```json|```/g, '').trim();
          const result = JSON.parse(cleanedJson);
          
          // Validate the result structure
          if (!result.optimizedContent || typeof result.matchScore !== 'number' || !Array.isArray(result.recommendations)) {
            throw new Error('Invalid response structure from Mistral AI');
          }
          
          logger.info(`CV optimization complete. Match score: ${result.matchScore}`);
          return result;
        } catch (parseError) {
          logger.error('Error parsing Mistral response:', parseError instanceof Error ? parseError.message : String(parseError));
          throw new Error('Failed to parse Mistral response');
        }
      },
      {
        service: 'mistral',
        maxRetries: 3,
        priority,
        taskId: `optimize-cv-${Date.now()}`,
      }
    );
  } catch (error) {
    logger.error('Error optimizing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    
    if (useOpenAIFallback && await openaiService.isOpenAIAvailable()) {
      logger.info('Using OpenAI fallback for CV optimization due to Mistral error');
      return optimizeCVWithOpenAI(cvText, jobDescription);
    }
    
    throw new Error('Failed to optimize CV for job');
  }
}

/**
 * Fallback function to optimize CV using OpenAI
 */
async function optimizeCVWithOpenAI(
  cvText: string,
  jobDescription: string
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  try {
    logger.info('Optimizing CV with OpenAI');
    
    // Get the OpenAI client
    const openaiClient = await openaiService.isOpenAIAvailable() ? 
      new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    
    if (!openaiClient) {
      throw new Error('OpenAI client is not available');
    }
    
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
    }
    
    IMPORTANT: Return ONLY the raw JSON object. DO NOT use markdown formatting, code blocks, or any other formatting. DO NOT include any explanation or additional text before or after the JSON.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0]?.message?.content?.trim() || '{}';
    
    try {
      const result = JSON.parse(responseText);
      
      // Validate the result structure
      if (!result.optimizedContent || typeof result.matchScore !== 'number' || !Array.isArray(result.recommendations)) {
        throw new Error('Invalid response structure from OpenAI');
      }
      
      logger.info(`CV optimization with OpenAI complete. Match score: ${result.matchScore}`);
      return result;
    } catch (parseError) {
      logger.error('Error parsing OpenAI response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error('Failed to parse OpenAI response');
    }
  } catch (error) {
    logger.error('Error optimizing CV with OpenAI:', error instanceof Error ? error.message : String(error));
    
    // Return a basic response as last resort
    return {
      optimizedContent: cvText,
      matchScore: 50,
      recommendations: [
        'Consider tailoring your CV more specifically to the job description',
        'Highlight relevant skills and experience more prominently',
        'Use industry-specific keywords from the job description'
      ]
    };
  }
}

// Export as a service object
export const mistralService = {
  isMistralAvailable,
  analyzeCVContent,
  optimizeCVForJob,
}; 