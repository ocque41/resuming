import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { optimizeCVForJob, isMistralAvailable } from '@/lib/services/mistral.service';
import { logger } from '@/lib/logger';

/**
 * API endpoint for optimizing CV content for a specific job using Mistral AI
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to CV optimize endpoint');
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

    const { cvText, jobDescription, analysis } = body || {};

    // Validate input
    if (!cvText) {
      logger.error('Missing cvText parameter in optimize request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in optimize request');
      return NextResponse.json({ success: false, error: 'Job description is required' }, { status: 400 });
    }

    // Check if Mistral service is available
    if (!isMistralAvailable()) {
      logger.error('Mistral AI service is not available');
      return NextResponse.json({ 
        success: false, 
        error: 'Mistral AI service is not available',
        details: 'The Mistral AI service is not properly configured. Please check your API key.',
        serviceUnavailable: true
      }, { status: 503 });
    }

    // Optimize CV content using Mistral AI
    try {
      logger.info('Optimizing CV content with Mistral AI');
      const optimizationResult = await optimizeCVForJob(cvText, jobDescription);
      
      // Create a match analysis object from the optimization result
      const matchAnalysis = {
        score: Math.round(optimizationResult.matchScore),
        matchedKeywords: [],
        missingKeywords: [],
        recommendations: optimizationResult.recommendations,
        skillGap: '',
        dimensionalScores: {
          skillsMatch: optimizationResult.matchScore / 100,
          experienceMatch: optimizationResult.matchScore / 100,
          educationMatch: optimizationResult.matchScore / 100,
          industryFit: optimizationResult.matchScore / 100,
          overallCompatibility: optimizationResult.matchScore / 100,
          keywordDensity: optimizationResult.matchScore / 100,
          formatCompatibility: optimizationResult.matchScore / 100,
          contentRelevance: optimizationResult.matchScore / 100
        },
        detailedAnalysis: optimizationResult.recommendations.join('\n\n'),
        improvementPotential: 100 - optimizationResult.matchScore,
        sectionAnalysis: {
          profile: { score: optimizationResult.matchScore / 100, feedback: '' },
          skills: { score: optimizationResult.matchScore / 100, feedback: '' },
          experience: { score: optimizationResult.matchScore / 100, feedback: '' },
          education: { score: optimizationResult.matchScore / 100, feedback: '' },
          achievements: { score: optimizationResult.matchScore / 100, feedback: '' }
        }
      };
      
      logger.info('CV optimization completed successfully');
      return NextResponse.json({
        success: true,
        optimizedContent: optimizationResult.optimizedContent,
        matchAnalysis
      });
    } catch (optimizationError) {
      logger.error('Error optimizing CV:', optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
      
      // Check if the error is related to service unavailability
      const errorMessage = optimizationError instanceof Error ? optimizationError.message : String(optimizationError);
      const isServiceUnavailable = 
        errorMessage.includes('not available') || 
        errorMessage.includes('not configured') || 
        errorMessage.includes('Authentication failed');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to optimize CV content',
          details: errorMessage,
          serviceUnavailable: isServiceUnavailable
        },
        { status: isServiceUnavailable ? 503 : 500 }
      );
    }
  } catch (error) {
    logger.error('Error in CV optimize endpoint:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 