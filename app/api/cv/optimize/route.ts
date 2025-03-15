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
 * API endpoint for optimizing CV content for a specific job using Mistral AI for analysis and GPT-4o for optimization
 */
export async function POST(req: NextRequest) {
  try {
    // Get the user from the session
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { cvText, jobDescription, preserveSections = {}, cvId } = body;

    if (!cvText || !jobDescription) {
      return NextResponse.json({ error: 'CV text and job description are required' }, { status: 400 });
    }

    // Clear any existing partial results
    if (cvId) {
      clearPartialResults(user.id.toString(), cvId, jobDescription);
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
    let cvAnalysis = null;
    if (mistralAvailable) {
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

    // Optimize the CV
    let optimizationResult;
    try {
      optimizationResult = await optimizeWithChunking(
        cvText, 
        jobDescription, 
        cvAnalysis, 
        openaiAvailable,
        preserveSections,
        user.id.toString(),
        cvId
      );
    } catch (error) {
      return formatErrorResponse(error).response;
    }

    // Clear partial results as we now have the full result
    if (cvId) {
      clearPartialResults(user.id.toString(), cvId, jobDescription);
    }

    return NextResponse.json({
      success: true,
      optimizedContent: optimizationResult.optimizedContent,
      matchAnalysis: optimizationResult.matchAnalysis,
      recommendations: optimizationResult.recommendations,
      matchScore: optimizationResult.matchScore,
      cvAnalysis: cvAnalysis
    });
  } catch (error) {
    // Use the helper function to format the error response
    const { response } = formatErrorResponse(error);
    return response;
  }
} 