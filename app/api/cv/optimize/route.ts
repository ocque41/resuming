import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { analyzeCVContent, isMistralAvailable } from '@/lib/services/mistral.service';
import { 
  optimizeCVWithGPT4o, 
  optimizeCVWithGPT4oFallback, 
  analyzeAndOptimizeCVWithGPT4o,
  isOpenAIAvailable 
} from '@/lib/services/openai.service';
import { logger } from '@/lib/logger';

/**
 * Helper function to format error responses
 */
function formatErrorResponse(error: unknown, statusCode: number = 500) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for specific error types
  const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
  const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate limit');
  const isServerError = errorMessage.includes('500') || errorMessage.includes('502') || 
                        errorMessage.includes('503') || errorMessage.includes('504');
  const isParseError = errorMessage.includes('parse') || errorMessage.includes('JSON');
  
  // Determine appropriate status code
  let responseStatus = statusCode;
  if (isTimeout) {
    responseStatus = 504; // Gateway Timeout
  } else if (isRateLimit) {
    responseStatus = 429; // Too Many Requests
  } else if (isServerError) {
    responseStatus = 503; // Service Unavailable
  } else if (isParseError) {
    responseStatus = 422; // Unprocessable Entity
  }
  
  // Log the error with appropriate level
  if (responseStatus >= 500) {
    logger.error('CV optimization error:', errorMessage);
  } else {
    logger.warn('CV optimization issue:', errorMessage);
  }
  
  // Create user-friendly error message
  let userMessage = 'Failed to optimize CV content';
  if (isTimeout) {
    userMessage = 'The optimization request timed out. Your CV may be too complex or the service is currently overloaded. Please try again with a shorter CV or try later.';
  } else if (isRateLimit) {
    userMessage = 'Rate limit exceeded. Please try again later.';
  } else if (isServerError) {
    userMessage = 'The AI service is currently experiencing issues. Please try again later.';
  } else if (isParseError) {
    userMessage = 'Failed to process the AI response. Please try again.';
  }
  
  return {
    response: NextResponse.json({ 
      success: false, 
      error: userMessage,
      details: errorMessage,
      serviceUnavailable: isServerError || isTimeout || isRateLimit
    }, { status: responseStatus }),
    logged: true
  };
}

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

    const { cvText, jobDescription, analysis, preserveSections } = body || {};

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

    // Log the request details
    logger.info('CV optimization request received', { 
      textLength: cvText.length,
      jobDescriptionLength: jobDescription.length,
      mistralAvailable,
      openaiAvailable,
      preserveSections: !!preserveSections
    });

    // If both services are unavailable, return error
    if (!mistralAvailable && !openaiAvailable) {
      logger.error('Both Mistral and OpenAI services are unavailable');
      return NextResponse.json({ 
        success: false, 
        error: 'AI services are unavailable',
        details: 'Both Mistral and OpenAI services are not properly configured. Please check your API keys.',
        serviceUnavailable: true
      }, { status: 503 });
    }

    // If Mistral is available and no analysis was provided, get analysis first
    let cvAnalysis = analysis;
    if (mistralAvailable && !cvAnalysis) {
      try {
        logger.info('Analyzing CV content with Mistral AI');
        cvAnalysis = await analyzeCVContent(cvText);
        logger.info('CV analysis completed successfully with Mistral AI');
      } catch (mistralError) {
        logger.error('Error analyzing CV with Mistral AI:', mistralError instanceof Error ? mistralError.message : String(mistralError));
        
        // Continue without Mistral analysis
        logger.info('Continuing without Mistral analysis');
      }
    }

    // If OpenAI is available, use it for optimization
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
          matchScore: optimizationResult.matchScore,
          cvAnalysis: cvAnalysis
        });
      } catch (openaiError) {
        // Use the helper function to format the error response
        const { response } = formatErrorResponse(openaiError, 503);
        return response;
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
  } catch (error) {
    // Use the helper function to format the error response
    const { response } = formatErrorResponse(error);
    return response;
  }
} 