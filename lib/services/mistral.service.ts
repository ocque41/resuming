import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';

// Validate API key presence
const apiKey = process.env.MISTRAL_API_KEY || '';
if (!apiKey) {
  logger.error('MISTRAL_API_KEY is not set in environment variables');
}

// Initialize Mistral client with better error handling
const getMistralClient = () => {
  try {
    return new MistralClient(apiKey);
  } catch (error) {
    logger.error('Failed to initialize Mistral client:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to initialize Mistral AI client');
  }
};

// Validate client on startup
try {
  getMistralClient();
  logger.info('Mistral AI client initialized successfully');
} catch (error) {
  logger.error('Mistral AI client initialization failed:', error instanceof Error ? error.message : String(error));
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

    // Check API key
    if (!apiKey) {
      throw new Error('Mistral API key is not configured');
    }

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
    const response = await client.chat({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      maxTokens: 2000
    });

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('Empty response from Mistral AI');
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content in Mistral AI response');
    }

    try {
      const result = JSON.parse(content);
      logger.info('Successfully parsed CV analysis result from Mistral AI');
      return result;
    } catch (parseError) {
      logger.error('Failed to parse Mistral AI response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error('Failed to parse CV analysis result');
    }
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

    // Check API key
    if (!apiKey) {
      throw new Error('Mistral API key is not configured');
    }

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
    const response = await client.chat({
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

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('Empty response from Mistral AI');
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty content in Mistral AI response');
    }

    try {
      const result = JSON.parse(content);
      logger.info('Successfully parsed CV optimization result from Mistral AI');
      return result;
    } catch (parseError) {
      logger.error('Failed to parse Mistral AI response:', parseError instanceof Error ? parseError.message : String(parseError));
      throw new Error('Failed to parse CV optimization result');
    }
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