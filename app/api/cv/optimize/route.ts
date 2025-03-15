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
import { storePartialResults, clearPartialResults, getPartialResults } from '@/app/utils/partialResultsCache';
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
    
    // Store initial progress
    if (userId && cvId) {
      storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: "Optimization in progress...",
        matchScore: 0,
        recommendations: ["Optimization in progress..."],
        progress: 10
      });
    }
    
    try {
      let result;
      if (cvAnalysis) {
        // Use Mistral analysis with GPT-4o
        result = await optimizeCVWithGPT4o(cvText, jobDescription, cvAnalysis);
      } else {
        // Use GPT-4o fallback without Mistral analysis
        logger.info('Using GPT-4o fallback without Mistral analysis');
        result = await optimizeCVWithGPT4oFallback(cvText, jobDescription);
      }
      
      // Store final result as partial result with 100% progress
      if (userId && cvId) {
        storePartialResults(userId, cvId, jobDescription, {
          optimizedContent: result.optimizedContent,
          matchScore: result.matchScore || 0,
          recommendations: result.recommendations || [],
          progress: 100
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error in optimization:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  // If chunking is needed, we need to optimize each chunk separately
  logger.info(`Optimizing with chunking: ${cvChunks.length} CV chunks, ${jobChunks.length} job description chunks`);
  
  // For simplicity, we'll use the first job chunk for optimization if there are multiple
  const jobChunkToUse = jobChunks[0];
  
  // Store initial progress
  if (userId && cvId) {
    storePartialResults(userId, cvId, jobDescription, {
      optimizedContent: "Starting optimization process...",
      matchScore: 0,
      recommendations: ["Optimization in progress..."],
      progress: 5
    });
  }
  
  try {
    // Optimize the first CV chunk with the job description
    logger.info(`Optimizing CV chunk 1 of ${cvChunks.length}`);
    
    // Update progress to 10% before starting first chunk
    if (userId && cvId) {
      storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: "Processing first section of CV...",
        matchScore: 0,
        recommendations: ["Optimization in progress..."],
        progress: 10
      });
    }
    
    let optimizationResult;
    if (cvAnalysis) {
      optimizationResult = await optimizeCVWithGPT4o(cvChunks[0], jobChunkToUse, cvAnalysis);
    } else {
      optimizationResult = await optimizeCVWithGPT4oFallback(cvChunks[0], jobChunkToUse);
    }
    
    // Store partial results if userId and cvId are provided
    if (userId && cvId) {
      const progressPerChunk = 90 / cvChunks.length; // Reserve 10% for initial setup
      const currentProgress = 10 + progressPerChunk; // First chunk complete
      
      storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: optimizationResult.optimizedContent,
        matchScore: optimizationResult.matchScore || 0,
        recommendations: optimizationResult.recommendations || [],
        progress: Math.round(currentProgress)
      });
    }
    
    // If there are multiple CV chunks, optimize them separately and combine
    if (cvChunks.length > 1) {
      let combinedContent = optimizationResult.optimizedContent;
      
      // For each additional chunk, optimize and append
      for (let i = 1; i < cvChunks.length; i++) {
        logger.info(`Optimizing CV chunk ${i+1} of ${cvChunks.length}`);
        
        // Update progress before starting next chunk
        if (userId && cvId) {
          const progressPerChunk = 90 / cvChunks.length;
          const currentProgress = 10 + (progressPerChunk * i);
          
          storePartialResults(userId, cvId, jobDescription, {
            optimizedContent: combinedContent,
            matchScore: optimizationResult.matchScore || 0,
            recommendations: optimizationResult.recommendations || [],
            progress: Math.round(currentProgress)
          });
        }
        
        try {
          let chunkResult;
          if (cvAnalysis) {
            chunkResult = await optimizeCVWithGPT4o(cvChunks[i], jobChunkToUse, cvAnalysis);
          } else {
            chunkResult = await optimizeCVWithGPT4oFallback(cvChunks[i], jobChunkToUse);
          }
          
          // Append the optimized content, ensuring there's a paragraph break
          combinedContent += '\n\n' + chunkResult.optimizedContent;
          
          // Update progress after completing this chunk
          if (userId && cvId) {
            const progressPerChunk = 90 / cvChunks.length;
            const currentProgress = 10 + (progressPerChunk * (i + 1));
            
            storePartialResults(userId, cvId, jobDescription, {
              optimizedContent: combinedContent,
              matchScore: optimizationResult.matchScore || 0,
              recommendations: optimizationResult.recommendations || [],
              progress: Math.round(currentProgress)
            });
          }
        } catch (chunkError) {
          // Log the error but continue with what we have so far
          logger.error(`Error optimizing chunk ${i+1}:`, chunkError instanceof Error ? chunkError.message : String(chunkError));
          
          // Store partial results with a note about the error
          if (userId && cvId) {
            const progressPerChunk = 90 / cvChunks.length;
            const currentProgress = 10 + (progressPerChunk * (i + 0.5)); // Half credit for failed chunk
            
            storePartialResults(userId, cvId, jobDescription, {
              optimizedContent: combinedContent + '\n\n[Error: Could not optimize this section of the CV]',
              matchScore: optimizationResult.matchScore || 0,
              recommendations: [...(optimizationResult.recommendations || []), "Some sections could not be optimized due to an error."],
              progress: Math.round(currentProgress)
            });
          }
        }
      }
      
      // Update the optimized content in the result
      optimizationResult.optimizedContent = combinedContent;
      
      // Final progress update
      if (userId && cvId) {
        storePartialResults(userId, cvId, jobDescription, {
          optimizedContent: combinedContent,
          matchScore: optimizationResult.matchScore || 0,
          recommendations: optimizationResult.recommendations || [],
          progress: 100
        });
      }
    }
    
    return optimizationResult;
  } catch (error) {
    logger.error('Error in chunked optimization:', error instanceof Error ? error.message : String(error));
    
    // If we have partial results, return those instead of failing completely
    if (userId && cvId) {
      const partialResults = getPartialResults(userId, cvId, jobDescription);
      if (partialResults && partialResults.optimizedContent) {
        logger.info('Returning partial results due to optimization error');
        return {
          optimizedContent: partialResults.optimizedContent,
          matchScore: partialResults.matchScore || 0,
          recommendations: [...(partialResults.recommendations || []), "Optimization was incomplete due to an error."],
          partial: true
        };
      }
    }
    
    throw error;
  }
}

/**
 * Simplified optimization for very large CVs or when the system is under heavy load
 * This uses a more direct approach with fewer steps and less complex analysis
 */
async function simplifiedOptimization(
  cvText: string,
  jobDescription: string,
  userId?: string,
  cvId?: string
): Promise<any> {
  logger.info('Using simplified optimization process');
  
  // Store initial progress
  if (userId && cvId) {
    storePartialResults(userId, cvId, jobDescription, {
      optimizedContent: "Starting simplified optimization...",
      matchScore: 0,
      recommendations: ["Using simplified optimization process..."],
      progress: 10
    });
  }
  
  try {
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    if (!openaiAvailable) {
      throw new Error('OpenAI service is not available for simplified optimization');
    }
    
    // Update progress
    if (userId && cvId) {
      storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: "Analyzing CV and job description...",
        matchScore: 0,
        recommendations: ["Using simplified optimization process..."],
        progress: 30
      });
    }
    
    // Use the combined analyze and optimize function from OpenAI
    // This does everything in one call instead of separate analysis and optimization steps
    const result = await analyzeAndOptimizeCVWithGPT4o(cvText, jobDescription);
    
    // Update progress to complete
    if (userId && cvId) {
      storePartialResults(userId, cvId, jobDescription, {
        optimizedContent: result.optimizedContent,
        matchScore: result.matchScore || 0,
        recommendations: result.recommendations || [],
        progress: 100
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Error in simplified optimization:', error instanceof Error ? error.message : String(error));
    throw error;
  }
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
    const { 
      cvId, 
      jobDescription, 
      includeKeywords = false, 
      cvText, 
      preserveSections = {},
      useSimplifiedProcess = false // New parameter to request simplified processing
    } = body;

    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }

    // Clear any existing partial results for this CV
    const userId = user.id.toString();
    clearPartialResults(userId, cvId, jobDescription);
    
    // Store initial progress
    storePartialResults(userId, cvId, jobDescription, {
      optimizedContent: "Starting optimization process...",
      matchScore: 0,
      recommendations: ["Optimization in progress..."],
      progress: 5
    });

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
        
        // Update progress after fetching CV text
        storePartialResults(userId, cvId, jobDescription, {
          optimizedContent: "CV text retrieved, starting analysis...",
          matchScore: 0,
          recommendations: ["Optimization in progress..."],
          progress: 10
        });
      }
      
      // Check if we should use the simplified process
      // This can be explicitly requested or automatically determined based on CV size
      const shouldUseSimplifiedProcess = useSimplifiedProcess || 
                                        actualCvText.length > MAX_CV_LENGTH * 2 || 
                                        jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH * 2;
      
      let result;
      if (shouldUseSimplifiedProcess) {
        // Use the simplified process for very large CVs or when explicitly requested
        result = await simplifiedOptimization(
          actualCvText,
          jobDescription,
          userId,
          cvId
        );
      } else {
        // Get CV analysis if Mistral is available
        let cvAnalysis = null;
        if (mistralAvailable) {
          try {
            logger.info('Analyzing CV content with Mistral AI');
            cvAnalysis = await analyzeCVContent(actualCvText);
            logger.info('CV analysis completed successfully with Mistral AI');
            
            // Update progress after CV analysis
            storePartialResults(userId, cvId, jobDescription, {
              optimizedContent: "CV analysis complete, starting optimization...",
              matchScore: 0,
              recommendations: ["Optimization in progress..."],
              progress: 20
            });
          } catch (mistralError) {
            logger.error('Error analyzing CV with Mistral AI:', mistralError instanceof Error ? mistralError.message : String(mistralError));
            logger.info('Continuing without Mistral analysis');
            
            // Update progress, noting the analysis error
            storePartialResults(userId, cvId, jobDescription, {
              optimizedContent: "CV analysis failed, continuing with optimization...",
              matchScore: 0,
              recommendations: ["CV analysis failed, but optimization will continue."],
              progress: 15
            });
          }
        }

        // Optimize CV using the standard process
        result = await optimizeWithChunking(
          actualCvText, 
          jobDescription, 
          cvAnalysis,
          openaiAvailable,
          preserveSections,
          userId,
          cvId
        );
      }
      
      // Clear partial results as we now have the full result
      clearPartialResults(userId, cvId, jobDescription);
      
      return NextResponse.json(result);
    } catch (error) {
      // Handle specific error types
      if (error instanceof Error) {
        logger.error(`CV optimization error: ${error.message}`);
        
        // Check for rate limit errors
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          // Check if we have partial results to return
          const partialResults = getPartialResults(userId, cvId, jobDescription);
          if (partialResults && partialResults.optimizedContent && partialResults.progress > 30) {
            // If we have substantial partial results, return them with a warning
            logger.info('Returning partial results due to rate limit error');
            return NextResponse.json({ 
              optimizedContent: partialResults.optimizedContent,
              matchScore: partialResults.matchScore || 0,
              recommendations: [...(partialResults.recommendations || []), "Optimization was incomplete due to rate limiting."],
              partial: true,
              error: 'Rate limit exceeded. Returning partial results.',
              progress: partialResults.progress
            }, { status: 200 }); // Return 200 with partial results
          }
          
          return NextResponse.json({ 
            error: 'Rate limit exceeded. Please try again later.',
            details: error.message
          }, { status: 429 });
        }
        
        // Check for JSON parsing errors
        if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          // Check if we have partial results to return
          const partialResults = getPartialResults(userId, cvId, jobDescription);
          if (partialResults && partialResults.optimizedContent && partialResults.progress > 30) {
            // If we have substantial partial results, return them with a warning
            logger.info('Returning partial results due to JSON parsing error');
            return NextResponse.json({ 
              optimizedContent: partialResults.optimizedContent,
              matchScore: partialResults.matchScore || 0,
              recommendations: [...(partialResults.recommendations || []), "Optimization was incomplete due to a processing error."],
              partial: true,
              error: 'Error processing AI response. Returning partial results.',
              progress: partialResults.progress
            }, { status: 200 }); // Return 200 with partial results
          }
          
          logger.error('JSON parsing error in CV optimization:', error.message);
          return NextResponse.json({ 
            error: 'Error processing AI response. Please try again.',
            details: 'The system encountered an error while processing the AI response.'
          }, { status: 500 });
        }
      }
      
      // Check for any partial results before returning a generic error
      const partialResults = getPartialResults(userId, cvId, jobDescription);
      if (partialResults && partialResults.optimizedContent && partialResults.progress > 20) {
        // If we have substantial partial results, return them with a warning
        logger.info('Returning partial results due to general error');
        return NextResponse.json({ 
          optimizedContent: partialResults.optimizedContent,
          matchScore: partialResults.matchScore || 0,
          recommendations: [...(partialResults.recommendations || []), "Optimization was incomplete due to an error."],
          partial: true,
          error: 'Failed to complete optimization. Returning partial results.',
          progress: partialResults.progress
        }, { status: 200 }); // Return 200 with partial results
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