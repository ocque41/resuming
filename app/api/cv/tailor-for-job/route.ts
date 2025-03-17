import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from '../../../lib/services/rate-limiter';

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
      logger.warn('Unauthorized access attempt to tailor-for-job API');
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

    const { cvText, jobDescription, jobTitle } = body || {};

    if (!cvText) {
      logger.error('Missing cvText parameter in tailor-for-job request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in tailor-for-job request');
      return NextResponse.json({ success: false, error: 'Job description is required' }, { status: 400 });
    }

    // Get Mistral client
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    logger.info(`Tailoring CV for job: ${jobTitle || 'Unspecified position'}`);
    
    // Define system prompt for the CV tailoring
    const systemPrompt = `You are an expert CV optimizer specialized in tailoring CVs to specific job descriptions.
Your task is to analyze the CV and job description, then optimize the CV content to highlight relevant experiences, 
skills, and qualifications that match the job requirements.

Follow these guidelines:
1. Preserve the original structure and sections of the CV
2. Enhance the profile/summary section to highlight relevant qualifications for this specific job
3. Tailor the language to include keywords from the job description
4. Prioritize achievements that demonstrate relevant skills
5. Ensure all content is factual and based only on information in the original CV
6. Do not fabricate experiences, skills, or qualifications
7. Return the content in a structured format that preserves sections

Most importantly, identify and extract the name and contact details from the original CV and maintain them.`;

    // Use rate limiter for the API call
    const result = await mistralRateLimiter.execute(async () => {
      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Here is my CV:
---
${cvText}
---

Here is the job description I'm applying for:
---
${jobDescription}
---
${jobTitle ? `\nPosition: ${jobTitle}` : ''}

Please tailor my CV for this job. Enhance the profile section to focus on relevant qualifications.
Return the optimized content in a JSON format with these fields:
1. tailoredContent: The complete tailored CV
2. enhancedProfile: A specifically enhanced profile section
3. sectionImprovements: A summary of improvements made to each section`
          }
        ],
        temperature: 0.3,
        maxTokens: 4000,
        // @ts-ignore - The Mistral API supports response_format but the type definitions may not be updated
        response_format: { type: 'json_object' }
      });
      
      try {
        // First try direct parsing
        return JSON.parse(response.choices[0].message.content) as {
          tailoredContent: string;
          enhancedProfile: string;
          sectionImprovements: Record<string, string>;
        };
      } catch (parseError) {
        // If direct parsing fails, extract JSON from the response
        logger.warn('Failed to parse Mistral response as JSON directly', parseError);
        
        // Try to extract JSON from the response
        const content = response.choices[0].message.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = content.substring(jsonStart, jsonEnd + 1);
          return JSON.parse(jsonStr) as {
            tailoredContent: string;
            enhancedProfile: string;
            sectionImprovements: Record<string, string>;
          };
        }
        
        // If JSON extraction fails, return a simple structure with the response
        logger.error('Failed to extract JSON from Mistral response, using fallback');
        return {
          tailoredContent: content,
          enhancedProfile: '',
          sectionImprovements: {}
        };
      }
    });
    
    logger.info('CV tailoring completed successfully');

    // Return the tailoring result
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error in CV tailor-for-job API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 