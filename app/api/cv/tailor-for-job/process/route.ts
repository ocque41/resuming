import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db/queries.server';
import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from '@/app/lib/services/rate-limiter';
import { kv } from '@vercel/kv';

// Set runtime to edge for better performance
export const runtime = 'edge';
// Increase max duration for this function
export const maxDuration = 60; // 60 seconds

// Initialize Mistral client
const getMistralClient = () => {
  // Only initialize on the server
  if (typeof window === 'undefined') {
    return new MistralClient(process.env.MISTRAL_API_KEY || '');
  }
  return null;
};

/**
 * Process function that runs the AI tailoring in a separate serverless function
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication from headers
    const userId = request.headers.get('x-auth-user-id');
    const jobId = request.headers.get('x-auth-job-id');
    
    if (!userId || !jobId) {
      logger.warn('Unauthorized access attempt to tailor-for-job/process API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await getUserById(userId);
    if (!user) {
      logger.warn(`Invalid user ID in tailor-for-job/process API: ${userId}`);
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Error parsing process request body:', parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
      }, { status: 400 });
    }

    const { cvText, jobDescription, jobTitle, cvId, industryInsights } = body || {};

    // Update job status to processing
    await kv.set(`tailor:${jobId}:status`, 'processing');
    await kv.set(`tailor:${jobId}:progress`, 10);
    await kv.set(`tailor:${jobId}:startTime`, Date.now());

    // Get Mistral client
    const client = getMistralClient();
    if (!client) {
      logger.error(`Mistral client not initialized for job ${jobId}`);
      await kv.set(`tailor:${jobId}:status`, 'error');
      await kv.set(`tailor:${jobId}:error`, 'AI service unavailable');
      return NextResponse.json({ success: false, error: 'AI service unavailable' }, { status: 500 });
    }
    
    const detectedIndustry = industryInsights?.industry || 'General';
    logger.info(`Processing CV tailoring for job ${jobId}: ${jobTitle || 'Unspecified position'} in ${detectedIndustry} industry`);
    
    // Process in the background and don't wait for response
    (async () => {
      try {
        // Update progress
        await kv.set(`tailor:${jobId}:progress`, 20);
        
        // Generate tailoring prompt with safety checks for industryInsights
        const result = await generateTailoredCV(client, cvText, jobDescription, jobTitle, industryInsights);
        
        // Store result in KV store
        await kv.set(`tailor:${jobId}:result`, result);
        await kv.set(`tailor:${jobId}:status`, 'completed');
        await kv.set(`tailor:${jobId}:progress`, 100);
        await kv.set(`tailor:${jobId}:completedAt`, Date.now());
        
        logger.info(`CV tailoring completed successfully for job ${jobId}`);
      } catch (error) {
        logger.error(`Error in background processing for job ${jobId}:`, error instanceof Error ? error.message : String(error));
        
        // Store error in KV store
        await kv.set(`tailor:${jobId}:status`, 'error');
        await kv.set(`tailor:${jobId}:error`, error instanceof Error ? error.message : 'Unknown error');
        await kv.set(`tailor:${jobId}:progress`, 0);
      }
    })().catch(error => {
      logger.error(`Unhandled error in background processing for job ${jobId}:`, error instanceof Error ? error.message : String(error));
    });
    
    // Return immediately to avoid timeout
    return NextResponse.json({
      success: true,
      message: 'Processing started',
      jobId
    });
  } catch (error) {
    logger.error('Error in tailor-for-job/process API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a tailored CV using the Mistral API
 */
async function generateTailoredCV(
  client: MistralClient, 
  cvText: string, 
  jobDescription: string, 
  jobTitle?: string,
  industryInsights?: any
): Promise<{
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
}> {
  // Include industry-specific guidance in the system prompt if available
  let industryGuidance = '';
  if (industryInsights) {
    // Ensure all properties exist and are arrays before using join
    const keySkills = Array.isArray(industryInsights.keySkills) ? industryInsights.keySkills.join(', ') : 'relevant skills';
    const metrics = Array.isArray(industryInsights.suggestedMetrics) ? industryInsights.suggestedMetrics.join(', ') : 'quantifiable achievements';
    const guidance = industryInsights.formatGuidance || 'Follow professional CV formatting conventions';
    
    industryGuidance = `
INDUSTRY-SPECIFIC GUIDANCE FOR ${industryInsights.industry.toUpperCase()}:
1. Focus on these key skills for this industry: ${keySkills}
2. Where possible, include these types of metrics in achievements: ${metrics}
3. ${guidance}
`;
  }

  // Use a more concise system prompt
  const systemPrompt = `You are an expert CV optimizer. Analyze the CV and job description, then optimize the CV content to maximize relevance and ATS compatibility.

CORE GOALS:
1. Improve ATS compatibility with exact terminology from the job description
2. Enhance the profile/summary to highlight relevant qualifications
3. Tailor bullet points to emphasize relevant achievements
4. Ensure skills match job requirements
${industryGuidance}
PRESERVATION REQUIREMENTS:
- Preserve all original work experience entries
- Keep all job titles, company names, dates, and locations exactly as written
- Only enhance descriptions without changing core information
- Maintain the chronology and structure of the experience section
- Preserve all certifications and education details`;

  // Use rate limiter for the API call
  return mistralRateLimiter.execute(async () => {
    // Include industry details in the user prompt if available
    let industryContext = '';
    if (industryInsights) {
      // Safely access keySkills array
      const keySkills = Array.isArray(industryInsights.keySkills) ? industryInsights.keySkills.join(', ') : 'relevant skills';
      industryContext = `\nThe job appears to be in the ${industryInsights.industry} industry, where these skills are particularly valued: ${keySkills}.`;
    }
    
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

Here is the job description:
---
${jobDescription}
---
${jobTitle ? `\nPosition: ${jobTitle}` : ''}${industryContext}

Tailor my CV for this job. First, identify key requirements and skills. Then, enhance my profile section and customize bullet points to emphasize relevant achievements.

Return the optimized content in JSON with these fields:
1. tailoredContent: The complete tailored CV
2. enhancedProfile: The enhanced profile section
3. sectionImprovements: Summary of improvements made`
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
} 