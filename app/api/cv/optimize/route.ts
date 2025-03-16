import { NextRequest, NextResponse } from 'next/server';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { isOpenAIAvailable } from '@/lib/services/openai.service';
import { clearPartialResults, storePartialResults, getPartialResults, storePartialResultsError } from '@/app/utils/partialResultsCache';
import { optimizeCV } from '@/lib/services/openaiOptimizer';
import { OptimizationStage } from '@/lib/services/progressiveOptimization';

/**
 * Format error response
 */
function formatErrorResponse(error: unknown, statusCode: number = 500) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Error in optimize endpoint: ${errorMessage}`);
  
  // Check if the error is related to service unavailability
  const isServiceUnavailable = 
    errorMessage.includes('not available') || 
    errorMessage.includes('not configured') || 
    errorMessage.includes('Authentication failed') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests');
  
  return NextResponse.json(
    { 
      success: false, 
      error: 'Failed to optimize CV',
      details: errorMessage,
      serviceUnavailable: isServiceUnavailable
    },
    { status: isServiceUnavailable ? 503 : statusCode }
  );
}

/**
 * Fetch CV text from the database
 */
async function fetchCVText(cvId: string): Promise<string> {
  try {
    // Get user
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Get all CVs for the user
    const cvs = await getCVsForUser(user.id);
    
    // Find the specific CV by ID
    const cv = cvs.find(cv => cv.id === parseInt(cvId));
    
    if (!cv) {
      throw new Error(`CV with ID ${cvId} not found`);
    }
    
    if (!cv.rawText) {
      throw new Error(`No text available for CV with ID ${cvId}`);
    }
    
    return cv.rawText;
  } catch (error) {
    logger.error(`Error fetching CV text: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to fetch CV text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * API endpoint for optimizing a CV
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to optimize endpoint');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error(`Error parsing request body: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 });
    }
    
    const { 
      cvId, 
      jobDescription, 
      includeKeywords, 
      cvText,
      preserveSections,
      documentFormat
    } = body;

    // Validate input
    if (!cvId) {
      logger.error('Missing cvId parameter in optimize request');
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    // Log the request
    logger.info(`Optimize request received for CV ${cvId} from user ${user.id}`);
    
    // Clear any existing partial results
    clearPartialResults(user.id.toString(), cvId.toString(), jobDescription);
    
    // Store initial progress update
    storePartialResults(user.id.toString(), cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 0
    });

    // Get CV text if not provided
    let textToOptimize = cvText;
    if (!textToOptimize) {
      try {
        textToOptimize = await fetchCVText(cvId);
      } catch (fetchError) {
        logger.error(`Error fetching CV text: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
        return formatErrorResponse(fetchError, 404);
      }
    }

    // Check if OpenAI is available
    let openaiAvailable = false;
    
    try {
      openaiAvailable = await isOpenAIAvailable();
    } catch (openaiError) {
      logger.warn(`Error checking OpenAI availability: ${openaiError instanceof Error ? openaiError.message : String(openaiError)}`);
    }

    if (!openaiAvailable) {
      logger.error('OpenAI service is unavailable');
      return formatErrorResponse(
        'AI service is currently unavailable. Please try again later.',
        503
      );
    }

    // Set a timeout for the optimization process
    const timeoutMs = 120000; // 2 minutes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Optimization timed out')), timeoutMs);
    });
    
    // Run the optimization process with timeout
    const optimizationPromise = optimizeCV(
      user.id.toString(),
      cvId.toString(),
      jobDescription,
      textToOptimize,
      {
        preserveSections,
        documentFormat: documentFormat || 'markdown'
      }
    );
    
    // Wait for either the optimization to complete or the timeout
    try {
      const result = await Promise.race([optimizationPromise, timeoutPromise])
        .catch(error => {
          logger.error(`Optimization error or timeout: ${error instanceof Error ? error.message : String(error)}`);
          
          // Check if we have partial results
          const partialResults = getPartialResults(user.id.toString(), cvId.toString(), jobDescription);
          
          // If we have substantial partial results, return them
          if (partialResults && partialResults.progress > 30) {
            logger.info(`Returning partial results for CV ${cvId} with progress ${partialResults.progress}%`);
            return {
              success: true,
              message: 'Partial optimization results available',
              result: partialResults,
              isPartial: true
            };
          }
          
          // Otherwise, store the error and return failure
          storePartialResultsError(user.id.toString(), cvId.toString(), jobDescription, 
            error instanceof Error ? error.message : String(error));
          
          throw error;
        });
      
      // Return the result
      return NextResponse.json(result);
    } catch (error) {
      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for JSON parsing errors
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('not valid JSON')) {
        logger.error(`JSON parsing error during optimization: ${errorMessage}`);
        
        // Check if we have partial results
        const partialResults = getPartialResults(user.id.toString(), cvId.toString(), jobDescription);
        
        if (partialResults && partialResults.progress > 0) {
          logger.info(`Returning partial results despite JSON error for CV ${cvId}`);
          return NextResponse.json({
            success: true,
            message: 'Partial optimization results available (API error occurred)',
            result: partialResults,
            isPartial: true,
            error: 'An API error occurred during optimization, but partial results are available'
          });
        }
      }
      
      // Handle timeout errors
      if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
        logger.error(`Optimization timed out for CV ${cvId}`);
        
        // Check if we have partial results
        const partialResults = getPartialResults(user.id.toString(), cvId.toString(), jobDescription);
        
        if (partialResults && partialResults.progress > 0) {
          logger.info(`Returning partial results after timeout for CV ${cvId}`);
          return NextResponse.json({
            success: true,
            message: 'Partial optimization results available (timeout occurred)',
            result: partialResults,
            isPartial: true,
            error: 'The optimization process timed out, but partial results are available'
          });
        }
      }
      
      return formatErrorResponse(error);
    }
  } catch (error) {
    return formatErrorResponse(error);
  }
} 