export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/drizzle';
import { eq, and } from 'drizzle-orm';
import { jobStatus } from '@/lib/db/schema';

/**
 * Check the status of a CV tailoring job
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to tailor-for-job/status API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get job ID from URL parameters
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      logger.error('Missing jobId parameter in tailor-for-job/status request');
      return NextResponse.json(
        { success: false, error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }
    
    logger.info(`Checking status for job: ${jobId}`);
    
    // Get job status from database
    const job = await db.query.jobStatus.findFirst({
      where: and(
        eq(jobStatus.jobId, jobId),
        eq(jobStatus.userId, user.id)
      )
    });
    
    if (!job) {
      logger.error(`Job ${jobId} not found in database for user ${user.id}`);
      return NextResponse.json(
        { success: false, error: 'Job not found', errorCode: 'JOB_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Calculate duration if possible
    let duration = null;
    if (job.startTime) {
      const endTime = job.completedAt || new Date();
      duration = Math.round((endTime.getTime() - job.startTime.getTime()) / 1000);
    }
    
    // Parse the result if it's stored as a string
    let parsedResult = null;
    if (job.result && typeof job.result === 'string') {
      try {
        parsedResult = JSON.parse(job.result);
      } catch (e) {
        logger.error(`Failed to parse job result for ${jobId}: ${e instanceof Error ? e.message : String(e)}`);
        parsedResult = { error: 'Result format error' };
      }
    } else {
      parsedResult = job.result;
    }
    
    // Define timeout thresholds
    const SHORT_TIMEOUT = 45000;  // 45 seconds
    const MEDIUM_TIMEOUT = 180000; // 3 minutes
    const LONG_TIMEOUT = 600000;  // 10 minutes
    
    // Calculate processing time so far
    const processingTime = job.startTime ? (new Date().getTime() - job.startTime.getTime()) : 0;
    
    // Determine timeout state
    const isShortTimeout = job.status === 'processing' && processingTime > SHORT_TIMEOUT;
    const isMediumTimeout = job.status === 'processing' && processingTime > MEDIUM_TIMEOUT;
    const isLongTimeout = job.status === 'processing' && processingTime > LONG_TIMEOUT;
    
    // Check if job has been stuck with no updates
    const lastUpdateTime = job.updatedAt ? (new Date().getTime() - job.updatedAt.getTime()) : 0;
    const isStuck = job.status === 'processing' && lastUpdateTime > 300000; // 5 minutes with no updates
    
    // Calculate estimated time remaining based on progress
    let estimatedTimeRemaining = null;
    if (job.status === 'processing' && job.progress > 0 && job.progress < 100 && processingTime > 0) {
      // Estimate remaining time based on current progress and time elapsed
      const progressPerMs = job.progress / processingTime;
      const remainingProgress = 100 - job.progress;
      estimatedTimeRemaining = Math.round((remainingProgress / progressPerMs) / 1000); // in seconds
      
      // Cap the estimate at reasonable values
      if (estimatedTimeRemaining > 600) estimatedTimeRemaining = 600; // max 10 minutes
    }
    
    // If job is completed, return success
    if (job.status === 'completed') {
      logger.info(`Job ${jobId} completed successfully in ${duration} seconds`);
      
      return NextResponse.json({
        success: true,
        status: 'completed',
        progress: 100,
        result: parsedResult,
        duration,
        completedAt: job.completedAt,
        processingTime,
        jobType: job.jobType || 'tailor-cv'
      });
    }
    
    // If job has an error, return error details
    if (job.status === 'error') {
      logger.error(`Job ${jobId} failed after ${duration} seconds: ${job.error || 'Unknown error'}`);
      
      return NextResponse.json({
        success: false,
        status: 'error',
        error: job.error,
        errorCode: job.error?.includes('timed out') ? 'TIMEOUT_ERROR' : 'PROCESSING_ERROR',
        duration,
        canRetry: true,
        retryStrategy: 'full', // full retry from the beginning
        processingTime
      });
    }
    
    // If job is stuck (no updates for too long), mark as error
    if (isStuck) {
      logger.error(`Job ${jobId} appears to be stuck with no updates for ${Math.round(lastUpdateTime/1000)} seconds`);
      
      // Update the job status in the database
      await db.update(jobStatus)
        .set({
          status: 'error',
          error: 'Job appears to be stuck and was automatically terminated',
          updatedAt: new Date()
        })
        .where(and(
          eq(jobStatus.jobId, jobId),
          eq(jobStatus.userId, user.id)
        ));
      
      return NextResponse.json({
        success: false,
        status: 'error',
        error: 'Job appears to be stuck and was automatically terminated',
        errorCode: 'JOB_STUCK',
        canRetry: true,
        retryStrategy: 'full',
        duration,
        processingTime
      });
    }
    
    // For long timeout (potential system issue)
    if (isLongTimeout) {
      logger.warn(`Job ${jobId} exceeded long timeout threshold (${LONG_TIMEOUT/1000}s)`);
      
      return NextResponse.json({
        success: true,
        status: 'timeout',
        timeoutLevel: 'long',
        progress: job.progress,
        duration,
        message: 'Job is taking much longer than expected but is still processing',
        continuePolling: true,
        estimatedTimeRemaining,
        processingTime,
        recommendAction: 'retry',
        canRetry: true
      });
    }
    
    // For medium timeout (longer than expected but still processing)
    if (isMediumTimeout) {
      logger.warn(`Job ${jobId} exceeded medium timeout threshold (${MEDIUM_TIMEOUT/1000}s)`);
      
      return NextResponse.json({
        success: true,
        status: 'timeout',
        timeoutLevel: 'medium',
        progress: job.progress,
        duration,
        message: 'Job is taking longer than expected but is still processing',
        continuePolling: true,
        estimatedTimeRemaining,
        processingTime,
        recommendAction: 'wait'
      });
    }
    
    // For short timeout (initial timeout notification)
    if (isShortTimeout) {
      logger.info(`Job ${jobId} exceeded short timeout threshold (${SHORT_TIMEOUT/1000}s)`);
      
      return NextResponse.json({
        success: true,
        status: 'timeout',
        timeoutLevel: 'short',
        progress: job.progress,
        duration,
        message: 'Job is taking longer than normal but is still processing',
        continuePolling: true,
        estimatedTimeRemaining,
        processingTime
      });
    }
    
    // For jobs still in progress (normal processing)
    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      duration,
      processingTime,
      estimatedTimeRemaining: job.progress > 0 ? estimatedTimeRemaining : null,
      jobType: job.jobType || 'tailor-cv'
    });
    
  } catch (error) {
    logger.error('Error in tailor-for-job/status API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        status: 'error',
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        errorCode: 'API_ERROR'
      },
      { status: 500 }
    );
  }
} 