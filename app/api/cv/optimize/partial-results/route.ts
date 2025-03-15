import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { getPartialResults } from '@/app/utils/partialResultsCache';

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication using the same method as the optimize route
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to partial-results endpoint');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { cvId, jobDescription } = body;

    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }

    // Get partial results from cache
    const userId = user.id.toString();
    const partialResults = getPartialResults(userId, cvId, jobDescription);

    if (!partialResults) {
      return NextResponse.json({ 
        success: false,
        message: 'No partial results available yet',
        partialResults: null
      });
    }

    // Return the partial results
    return NextResponse.json({ 
      success: true,
      message: 'Partial results retrieved successfully',
      partialResults
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error retrieving partial results:', errorMessage);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to retrieve partial results',
      details: errorMessage
    }, { status: 500 });
  }
} 