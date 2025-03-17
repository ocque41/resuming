import MistralClient from '@mistralai/mistralai';
import 'server-only';
import { logger } from '@/lib/logger';

/**
 * Helper function to extract JSON from markdown-formatted text
 * This handles cases where the AI model returns JSON within markdown code blocks
 */
export function extractJsonFromMarkdown(text: string): string {
  // Check if the text contains markdown JSON code blocks
  const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/;
  const match = text.match(jsonBlockRegex);
  
  if (match && match[1]) {
    // Return the content inside the code block
    return match[1].trim();
  }
  
  // If no code block found, return the original text
  return text;
}

// Initialize Mistral client
const client = new MistralClient(process.env.MISTRAL_API_KEY || '');

// Add MistralService class for general text generation
export class MistralService {
  private client: MistralClient;
  
  constructor() {
    this.client = client;
  }
  
  async generateText({
    prompt,
    temperature = 0.2,
    max_tokens = 3000,
    response_format = undefined
  }: {
    prompt: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  }): Promise<string> {
    try {
      const chatOptions: any = {
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        maxTokens: max_tokens
      };
      
      // Add response_format if specified
      if (response_format) {
        // @ts-ignore - The Mistral API supports response_format but TS typing might not be updated
        chatOptions.response_format = response_format;
      }
      
      const response = await this.client.chat(chatOptions);
      
      const content = response.choices[0].message.content;
      
      // If response is supposed to be JSON, try to clean it if needed
      if (response_format?.type === 'json_object') {
        return extractJsonFromMarkdown(content);
      }
      
      return content;
    } catch (error) {
      logger.error('Error generating text with Mistral AI:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to generate text');
    }
  }
  
  /**
   * Generate JSON directly and parse it to an object
   */
  async generateJSON<T>({
    prompt,
    temperature = 0.2,
    max_tokens = 3000
  }: {
    prompt: string;
    temperature?: number;
    max_tokens?: number;
  }): Promise<T> {
    try {
      const textResponse = await this.generateText({
        prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON without any markdown formatting or explanatory text.`,
        temperature,
        max_tokens,
        response_format: { type: 'json_object' }
      });
      
      try {
        return JSON.parse(textResponse) as T;
      } catch (parseError) {
        logger.error('Error parsing JSON response:', parseError instanceof Error ? parseError.message : String(parseError));
        throw new Error('Failed to parse JSON from model response');
      }
    } catch (error) {
      logger.error('Error generating JSON with Mistral AI:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Create an instance of the MistralService for export
export const mistralService = new MistralService();

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

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error analyzing CV with Mistral AI:', error);
    throw new Error('Failed to analyze CV content');
  }
}

export async function optimizeCVForJob(cvText: string, jobDescription: string): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  try {
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

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error optimizing CV with Mistral AI:', error);
    throw new Error('Failed to optimize CV for job');
  }
} 