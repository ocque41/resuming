import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { analyzeCVContent, isMistralAvailable } from '@/lib/services/mistral.service';
import { optimizeCVWithGPT4o, isOpenAIAvailable } from '@/lib/services/openai.service';
import { logger } from '@/lib/logger';

/**
 * API endpoint for optimizing CV content using Mistral AI for analysis and GPT-4o for optimization
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to CV optimize-with-gpt4o endpoint');
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
      logger.error('Missing cvText parameter in optimize-with-gpt4o request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in optimize-with-gpt4o request');
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

    // Check if OpenAI service is available
    if (!isOpenAIAvailable()) {
      logger.error('OpenAI service is not available');
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI service is not available',
        details: 'The OpenAI service is not properly configured. Please check your API key.',
        serviceUnavailable: true
      }, { status: 503 });
    }

    try {
      // Step 1: Analyze CV content using Mistral AI
      logger.info('Step 1: Analyzing CV content with Mistral AI');
      const analysisResult = await analyzeCVContent(cvText);
      logger.info('CV analysis completed successfully');
      
      // Step 2: Optimize CV content using GPT-4o based on Mistral's analysis
      logger.info('Step 2: Optimizing CV content with GPT-4o based on Mistral analysis');
      const optimizationResult = await optimizeCVWithGPT4o(cvText, jobDescription, analysisResult);
      logger.info('CV optimization completed successfully');
      
      // Return the optimization result
      return NextResponse.json({
        success: true,
        optimizedContent: optimizationResult.optimizedContent,
        matchScore: optimizationResult.matchScore,
        recommendations: optimizationResult.recommendations,
        sectionAnalysis: optimizationResult.sectionAnalysis,
        structuredContent: optimizationResult.structuredContent
      });
    } catch (processingError) {
      logger.error('Error processing CV:', processingError instanceof Error ? processingError.message : String(processingError));
      
      // Check if the error is related to service unavailability
      const errorMessage = processingError instanceof Error ? processingError.message : String(processingError);
      const isServiceUnavailable = 
        errorMessage.includes('not available') || 
        errorMessage.includes('not configured') || 
        errorMessage.includes('Authentication failed');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process CV content',
          details: errorMessage,
          serviceUnavailable: isServiceUnavailable
        },
        { status: isServiceUnavailable ? 503 : 500 }
      );
    }
  } catch (error) {
    logger.error('Error in CV optimize-with-gpt4o endpoint:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 