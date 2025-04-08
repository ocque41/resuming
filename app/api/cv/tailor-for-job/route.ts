import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { getIndustryOptimizationGuidance } from '@/app/lib/services/tailorCVService';
import { db } from '@/lib/db/drizzle';
import { jobStatus } from '@/lib/db/schema';

// Define status endpoint for client polling
export const runtime = 'nodejs';

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
      
      // Trigger background processing without waiting for completion
      // This will run as a separate serverless function
      fetch(new URL('/api/cv/tailor-for-job/process', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass authentication in headers - convert to strings
          'x-auth-user-id': String(user.id),
          'x-auth-job-id': jobId
        },
        body: JSON.stringify({
          cvText,
          jobDescription,
          jobTitle,
          cvId,
          jobId,
          industryInsights
        })
      }).catch(err => {
        logger.error(`Error starting background processing for job ${jobId}:`, err instanceof Error ? err.message : String(err));
      });

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