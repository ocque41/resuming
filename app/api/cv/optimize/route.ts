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
import { storePartialResults, clearPartialResults } from '@/app/utils/partialResultsCache';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Constants for text chunking
const MAX_CV_LENGTH = 6000; // Maximum CV length before chunking
const MAX_JOB_DESCRIPTION_LENGTH = 4000; // Maximum job description length before chunking

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
 * Helper function to chunk text if it's too large
 * This helps prevent timeouts for very large inputs
 */
function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  
  logger.info(`Chunking text of length ${text.length} into smaller pieces (max: ${maxLength})`);
  
  // Try to split at paragraph boundaries
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max length, start a new chunk
    if (currentChunk.length + paragraph.length + 2 > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      // Otherwise, add to the current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n';
      }
      currentChunk += paragraph;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  logger.info(`Text chunked into ${chunks.length} pieces`);
  return chunks;
}

/**
 * Helper function to optimize CV with chunking for large inputs
 */
async function optimizeWithChunking(
  cvText: string, 
  jobDescription: string, 
  cvAnalysis: any,
  openaiAvailable: boolean,
  preserveSections: any,
  userId?: string,
  cvId?: string
): Promise<any> {
  // Check if we need to chunk the CV or job description
  const cvChunks = chunkText(cvText, MAX_CV_LENGTH);
  const jobChunks = chunkText(jobDescription, MAX_JOB_DESCRIPTION_LENGTH);
  
  // If no chunking is needed, proceed with normal optimization
  if (cvChunks.length === 1 && jobChunks.length === 1) {
    logger.info('No chunking needed, proceeding with normal optimization');
    
    if (cvAnalysis) {
      // Use Mistral analysis with GPT-4o
      return await optimizeCVWithGPT4o(cvText, jobDescription, cvAnalysis);
    } else {
      // Use GPT-4o fallback without Mistral analysis
      logger.info('Using GPT-4o fallback without Mistral analysis');
      return await optimizeCVWithGPT4oFallback(cvText, jobDescription);
    }
  }
  
  // If chunking is needed, we need to optimize each chunk separately
  logger.info(`Optimizing with chunking: ${cvChunks.length} CV chunks, ${jobChunks.length} job description chunks`);
  
  // For simplicity, we'll use the first job chunk for optimization if there are multiple
  const jobChunkToUse = jobChunks[0];
  
  // Optimize the first CV chunk with the job description
  let optimizationResult;
  if (cvAnalysis) {
    optimizationResult = await optimizeCVWithGPT4o(cvChunks[0], jobChunkToUse, cvAnalysis);
  } else {
    optimizationResult = await optimizeCVWithGPT4oFallback(cvChunks[0], jobChunkToUse);
  }
  
  // Store partial results if userId and cvId are provided
  if (userId && cvId) {
    storePartialResults(userId, cvId, jobDescription, {
      optimizedContent: optimizationResult.optimizedContent,
      matchScore: optimizationResult.matchScore || 0,
      recommendations: optimizationResult.recommendations || [],
      progress: Math.round((1 / cvChunks.length) * 100)
    });
  }
  
  // If there are multiple CV chunks, optimize them separately and combine
  if (cvChunks.length > 1) {
    let combinedContent = optimizationResult.optimizedContent;
    
    // For each additional chunk, optimize and append
    for (let i = 1; i < cvChunks.length; i++) {
      logger.info(`Optimizing CV chunk ${i+1} of ${cvChunks.length}`);
      
      let chunkResult;
      if (cvAnalysis) {
        chunkResult = await optimizeCVWithGPT4o(cvChunks[i], jobChunkToUse, cvAnalysis);
      } else {
        chunkResult = await optimizeCVWithGPT4oFallback(cvChunks[i], jobChunkToUse);
      }
      
      // Append the optimized content, ensuring there's a paragraph break
      combinedContent += '\n\n' + chunkResult.optimizedContent;
    }
    
    // Update the optimized content in the result
    optimizationResult.optimizedContent = combinedContent;
  }
  
  return optimizationResult;
}

/**
 * Fetches CV text from the database using the CV ID
 */
async function fetchCVText(cvId: string): Promise<string> {
  try {
    const cv = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
      columns: {
        rawText: true
      }
    });

    if (!cv || !cv.rawText) {
      throw new Error(`CV with ID ${cvId} not found or has no content`);
    }

    return cv.rawText;
  } catch (error) {
    logger.error(`Error fetching CV text for ID ${cvId}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to retrieve CV text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * API endpoint for optimizing CV content for a specific job using Mistral AI for analysis and GPT-4o for optimization
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
    const { cvId, jobDescription, includeKeywords = false, cvText, preserveSections = {} } = body;

    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }

    // Clear any existing partial results for this CV
    const userId = user.id.toString();
    clearPartialResults(userId, cvId, jobDescription);

    // Check if AI services are available
    const mistralAvailable = await isMistralAvailable();
    const openaiAvailable = await isOpenAIAvailable();
    
    if (!mistralAvailable && !openaiAvailable) {
      logger.error('AI services are not available');
      return NextResponse.json({ error: 'AI services are not available' }, { status: 503 });
    }

    // Log request details
    logger.info(`Optimizing CV ${cvId} for user ${userId}`);

    try {
      // Get CV text if not provided
      let actualCvText = cvText;
      if (!actualCvText) {
        // Here you would fetch the CV text from the database using cvId
        // This is a placeholder - implement the actual CV text retrieval
        logger.info(`Fetching CV text for CV ID ${cvId}`);
        actualCvText = await fetchCVText(cvId);
      }

      // Get CV analysis if Mistral is available
      let cvAnalysis = null;
      if (mistralAvailable && actualCvText) {
        try {
          logger.info('Analyzing CV content with Mistral AI');
          cvAnalysis = await analyzeCVContent(actualCvText);
          logger.info('CV analysis completed successfully with Mistral AI');
        } catch (mistralError) {
          logger.error('Error analyzing CV with Mistral AI:', mistralError instanceof Error ? mistralError.message : String(mistralError));
          logger.info('Continuing without Mistral analysis');
        }
      }

      // Optimize CV
      const result = await optimizeWithChunking(
        actualCvText, 
        jobDescription, 
        cvAnalysis,
        openaiAvailable,
        preserveSections,
        userId,
        cvId
      );
      
      return NextResponse.json(result);
    } catch (error) {
      // Handle specific error types
      if (error instanceof Error) {
        logger.error(`CV optimization error: ${error.message}`);
        
        // Check for rate limit errors
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          return NextResponse.json({ 
            error: 'Rate limit exceeded. Please try again later.',
            details: error.message
          }, { status: 429 });
        }
        
        // Check for JSON parsing errors
        if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          logger.error('JSON parsing error in CV optimization:', error.message);
          return NextResponse.json({ 
            error: 'Error processing AI response. Please try again.',
            details: 'The system encountered an error while processing the AI response.'
          }, { status: 500 });
        }
      }
      
      // Generic error response
      return NextResponse.json({ 
        error: 'Failed to optimize CV',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in optimize endpoint:', errorMessage);
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
} 