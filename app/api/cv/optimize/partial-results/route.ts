import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logger } from '@/lib/logger';

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

// In-memory cache for partial results
// In a production environment, this should be replaced with Redis or another distributed cache
const partialResultsCache: Record<string, any> = {};

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

    // Generate a unique key for this optimization request
    const userId = session.user.id;
    const cacheKey = `${userId}:${cvId}:${jobDescription.substring(0, 50)}`;

    // Check if we have partial results for this request
    const partialResults = partialResultsCache[cacheKey];

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

// Helper function to store partial results (called from the optimization endpoint)
export function storePartialResults(userId: string, cvId: string, jobDescription: string, results: any) {
  const cacheKey = `${userId}:${cvId}:${jobDescription.substring(0, 50)}`;
  partialResultsCache[cacheKey] = results;
  
  // Set an expiration for the cache entry (30 minutes)
  setTimeout(() => {
    delete partialResultsCache[cacheKey];
  }, 30 * 60 * 1000);
}

// Helper function to clear partial results (called when optimization completes)
export function clearPartialResults(userId: string, cvId: string, jobDescription: string) {
  const cacheKey = `${userId}:${cvId}:${jobDescription.substring(0, 50)}`;
  delete partialResultsCache[cacheKey];
} 