import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from '../../../lib/services/rate-limiter';
import { extractJsonFromMarkdown } from '@/lib/services/mistral.service';

// Define the expected shape of a job description result
interface JobDescriptionResult {
  title: string;
  overview: string;
  aboutCompany: string;
  responsibilities: string[];
  requirements: {
    essential: string[];
    preferred: string[];
  };
  skills: {
    technical: string[];
    soft: string[];
  };
  experienceEducation: string;
  benefits: string[];
  applicationProcess: string;
  fullDescription: string;
}

// Initialize Mistral client
const getMistralClient = () => {
  // Only initialize on the server
  if (typeof window === 'undefined') {
    return new MistralClient(process.env.MISTRAL_API_KEY || '');
  }
  return null;
};

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to generate-job-description API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Error parsing request body:', parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
      }, { status: 400 });
    }

    const { 
      jobTitle, 
      industry, 
      experienceLevel, 
      keySkills,
      location,
      companyDescription,
      additionalDetails
    } = body || {};

    if (!jobTitle) {
      logger.error('Missing jobTitle parameter in generate-job-description request');
      return NextResponse.json({ success: false, error: 'Job title is required' }, { status: 400 });
    }

    // Get client
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }

    logger.info(`Generating job description for: ${jobTitle}`);
    
    // Build comprehensive job description
    const prompt = `Create a detailed and professional job description for a ${jobTitle} position.

${industry ? `Industry: ${industry}` : ''}
${experienceLevel ? `Experience Level: ${experienceLevel}` : ''}
${location ? `Location: ${location}` : ''}
${keySkills ? `Key Skills Required: ${keySkills}` : ''}
${companyDescription ? `Company Description: ${companyDescription}` : ''}
${additionalDetails ? `Additional Details: ${additionalDetails}` : ''}

Create a complete job description with the following sections:
1. About the Company
2. Job Overview
3. Responsibilities
4. Requirements (Essential and Preferred)
5. Skills (Technical and Soft Skills)
6. Experience and Education
7. Benefits and Perks
8. How to Apply

Format the response as JSON with the following structure:
{
  "title": string,
  "overview": string,
  "aboutCompany": string,
  "responsibilities": string[],
  "requirements": {
    "essential": string[],
    "preferred": string[]
  },
  "skills": {
    "technical": string[],
    "soft": string[]
  },
  "experienceEducation": string,
  "benefits": string[],
  "applicationProcess": string,
  "fullDescription": string
}

Return ONLY valid JSON without any markdown formatting or explanatory text.`;

    // Use rate limiter for the API call
    const result = await mistralRateLimiter.execute(async () => {
      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 2500,
        // @ts-ignore - The Mistral API supports response_format but the type definitions may not be updated
        response_format: { type: 'json_object' }
      });

      try {
        // First try direct parsing
        return JSON.parse(response.choices[0].message.content) as JobDescriptionResult;
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from markdown
        logger.warn('Failed to parse JSON directly, attempting to extract from markdown:', 
                   parseError instanceof Error ? parseError.message : String(parseError));
        
        const content = response.choices[0].message.content;
        const cleanedContent = extractJsonFromMarkdown(content);
        
        try {
          return JSON.parse(cleanedContent) as JobDescriptionResult;
        } catch (extractError) {
          logger.error('Failed to extract and parse JSON from response:', 
                      extractError instanceof Error ? extractError.message : String(extractError));
          logger.error('Raw response snippet (first 100 chars):', content.substring(0, 100));
          throw new Error('Failed to parse job description');
        }
      }
    });

    logger.info('Successfully generated job description');

    // Return the generated job description
    return NextResponse.json({
      success: true,
      jobDescription: result
    });
    
  } catch (error) {
    logger.error('Error in generate-job-description API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 