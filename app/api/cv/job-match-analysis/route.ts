import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import MistralClient from '@mistralai/mistralai';
import { mistralRateLimiter } from '../../../lib/services/rate-limiter';
import { MistralRAGService } from '@/lib/utils/mistralRagService';

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
      logger.warn('Unauthorized access attempt to CV job-match-analysis API');
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

    const { cvText, jobDescription } = body || {};

    if (!cvText) {
      logger.error('Missing cvText parameter in job-match-analysis request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in job-match-analysis request');
      return NextResponse.json({ success: false, error: 'Job description is required' }, { status: 400 });
    }

    // Get client
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }

    logger.info('Starting job match analysis process');
    
    // First extract CV keywords and relevant info using our RAG service
    // This will save tokens in the job-match prompt
    let cvKeywords: string[] = [];
    let cvSkills: string[] = [];
    let cvSections: Array<{ name: string, summary: string }> = [];
    
    try {
      logger.info('Extracting CV information using RAG service');
      const ragService = new MistralRAGService();
      await ragService.processCVDocument(cvText);
      
      // Use the comprehensive analysis method to get CV data
      const cvAnalysis = await ragService.analyzeCVComprehensive();
      cvKeywords = cvAnalysis.keywords;
      cvSkills = cvAnalysis.skills;
      cvSections = cvAnalysis.sections.map(section => ({
        name: section.name,
        // Limit content length to keep the prompt size manageable
        summary: section.content.substring(0, 100) + (section.content.length > 100 ? '...' : '')
      }));
      
      logger.info(`Extracted ${cvKeywords.length} keywords, ${cvSkills.length} skills, and ${cvSections.length} sections from CV`);
    } catch (ragError) {
      logger.error('Error using RAG service for CV analysis:', ragError instanceof Error ? ragError.message : String(ragError));
      // Continue with the process even if this step fails
      logger.info('Continuing with job match analysis without RAG preprocessing');
    }
    
    // Use rate limiter for the Mistral API call
    const analysis = await mistralRateLimiter.execute(async () => {
      // Create an enhanced prompt that includes the pre-extracted CV data
      // This saves tokens because we don't need to include the full CV text
      const enhancedPrompt = `Analyze how well the following CV matches the provided job description. 

      CV Information:
      - Keywords: ${cvKeywords.join(', ')}
      - Skills: ${cvSkills.join(', ')}
      - Sections: ${JSON.stringify(cvSections)}
      
      Full CV Text (for reference):
      ${cvText}

      Job Description:
      ${jobDescription}

      Provide a structured analysis with:
      1. Overall match score (0-100)
      2. List of matched keywords with relevance scores
      3. Missing keywords with importance rankings
      4. Specific recommendations for improvement
      5. Detailed breakdown of skills match, experience match, education match, etc.
      6. Section-by-section analysis with specific feedback

      Format the response as JSON with the following structure:
      {
        "score": number,
        "matchedKeywords": [{"keyword": string, "relevance": number, "frequency": number, "placement": string}],
        "missingKeywords": [{"keyword": string, "importance": number, "suggestedPlacement": string}],
        "recommendations": string[],
        "skillGap": string,
        "dimensionalScores": {
          "skillsMatch": number,
          "experienceMatch": number,
          "educationMatch": number,
          "industryFit": number,
          "overallCompatibility": number,
          "keywordDensity": number,
          "formatCompatibility": number,
          "contentRelevance": number
        },
        "detailedAnalysis": string,
        "improvementPotential": number,
        "sectionAnalysis": {
          "profile": {"score": number, "feedback": string},
          "skills": {"score": number, "feedback": string},
          "experience": {"score": number, "feedback": string},
          "education": {"score": number, "feedback": string},
          "achievements": {"score": number, "feedback": string}
        }
      }
      
      Return ONLY valid JSON without any additional text or explanations.`;

      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.1,
        maxTokens: 3000,
        // @ts-ignore - The Mistral API supports response_format but the type definitions may not be updated
        response_format: { type: 'json_object' }
      });

      try {
        return JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        logger.error('Error parsing Mistral response:', parseError instanceof Error ? parseError.message : String(parseError));
        throw new Error('Failed to parse job match analysis result');
      }
    });
    
    logger.info('Job match analysis completed successfully');

    // Return the job match analysis
    return NextResponse.json({
      success: true,
      analysis
    });
    
  } catch (error) {
    logger.error('Error in CV job-match-analysis API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 