import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { getIndustryOptimizationGuidance } from '@/app/lib/services/tailorCVService';
import { db } from '@/lib/db/drizzle';
import { jobStatus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Define status endpoint for client polling
export const runtime = 'nodejs';

/**
 * Clean and normalize CV text for better processing
 */
function preprocessCVText(text: string): string {
  if (!text) return '';
  
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Remove any special characters that might cause issues
  cleaned = cleaned.replace(/[^\w\s.,;:()&-]/g, '');
  
  // Normalize line breaks
  cleaned = cleaned.replace(/\n+/g, '\n');
  
  // Ensure key section headers are formatted consistently
  const sectionHeaders = ['profile', 'summary', 'experience', 'education', 'skills', 'achievements'];
  
  sectionHeaders.forEach(header => {
    // Look for the header with various formatting and standardize it
    const regex = new RegExp(`\\b${header}\\b`, 'i');
    if (cleaned.match(regex)) {
      // Replace with standardized section header
      cleaned = cleaned.replace(regex, header.toUpperCase());
    }
  });
  
  return cleaned;
}

/**
 * Main entry point for starting CV tailoring
 * This function queues the job and returns quickly
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to tailor-for-job API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Error parsing request body:', parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
      }, { status: 400 });
    }

    const { cvText, jobDescription, jobTitle, cvId } = body || {};

    if (!cvText) {
      logger.error('Missing cvText parameter in tailor-for-job request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in tailor-for-job request');
      return NextResponse.json({ success: false, error: 'Job description is required' }, { status: 400 });
    }

    if (!cvId) {
      logger.error('Missing cvId parameter in tailor-for-job request');
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    // Preprocess the CV text for better results
    const processedCVText = preprocessCVText(cvText);
    
    // If preprocessing removed too much content, use original
    const finalCVText = processedCVText.length < cvText.length * 0.8 ? cvText : processedCVText;

    // Generate a unique job ID
    const jobId = `tailor-${cvId}-${Date.now()}`;
    
    try {
      // Get industry insights (lightweight operation)
      const industryInsights = getIndustryOptimizationGuidance(jobDescription);
      const detectedIndustry = industryInsights?.industry || 'General';
      
      logger.info(`Initiating CV tailoring job ${jobId} for: ${jobTitle || 'Unspecified position'} in ${detectedIndustry} industry`);
      
      // Create initial job entry in database
      await db.insert(jobStatus).values({
        jobId,
        userId: user.id,
        cvId: parseInt(cvId.toString()),
        status: 'queued',
        progress: 0,
        jobType: 'tailor'
      });
      
      // Start the process immediately instead of using a separate API call
      // This ensures the same auth context is used
      setTimeout(async () => {
        try {
          // Update status to processing
          await db.update(jobStatus)
            .set({
              status: 'processing',
              progress: 10,
              updatedAt: new Date(),
            })
            .where(eq(jobStatus.jobId, jobId));
            
          // Get industry insights again (in case they weren't passed correctly)
          const industryInsights = getIndustryOptimizationGuidance(jobDescription);
          
          // Update progress - Getting industry insights
          await db.update(jobStatus)
            .set({
              progress: 25,
              updatedAt: new Date(),
            })
            .where(eq(jobStatus.jobId, jobId));
          
          // Process the tailoring request with Mistral
          const { tailorCVForSpecificJob } = await import('@/app/lib/services/mistral.service');
          const result = await tailorCVForSpecificJob(finalCVText, jobDescription, jobTitle);
          
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
        } catch (processingError) {
          logger.error(`Error processing tailoring job ${jobId}:`, processingError instanceof Error ? processingError.message : String(processingError));
          
          // Update job status to error
          await db.update(jobStatus)
            .set({
              status: 'error',
              error: processingError instanceof Error ? processingError.message : 'Unknown error during processing',
              updatedAt: new Date(),
            })
            .where(eq(jobStatus.jobId, jobId));
        }
      }, 100); // Small delay to allow response to return first

      // Return immediately with the job ID to enable client polling
      return NextResponse.json({
        success: true,
        jobId,
        status: 'processing',
        estimated_time_seconds: 45,
        // Return industry insights immediately so UI can show this info while waiting
        industryInsights: {
          industry: industryInsights.industry,
          keySkills: Array.isArray(industryInsights.keySkills) ? industryInsights.keySkills : [],
          formatGuidance: industryInsights.formatGuidance || ''
        }
      });
    } catch (error) {
      logger.error(`Error setting up tailoring job ${jobId}:`, error instanceof Error ? error.message : String(error));
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to initiate CV tailoring process' 
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Error in CV tailor-for-job API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 