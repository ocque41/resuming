import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { analyzeCVContent, isMistralAvailable } from '@/lib/services/mistral.service';
import { logger } from '@/lib/logger';

/**
 * API endpoint for analyzing CV content using Mistral AI
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to CV analyze endpoint');
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

    // Validate input
    if (!cvText) {
      logger.error('Missing cvText parameter in analyze request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
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

    // Analyze CV content using Mistral AI
    try {
      logger.info('Analyzing CV content with Mistral AI');
      const analysisResult = await analyzeCVContent(cvText);
      
      logger.info('CV analysis completed successfully');
      return NextResponse.json({
        success: true,
        analysis: analysisResult
      });
    } catch (analysisError) {
      logger.error('Error analyzing CV:', analysisError instanceof Error ? analysisError.message : String(analysisError));
      
      // Check if the error is related to service unavailability
      const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
      const isServiceUnavailable = 
        errorMessage.includes('not available') || 
        errorMessage.includes('not configured') || 
        errorMessage.includes('Authentication failed');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to analyze CV content',
          details: errorMessage,
          serviceUnavailable: isServiceUnavailable
        },
        { status: isServiceUnavailable ? 503 : 500 }
      );
    }
  } catch (error) {
    logger.error('Error in CV analyze endpoint:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 