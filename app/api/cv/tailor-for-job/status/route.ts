export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { kv } from '@vercel/kv';

// Define status endpoint for client polling
/**
 * Get the status of a CV tailoring job
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to tailor-for-job/status API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get jobId from query parameters
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      logger.error('Missing jobId parameter in tailor-for-job/status request');
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    // Get job status from KV store
    const [status, progress, result, error, startTime, completedAt] = await Promise.all([
      kv.get(`tailor:${jobId}:status`),
      kv.get(`tailor:${jobId}:progress`),
      kv.get(`tailor:${jobId}:result`),
      kv.get(`tailor:${jobId}:error`),
      kv.get(`tailor:${jobId}:startTime`),
      kv.get(`tailor:${jobId}:completedAt`)
    ]);

    // Calculate duration if available
    let duration = null;
    if (startTime) {
      if (completedAt) {
        duration = Number(completedAt) - Number(startTime);
      } else {
        duration = Date.now() - Number(startTime);
      }
    }

    // If job is completed and result is available, return the tailored CV
    if (status === 'completed' && result) {
      logger.info(`Retrieved completed job ${jobId} result`);
      return NextResponse.json({
        success: true,
        status,
        progress: 100,
        result,
        duration
      });
    }

    // If job failed, return the error
    if (status === 'error') {
      logger.warn(`Retrieved failed job ${jobId} status: ${error}`);
      return NextResponse.json({
        success: false,
        status,
        error: error || 'Unknown error',
        duration
      });
    }

    // Job is still processing
    return NextResponse.json({
      success: true,
      status: status || 'unknown',
      progress: progress || 0,
      duration
    });
  } catch (error) {
    logger.error('Error in tailor-for-job/status API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 