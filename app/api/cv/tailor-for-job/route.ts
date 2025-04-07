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

    const { cvText, jobDescription, jobTitle, industryInsights } = body || {};

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
    
    const detectedIndustry = industryInsights?.industry || 'General';
    logger.info(`Tailoring CV for job: ${jobTitle || 'Unspecified position'} in ${detectedIndustry} industry`);
    
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

    // Define system prompt for the CV tailoring
    const systemPrompt = `You are an expert CV optimizer and Applicant Tracking System (ATS) specialist with deep experience tailoring CVs for specific job descriptions across diverse industries.

Your task is to analyze the CV and job description, then optimize the CV content to maximize relevance and ATS compatibility while highlighting relevant experiences, skills, and qualifications that match the job requirements.

CORE OPTIMIZATION GOALS:
1. Improve ATS compatibility by including exact terminology from the job description
2. Enhance the profile/summary to highlight qualifications specifically relevant to this job
3. Tailor bullet points in experience sections to emphasize achievements relevant to the job requirements
4. Ensure skills section reflects both existing skills and job-required keywords where applicable
5. Maintain professional formatting and structure throughout

DETAILED TAILORING GUIDELINES:
1. Preserve the original structure, sections, and overall format of the CV
2. Find the existing profile/summary/about me section and enhance it to highlight relevant qualifications for this job
   - DO NOT generate a generic profile - always use the actual CV content as your base
   - Look for profile sections labeled as "PROFILE", "SUMMARY", "ABOUT ME", "PROFESSIONAL SUMMARY", or similar
   - If no explicit profile section exists, identify the first substantial paragraph as the introduction
3. Quantify achievements where possible (add metrics like percentages, numbers, timeframes, team sizes)
4. Improve keyword density and placement:
   - Identify 10-15 key skills/terms from the job description
   - Naturally incorporate these terms into relevant sections, especially in the first 1/3 of the document
   - Ensure each skill appears 2-3 times throughout the CV in contextually appropriate ways
5. Use industry-specific terminology relevant to the position
6. Enhance technical skills presentation:
   - Group similar skills together under logical categories
   - Order skills based on relevance to the job description (most relevant first)
   - Add proficiency levels to key skills if not already present
${industryGuidance}
CRITICAL PRESERVATION REQUIREMENTS:
- You MUST preserve all original work experience entries exactly as they appear in the CV
- Keep all job titles, company names, dates, and locations exactly as written in the original
- DO NOT rearrange, remove, or modify any work history items
- Only enhance descriptions within experience entries without changing their core information
- The chronology and basic structure of the experience section must remain unaltered
- Maintain all certifications, education details, and other credentials exactly as presented

MOST IMPORTANT CONSIDERATIONS:
1. Identify and maintain the name and contact details exactly as they appear in the original CV
2. Ensure the enhanced profile is directly based on actual content from the original CV
3. Focus on relevance - every enhancement should directly connect CV content to job requirements
4. Be factual - only use information that exists in the original CV
5. Preserve truthfulness - never fabricate experiences, skills, or qualifications`;

    // Use rate limiter for the API call
    const result = await mistralRateLimiter.execute(async () => {
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

Here is the job description I'm applying for:
---
${jobDescription}
---
${jobTitle ? `\nPosition: ${jobTitle}` : ''}${industryContext}

Please tailor my CV for this specific job opportunity. First, analyze the job description to identify:
1. Key required skills and qualifications
2. Important technical competencies
3. Soft skills and interpersonal qualities valued
4. Industry-specific terminology and keywords

Then, locate my existing profile/summary/about me section in the CV and enhance it to strategically highlight my most relevant qualifications for this position. Use my actual profile content as the foundation, incorporating key terminology from the job posting.

For experience sections:
- Maintain all original job titles, companies, dates, and locations exactly as written
- Enhance bullet points to emphasize achievements that demonstrate relevant skills
- Add quantifiable metrics where appropriate (percentages, numbers, results)
- Ensure keywords from the job description appear naturally within context

For skills sections:
- Reorganize skills to prioritize those most relevant to this position
- Group related skills into logical categories where appropriate
- Ensure technical skills align with job requirements
- Add proficiency indicators for key skills if not already present

IMPORTANT: You must preserve ALL my original work experience entries exactly as they appear in the CV. Keep all job titles, company names, dates, and locations unchanged. Do not modify, remove, or rearrange my work history - only enhance descriptions while keeping the original structure intact.

Return the optimized content in a JSON format with these fields:
1. tailoredContent: The complete tailored CV with all enhancements
2. enhancedProfile: The specifically enhanced profile section (based on my original profile)
3. sectionImprovements: A detailed summary of improvements made to each section, including key keywords incorporated`
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