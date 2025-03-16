import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/auth';
import { getPartialResults } from '@/app/utils/partialResultsCache';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to partial results API');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { cvId, jobDescription } = body;

    if (!cvId) {
      return NextResponse.json(
        { success: false, error: 'CV ID is required' },
        { status: 400 }
      );
    }

    // Get partial results
    const partialResults = getPartialResults(user.id.toString(), cvId.toString(), jobDescription);

    if (!partialResults) {
      // If no results yet, return a 202 Accepted status to indicate the request is valid
      // but processing is still ongoing with no results yet
      return NextResponse.json(
        { 
          success: true, 
          progress: 0,
          message: 'Optimization in progress, no results available yet',
          optimizationState: null,
          partialResults: null
        },
        { status: 202 }
      );
    }

    // Use the progress directly from the partial results
    const progress = partialResults.progress || 0;
    
    // Determine status message based on progress
    let statusMessage = 'Optimization in progress';
    if (progress < 10) {
      statusMessage = 'Starting optimization process';
    } else if (progress < 30) {
      statusMessage = 'Analyzing CV content';
    } else if (progress < 70) {
      statusMessage = 'Optimizing CV content';
    } else if (progress < 90) {
      statusMessage = 'Generating optimized document';
    } else if (progress >= 100) {
      statusMessage = 'Optimization complete';
    }
    
    // Check for errors in partial results
    if (partialResults.error) {
      logger.warn(`Error in partial results for CV ${cvId}: ${partialResults.error}`);
      
      // If we have substantial progress, return the partial results with a warning
      if (progress > 30 && partialResults.optimizedContent) {
        return NextResponse.json({
          success: true,
          progress,
          message: statusMessage,
          warning: partialResults.error,
          optimizationState: partialResults.state,
          partialResults
        });
      }
      
      // Otherwise, return an error
      return NextResponse.json({
        success: false,
        error: partialResults.error,
        progress,
        optimizationState: partialResults.state,
        partialResults
      }, { status: 500 });
    }

    // Return successful response with partial results
    return NextResponse.json({
      success: true,
      progress,
      message: statusMessage,
      optimizationState: partialResults.state,
      partialResults
    });
  } catch (error) {
    logger.error('Error fetching partial results:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partial results' },
      { status: 500 }
    );
  }
} 