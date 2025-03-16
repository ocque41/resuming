import { NextRequest, NextResponse } from 'next/server';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { isOpenAIAvailable } from '@/lib/services/openai.service';
import { isMistralAvailable } from '@/lib/services/mistral.service';
import { clearPartialResults, storePartialResults, getPartialResults, storePartialResultsError } from '@/app/utils/partialResultsCache';
import { optimizeCVProgressively, resumeOptimization } from '@/lib/services/progressiveOptimizer';
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
    const body = await req.json();
    const { 
      cvId, 
      jobDescription, 
      includeKeywords, 
      cvText,
      preserveSections,
      useSimplifiedProcess,
      maxRetries,
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

    // Check if AI services are available
    const openaiAvailable = await isOpenAIAvailable();
    const mistralAvailable = await isMistralAvailable();
    
    if (!openaiAvailable && !mistralAvailable) {
      const error = 'Both OpenAI and Mistral AI services are not available';
      logger.error(error);
      storePartialResultsError(user.id.toString(), cvId.toString(), jobDescription, error);
      return NextResponse.json({ 
        success: false, 
        error,
        serviceUnavailable: true
      }, { status: 503 });
    }
    
    // Determine if we should use simplified process
    const shouldUseSimplifiedProcess = useSimplifiedProcess || 
      (textToOptimize.length > 10000 && jobDescription.length > 2000);
    
    // Set a timeout for the optimization process
    const timeoutMs = 120000; // 2 minutes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Optimization timed out')), timeoutMs);
    });
    
    // Run the optimization process with timeout
    const optimizationPromise = optimizeCVProgressively(
      user.id.toString(),
      cvId.toString(),
      jobDescription,
      textToOptimize,
      {
        preserveSections,
        documentFormat: documentFormat || 'markdown',
        maxRetries: maxRetries || 2,
        useSimplifiedProcess: shouldUseSimplifiedProcess
      }
    );
    
    // Wait for either the optimization to complete or the timeout
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
    return formatErrorResponse(error);
  }
} 