// Add the runtime directive at the top of the file
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { jobStatus } from '@/lib/db/schema';
import { tailorCVForSpecificJob } from '@/app/lib/services/mistral.service';
import { getIndustryOptimizationGuidance } from '@/app/lib/services/tailorCVService';

/**
 * Process a CV tailoring job that was initiated via the tailor-for-job endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to tailor-for-job/process API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const requestData = await request.json();
    const { jobId, cvText, jobDescription, jobTitle, cvId } = requestData;
    
    if (!jobId || !cvText || !jobDescription || !cvId) {
      logger.error('Missing required parameters in tailor-for-job/process request');
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' }, 
        { status: 400 }
      );
    }
    
    logger.info(`Processing job ${jobId} for CV ${cvId}`);
    
    // Find job record in database
    const jobRecord = await db.query.jobStatus.findFirst({
      where: eq(jobStatus.jobId, jobId)
    });
    
    if (!jobRecord) {
      logger.error(`Job ${jobId} not found in database`);
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Update job status to processing
    await db.update(jobStatus)
      .set({
        status: 'processing',
        progress: 10,
        updatedAt: new Date(),
      })
      .where(eq(jobStatus.jobId, jobId));
    
    logger.info(`Starting processing for job ${jobId}`);
    
    try {
      // Update progress - Getting industry insights
      await db.update(jobStatus)
        .set({
          progress: 25,
          updatedAt: new Date(),
        })
        .where(eq(jobStatus.jobId, jobId));
      
      // Get industry-specific guidance
      const industryInsights = getIndustryOptimizationGuidance(jobDescription);
      
      // Update progress - Started tailoring
      await db.update(jobStatus)
        .set({
          progress: 40,
          updatedAt: new Date(),
        })
        .where(eq(jobStatus.jobId, jobId));
      
      // Process the tailoring request with Mistral
      const result = await tailorCVForSpecificJob(cvText, jobDescription, jobTitle);
      
      // Update progress - Finishing up
      await db.update(jobStatus)
        .set({
          progress: 90,
          updatedAt: new Date(),
        })
        .where(eq(jobStatus.jobId, jobId));
      
      // Combine the result with industry insights
      const combinedResult = {
        ...result,
        industryInsights
      };
      
      // Update job status to completed
      await db.update(jobStatus)
        .set({
          status: 'completed',
          progress: 100,
          result: combinedResult,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobStatus.jobId, jobId));
      
      logger.info(`Job ${jobId} completed successfully`);
      
      return NextResponse.json({
        success: true,
        status: 'completed',
        jobId,
      });
    } catch (processingError) {
      logger.error('Error processing tailoring job:', processingError instanceof Error ? processingError.message : String(processingError));
      
      // Update job status to error
      await db.update(jobStatus)
        .set({
          status: 'error',
          error: processingError instanceof Error ? processingError.message : 'Unknown error during processing',
          updatedAt: new Date(),
        })
        .where(eq(jobStatus.jobId, jobId));
      
      return NextResponse.json({
        success: false,
        error: processingError instanceof Error ? processingError.message : 'Failed to process tailoring job',
        jobId,
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Unhandled error in tailor-for-job/process API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    }, { status: 500 });
  }
} 