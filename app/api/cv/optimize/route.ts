import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { analyzeCVContent, isMistralAvailable } from '@/lib/services/mistral.service';
import { optimizeCVWithGPT4o, optimizeCVWithGPT4oFallback, isOpenAIAvailable } from '@/lib/services/openai.service';
import { logger } from '@/lib/logger';

/**
 * API endpoint for optimizing CV content for a specific job using Mistral AI for analysis and GPT-4o for optimization
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

    // Check if AI services are available
    const mistralAvailable = isMistralAvailable();
    const openaiAvailable = isOpenAIAvailable();

    if (!mistralAvailable && !openaiAvailable) {
      logger.error('Both Mistral AI and OpenAI services are not available');
      return NextResponse.json({ 
        success: false, 
        error: 'AI services are not available',
        details: 'Both Mistral AI and OpenAI services are not properly configured. Please check your API keys.',
        serviceUnavailable: true
      }, { status: 503 });
    }

    // Optimization process
    try {
      // Step 1: Analyze CV with Mistral if available
      let cvAnalysis;
      if (mistralAvailable) {
        try {
          logger.info('Analyzing CV content with Mistral AI');
          cvAnalysis = await analyzeCVContent(cvText);
          logger.info('CV analysis completed successfully with Mistral AI');
        } catch (mistralError) {
          logger.error('Error analyzing CV with Mistral AI:', mistralError instanceof Error ? mistralError.message : String(mistralError));
          
          // If Mistral fails but OpenAI is available, we can still proceed with OpenAI fallback
          if (!openaiAvailable) {
            return NextResponse.json(
              { 
                success: false, 
                error: 'Failed to analyze CV content',
                details: mistralError instanceof Error ? mistralError.message : 'Unknown error',
                serviceUnavailable: true
              },
              { status: 503 }
            );
          }
        }
      } else {
        logger.warn('Mistral AI service is not available, skipping CV analysis step');
      }

      // Step 2: Optimize CV with GPT-4o
      if (openaiAvailable) {
        try {
          logger.info('Optimizing CV content with GPT-4o');
          
          let optimizationResult;
          if (cvAnalysis) {
            // Use Mistral analysis with GPT-4o
            optimizationResult = await optimizeCVWithGPT4o(cvText, jobDescription, cvAnalysis);
          } else {
            // Use GPT-4o fallback without Mistral analysis
            logger.info('Using GPT-4o fallback without Mistral analysis');
            optimizationResult = await optimizeCVWithGPT4oFallback(cvText, jobDescription);
          }
          
          logger.info('CV optimization completed successfully with GPT-4o');
          
          return NextResponse.json({
            success: true,
            optimizedContent: optimizationResult.optimizedContent,
            matchAnalysis: optimizationResult.matchAnalysis,
            recommendations: optimizationResult.recommendations,
            matchScore: optimizationResult.matchScore
          });
        } catch (openaiError) {
          logger.error('Error optimizing CV with GPT-4o:', openaiError instanceof Error ? openaiError.message : String(openaiError));
          
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to optimize CV content with GPT-4o',
              details: openaiError instanceof Error ? openaiError.message : 'Unknown error',
              serviceUnavailable: true
            },
            { status: 503 }
          );
        }
      } else {
        logger.error('OpenAI service is not available');
        return NextResponse.json({ 
          success: false, 
          error: 'OpenAI service is not available',
          details: 'The OpenAI service is not properly configured. Please check your API key.',
          serviceUnavailable: true
        }, { status: 503 });
      }
    } catch (optimizationError) {
      logger.error('Error in CV optimization process:', optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
      
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