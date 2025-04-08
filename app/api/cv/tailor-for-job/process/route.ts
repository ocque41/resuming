// Add the runtime directive at the top of the file
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db/drizzle';
import { jobStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tailorCVForJob } from 'app/lib/services/tailorCVService';
import { getSpecificCVContent } from 'app/lib/db/cvQueries.server';
import { logger } from '@/lib/logger';
import { getIndustryOptimizationGuidance } from '@/app/lib/services/tailorCVService';

// Maximum timeout for a job to complete when waiting synchronously (45 seconds)
const MAX_SYNC_TIMEOUT = 45000;

interface JobMetadata {
  attemptCount?: number;
  lastAttemptAt?: string;
  priority?: 'high' | 'normal';
  forceContinue?: boolean;
  lastProgressUpdate?: string;
  stage?: string;
  errorCode?: string;
  errorTimestamp?: string;
  completedTimestamp?: string;
  processingTime?: number;
  [key: string]: any;
}

interface JobResult {
  optimizedText: string;
  originalText: string;
  jobDescription: string;
  analysis: {
    improvements: string[];
    keywords: string[];
    score: number;
  };
  metadata: {
    processingTime: number;
    model: string;
    timestamp: string;
  };
}

/**
 * Process a CV tailoring job that was initiated via the tailor-for-job endpoint
 */
export async function POST(request: NextRequest) {
  logger.info('Starting CV tailoring job processing');
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      logger.warn('Unauthorized access attempt to tailor-for-job/process API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await getUser();
    if (!user) {
      logger.warn('User not found in database');
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    // Get job ID from query params
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const cvId = searchParams.get('cvId');
    
    if (!jobId) {
      logger.error('Missing job ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Job ID is required',
        errorCode: 'MISSING_JOB_ID'
      }, { status: 400 });
    }

    if (!cvId) {
      logger.error('Missing CV ID');
      return NextResponse.json({ 
        success: false, 
        error: 'CV ID is required',
        errorCode: 'MISSING_CV_ID'
      }, { status: 400 });
    }
    
    // Parse request data
    const requestData = await request.json().catch(() => ({}));
    
    // Check request type
    let isRetry = requestData?.retry === true;
    const forceContinue = requestData?.forceContinue === true;
    const priority = requestData?.priority === 'high' ? 'high' : 'normal';
    
    // Get existing job status
    let jobData = await db.query.jobStatus.findFirst({
      where: and(
        eq(jobStatus.jobId, jobId),
        eq(jobStatus.userId, user.id)
      )
    });
    
    // Check if we can continue a running job
    if (jobData && !isRetry) {
      // If job is already completed, return the result
      if (jobData.status === 'completed') {
        logger.info(`Job ${jobId} was already completed, returning result`);
        
        let parsedResult = null;
        if (jobData.result && typeof jobData.result === 'string') {
          try {
            parsedResult = JSON.parse(jobData.result);
          } catch (e) {
            logger.error(`Failed to parse completed job result: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          parsedResult = jobData.result;
        }
        
        return NextResponse.json({ 
          success: true,
          status: 'completed', 
          result: parsedResult 
        }, { status: 200 });
      }
      
      // If job has an error, return the error
      if (jobData.status === 'error' && !forceContinue) {
        logger.info(`Job ${jobId} previously failed with error: ${jobData.error}`);
        return NextResponse.json({ 
          success: false,
          status: 'error', 
          error: jobData.error,
          errorCode: 'PREVIOUS_ERROR',
          canRetry: true
        }, { status: 200 });
      }
      
      // If job is still processing and not forced to continue
      if (jobData.status === 'processing' && !forceContinue) {
        // Check if job is still actively processing or stalled
        const lastUpdateTime = jobData.updatedAt 
          ? (new Date().getTime() - jobData.updatedAt.getTime()) 
          : 0;
          
        // If job was updated recently (within last 30 seconds)
        if (lastUpdateTime < 30000) {
          logger.info(`Job ${jobId} is still actively processing (last update: ${Math.round(lastUpdateTime/1000)}s ago)`);
          return NextResponse.json({ 
            success: true,
            status: 'processing', 
            progress: jobData.progress,
            message: 'Job is already being processed'
          }, { status: 200 });
        }
        
        // If job hasn't been updated in over 5 minutes, consider it stalled
        if (lastUpdateTime > 300000) {
          logger.warn(`Job ${jobId} appears to be stalled (no updates for ${Math.round(lastUpdateTime/1000)}s), will reset and retry`);
          isRetry = true; // Force a retry for stalled jobs
        } else {
          // Job is processing but hasn't been updated recently
          logger.info(`Job ${jobId} is processing but hasn't been updated for ${Math.round(lastUpdateTime/1000)}s`);
          return NextResponse.json({ 
            success: true,
            status: 'processing', 
            progress: jobData.progress,
            message: 'Job is being processed but may be slow',
            canForceContinue: true
          }, { status: 200 });
        }
      }
    }
    
    // Get CV content
    const cvContent = await getSpecificCVContent(parseInt(cvId, 10), user.id);
    if (!cvContent) {
      logger.error(`CV content not found for CV ID ${cvId}`);
      await updateJobStatus(jobId, user.id, 'error', 0, null, 'CV content not found', 'CONTENT_NOT_FOUND');
      return NextResponse.json({ 
        success: false,
        error: 'CV content not found',
        errorCode: 'CONTENT_NOT_FOUND'
      }, { status: 404 });
    }
    
    // Update or create job status
    if (jobData && (isRetry || forceContinue)) {
      // Get the attempt count from existing job or default to 1
      const metadata = jobData.metadata as JobMetadata || {};
      const attemptCount = (metadata.attemptCount || 0) + 1;
      
      // Reset job status for retry
      await db.update(jobStatus)
        .set({
          status: 'processing',
          progress: forceContinue ? (jobData.progress || 0) : 0, // Preserve progress if continuing
          error: null,
          result: null,
          startTime: new Date(),
          completedAt: null,
          updatedAt: new Date(),
          metadata: {
            ...metadata,
            attemptCount,
            lastAttemptAt: new Date().toISOString(),
            priority,
            forceContinue
          } as JobMetadata
        })
        .where(and(
          eq(jobStatus.jobId, jobId),
          eq(jobStatus.userId, user.id)
        ));
        
      logger.info(`Reset job ${jobId} for ${isRetry ? 'retry' : 'forced continuation'} (attempt #${attemptCount})`);
    } else if (!jobData) {
      // Create new job status
      await db.insert(jobStatus).values({
        jobId,
        userId: user.id,
        cvId: parseInt(cvId, 10),
        status: 'processing',
        progress: 0,
        startTime: new Date(),
        jobType: 'tailor-cv',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          attemptCount: 1,
          priority,
          initialRequest: new Date().toISOString()
        }
      });
      
      logger.info(`Created new job status for job ${jobId}`);
    }
    
    // Get job parameters with validation
    const { jobDescription, jobTitle, industry, keySkills } = requestData;
    
    // Validate essential parameters
    if (!jobDescription) {
      logger.error('Missing job description in tailoring request');
      await updateJobStatus(jobId, user.id, 'error', 0, null, 'Job description is required', 'MISSING_JOB_DESCRIPTION');
      return NextResponse.json({ 
        success: false,
        error: 'Job description is required',
        errorCode: 'MISSING_JOB_DESCRIPTION'
      }, { status: 400 });
    }
    
    // Start processing - update initial status
    await updateJobStatus(jobId, user.id, 'processing', 5, null, null);
    
    // Process the job in the background
    processJob(jobId, user.id, cvContent, {
      jobDescription,
      jobTitle,
      industry,
      keySkills,
      cvId,
      priority
    }).catch(error => {
      logger.error(`Background job processing failed: ${error.message}`);
      updateJobStatus(jobId, user.id, 'error', 0, null, `Processing error: ${error.message}`, 'PROCESSING_ERROR');
    });
    
    return NextResponse.json({ 
      success: true,
      status: 'processing', 
      message: 'Job processing started in background',
      jobId,
      estimatedTime: priority === 'high' ? '30-60 seconds' : '60-180 seconds'
    }, { status: 202 });
    
  } catch (error: any) {
    logger.error(`CV tailoring job processing failed: ${error.message}`);
    return NextResponse.json({ 
      success: false,
      status: 'error',
      error: `Failed to process job: ${error.message}`,
      errorCode: 'API_ERROR'
    }, { status: 500 });
  }
}

/**
 * Update job status in the database
 */
async function updateJobStatus(
  jobId: string,
  userId: number,
  status: string,
  progress: number = 0,
  result: any = null,
  error: string | null = null,
  errorCode: string | null = null
) {
  try {
    // Get current job data for metadata preservation
    const currentJob = await db.query.jobStatus.findFirst({
      where: and(
        eq(jobStatus.jobId, jobId),
        eq(jobStatus.userId, userId)
      )
    });
    
    // Create update object
    const updateData: any = {
      status,
      progress,
      error,
      updatedAt: new Date()
    };
    
    // Handle result data
    if (result !== null) {
      updateData.result = typeof result === 'object' ? JSON.stringify(result) : result;
    }
    
    // Add completion data if needed
    if (status === 'completed' || status === 'error') {
      updateData.completedAt = new Date();
    }
    
    // Track detailed progress stages in metadata
    let metadata = (currentJob?.metadata || {}) as JobMetadata;
    
    // Update progress metadata
    if (status === 'processing') {
      const timestamp = new Date().toISOString();
      
      metadata = {
        ...metadata,
        lastProgressUpdate: timestamp,
        [`progress_${progress}`]: timestamp,
      };
      
      // Add stages with friendly names
      if (progress === 10) metadata.stage = 'analyzing_content';
      if (progress === 25) metadata.stage = 'extracting_key_points';
      if (progress === 50) metadata.stage = 'matching_job_requirements';
      if (progress === 75) metadata.stage = 'optimizing_content';
      if (progress === 90) metadata.stage = 'finalizing';
    }
    
    // Add error code to metadata if provided
    if (status === 'error' && errorCode) {
      metadata = {
        ...metadata,
        errorCode,
        errorTimestamp: new Date().toISOString()
      };
    }
    
    // Add success metadata
    if (status === 'completed') {
      metadata = {
        ...metadata,
        completedTimestamp: new Date().toISOString(),
        processingTime: currentJob?.startTime
          ? Math.round((new Date().getTime() - currentJob.startTime.getTime()) / 1000)
          : undefined
      };
    }
    
    // Update metadata in database
    updateData.metadata = metadata;
    
    // Perform database update
    await db.update(jobStatus)
      .set(updateData)
      .where(and(
        eq(jobStatus.jobId, jobId),
        eq(jobStatus.userId, userId)
      ));
    
    logger.info(`Updated job ${jobId} status to ${status} (progress: ${progress}%)`);
  } catch (updateError: any) {
    logger.error(`Failed to update job status: ${updateError.message}`);
  }
}

/**
 * Process a CV tailoring job asynchronously
 */
async function processJob(
  jobId: string,
  userId: number,
  cvContent: string,
  params: {
    jobDescription?: string;
    jobTitle?: string;
    industry?: string;
    keySkills?: string[];
    cvId: string;
    priority?: string;
  }
) {
  try {
    logger.info(`Processing job ${jobId} for user ${userId} started`);
    
    // Record start time for performance tracking
    const startTime = Date.now();
    const priority = params.priority || 'normal';
    
    // Update progress with detailed stages
    await updateJobStatus(jobId, userId, 'processing', 10);
    logger.info(`Job ${jobId}: Starting content analysis`);
    
    // Add delay between status updates to prevent database load
    const updateDelay = priority === 'high' ? 1500 : 3000;
    
    // Track major progress milestones with detailed updates
    setTimeout(async () => {
      await updateJobStatus(jobId, userId, 'processing', 25);
      logger.info(`Job ${jobId}: Extracting key points`);
    }, updateDelay);
    
    setTimeout(async () => {
      await updateJobStatus(jobId, userId, 'processing', 40);
      logger.info(`Job ${jobId}: Analyzing job requirements`);
    }, updateDelay * 2);
    
    // Start the actual tailoring process
    logger.info(`Tailoring CV for job ${jobId}`);
    const result = await tailorCVForJob(cvContent, params, async (progress: number) => {
      // Update progress during processing - use setTimeout to prevent excessive updates
      if (progress > 40) { // Only update after our preset progress points
        await updateJobStatus(jobId, userId, 'processing', progress);
      }
    });
    
    // Handle the result
    if (result && typeof result === 'object') {
      // Convert the result to our expected format
      const resultObj = {
        optimizedText: (result as any).tailoredContent || '',
        originalText: (result as any).originalText || '',
        jobDescription: (result as any).jobDescription || '',
        analysis: {
          improvements: (result as any).sectionImprovements || {},
          keywords: (result as any).keywords || [],
          score: (result as any).score || 0
        },
        metadata: {
          processingTime: Math.round((Date.now() - startTime) / 1000),
          model: 'gpt-4-turbo-preview',
          timestamp: new Date().toISOString()
        }
      } as JobResult;
      
      // Clean up the text if needed
      if (typeof resultObj.optimizedText === 'string' && resultObj.optimizedText.startsWith('```')) {
        resultObj.optimizedText = resultObj.optimizedText.replace(/^```\w*\n/, '').replace(/\n```$/, '');
      }
      
      // Update the job status with the result
      await updateJobStatus(jobId, userId, 'completed', 100, resultObj);
    }
    
  } catch (error: any) {
    logger.error(`Job processing failed: ${error.message}`);
    await updateJobStatus(
      jobId, 
      userId, 
      'error', 
      0, 
      null, 
      error.message,
      error.message.includes('timed out') ? 'TIMEOUT_ERROR' : 'PROCESSING_ERROR'
    );
  }
} 