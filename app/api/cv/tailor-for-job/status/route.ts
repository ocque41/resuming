export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { jobStatus } from '@/lib/db/schema';

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

    const jobId = request.nextUrl.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    logger.info(`Checking status for job: ${jobId}`);
    
    // Get the job status from the database
    const statusRecords = await db
      .select()
      .from(jobStatus)
      .where(eq(jobStatus.jobId, jobId))
      .limit(1);
    
    if (statusRecords.length === 0) {
      logger.warn(`No status record found for job: ${jobId}`);
      return NextResponse.json(
        { 
          status: 'processing',
          message: 'Job is still initializing or not found',
          progress: 10 
        },
        { status: 200 }
      );
    }
    
    const statusRecord = statusRecords[0];
    const now = new Date();
    const createdAt = new Date(statusRecord.createdAt);
    const timeDiff = now.getTime() - createdAt.getTime();
    const minutesElapsed = Math.floor(timeDiff / 60000);
    
    // For pending or in-progress jobs, increase progress indication based on time elapsed
    if (statusRecord.status === 'pending' || statusRecord.status === 'processing') {
      // Calculate a progress value based on time elapsed (capped at 95%)
      // This gives users a sense that something is happening
      let calculatedProgress = statusRecord.progress;
      
      if (calculatedProgress < 50 && minutesElapsed > 1) {
        calculatedProgress = Math.min(50 + (minutesElapsed * 5), 95);
      }
      
      // Add a message for long-running jobs
      let statusMessage = 'Processing your request';
      if (minutesElapsed > 2) {
        statusMessage = 'This is taking longer than usual, but still working on it';
      }
      if (minutesElapsed > 5) {
        statusMessage = 'Large or complex CV optimization in progress, thanks for your patience';
      }
      
      return NextResponse.json({
        status: statusRecord.status,
        progress: calculatedProgress,
        message: statusMessage,
        minutesElapsed,
      });
    }
    
    // For completed jobs
    if (statusRecord.status === 'completed') {
      let parsedResult = null;
      
      if (statusRecord.result) {
        try {
          // If result is already an object, no need to parse
          if (typeof statusRecord.result === 'object') {
            parsedResult = statusRecord.result;
          } else {
            // Try to parse if it's a string
            parsedResult = JSON.parse(String(statusRecord.result));
          }
        } catch (parseError) {
          logger.error('Error parsing job result:', parseError instanceof Error ? parseError.message : String(parseError));
          // Continue with null result but don't fail the request
        }
      }
      
      return NextResponse.json({
        status: 'completed',
        result: parsedResult,
        progress: 100,
      });
    }
    
    // For error cases
    if (statusRecord.status === 'error') {
      return NextResponse.json({
        status: 'error',
        error: statusRecord.error || 'Unknown error occurred',
      });
    }
    
    // Default fallback
    return NextResponse.json({
      status: statusRecord.status,
      progress: statusRecord.progress,
      message: 'Processing your request',
    });
  } catch (error) {
    logger.error('Error checking job status:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to check job status' 
      },
      { status: 500 }
    );
  }
} 