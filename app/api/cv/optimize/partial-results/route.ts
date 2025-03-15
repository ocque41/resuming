import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
    // Check authentication
    const session = await getServerSession() as UserSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { cvId, jobDescription } = body;

    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }

    // Get partial results from cache
    const userId = session.user.id;
    const partialResults = getPartialResults(userId, cvId, jobDescription);

    if (!partialResults) {
      return NextResponse.json({ 
        message: 'No partial results available yet',
        partialResults: null
      });
    }

    // Return the partial results
    return NextResponse.json({ 
      message: 'Partial results retrieved successfully',
      partialResults
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error retrieving partial results:', errorMessage);
    return NextResponse.json({ 
      error: 'Failed to retrieve partial results',
      details: errorMessage
    }, { status: 500 });
  }
} 