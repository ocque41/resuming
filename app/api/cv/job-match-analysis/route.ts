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

    logger.info('Starting job match analysis with Mistral AI');
    
    // Use rate limiter for the API call
    const analysis = await mistralRateLimiter.execute(async () => {
      const prompt = `Analyze how well the following CV matches the provided job description. Provide a structured analysis with:

      1. Overall match score (0-100)
      2. List of matched keywords with relevance scores
      3. Missing keywords with importance rankings
      4. Specific recommendations for improvement
      5. Detailed breakdown of skills match, experience match, education match, etc.
      6. Section-by-section analysis with specific feedback

      CV Text:
      ${cvText}

      Job Description:
      ${jobDescription}

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
      }`;

      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        maxTokens: 3000
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