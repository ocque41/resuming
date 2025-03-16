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
 * Start the optimization process in the background
 * This function doesn't wait for the process to complete
 */
async function startOptimizationProcess(
  userId: string,
  cvId: string,
  jobDescription: string,
  textToOptimize: string,
  options: any
) {
  try {
    // Store initial progress update with a visible 5% progress
    storePartialResults(userId, cvId, jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 5,
      state: {
        stage: OptimizationStage.NOT_STARTED,
        progress: 5
      }
    });
    
    // Log the start of the optimization process
    logger.info(`Starting background optimization process for CV ${cvId}`);
    
    // Start the optimization process without awaiting it
    optimizeCV(userId, cvId, jobDescription, textToOptimize, options)
      .then(result => {
        logger.info(`Background optimization completed for CV ${cvId}`);
      })
      .catch(error => {
        logger.error(`Background optimization error for CV ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
        storePartialResultsError(userId, cvId, jobDescription, 
          `Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    
    return true;
  } catch (error) {
    logger.error(`Error starting background optimization: ${error instanceof Error ? error.message : String(error)}`);
    storePartialResultsError(userId, cvId, jobDescription, 
      `Failed to start optimization: ${error instanceof Error ? error.message : String(error)}`);
    return false;
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
    
    // Store initial progress update with a visible 5% progress
    storePartialResults(user.id.toString(), cvId.toString(), jobDescription, {
      optimizedContent: '',
      matchScore: 0,
      recommendations: [],
      progress: 5,
      state: {
        stage: OptimizationStage.NOT_STARTED,
        progress: 5
      }
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

    // Start the optimization process in the background
    const started = await startOptimizationProcess(
      user.id.toString(),
      cvId.toString(),
      jobDescription,
      textToOptimize,
      {
        preserveSections,
        documentFormat: documentFormat || 'markdown'
      }
    );
    
    if (!started) {
      return formatErrorResponse('Failed to start optimization process', 500);
    }
    
    // Return a quick response to the client
    return NextResponse.json({
      success: true,
      message: 'Optimization process started',
      status: 'processing',
      progress: 5,
      stage: OptimizationStage.NOT_STARTED
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
} 