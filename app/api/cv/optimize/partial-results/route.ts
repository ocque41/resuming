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
      return NextResponse.json(
        { 
          success: true, 
          progress: 0,
          optimizationState: null,
          partialResults: null
        }
      );
    }

    // Use the progress directly from the partial results
    const progress = partialResults.progress || 0;

    return NextResponse.json({
      success: true,
      progress,
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