import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { optimizeCVForJob } from '@/lib/services/mistral.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to CV optimize-local API');
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

    const { cvText, jobDescription } = body || {};

    if (!cvText) {
      logger.error('Missing cvText parameter in optimize-local request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    if (!jobDescription) {
      logger.error('Missing jobDescription parameter in optimize-local request');
      return NextResponse.json({ success: false, error: 'Job description is required' }, { status: 400 });
    }

    // Optimize CV for job using Mistral AI
    logger.info('Optimizing CV using Mistral AI service');
    const result = await optimizeCVForJob(cvText, jobDescription);
    logger.info('CV optimization completed successfully');

    // Return the optimization result
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error in CV optimize-local API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 