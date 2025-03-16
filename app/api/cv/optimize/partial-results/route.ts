import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/auth';
import { getPartialResults } from '@/lib/services/partialResults';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();
    if (!user) {
      console.warn('Unauthorized access attempt to partial results API');
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
    const partialResults = await getPartialResults(user.id.toString(), cvId.toString());

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

    // Calculate progress based on the current stage
    let progress = 0;
    const stage = partialResults.optimizationState?.stage;

    if (stage) {
      // Simplified progress calculation
      if (stage.startsWith('ANALYZE_')) {
        // Analysis stage (0-30%)
        progress = 30;
      } else if (stage.startsWith('OPTIMIZE_')) {
        // Optimization stage (30-70%)
        progress = 70;
      } else if (stage.startsWith('GENERATE_')) {
        // Generation stage (70-100%)
        progress = stage.includes('COMPLETED') ? 100 : 90;
      }
    }

    return NextResponse.json({
      success: true,
      progress,
      optimizationState: partialResults.optimizationState,
      partialResults
    });
  } catch (error) {
    console.error('Error fetching partial results:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch partial results' },
      { status: 500 }
    );
  }
} 