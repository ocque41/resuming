import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';

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
      const response = await this.client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        maxTokens: max_tokens,
        ...(response_format && { response_format })
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Error generating text with Mistral AI:', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Failed to generate text');
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