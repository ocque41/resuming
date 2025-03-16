import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { analyzeCVContent } from '@/lib/services/mistral.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to CV analyze API');
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

    const { cvText } = body || {};

    if (!cvText) {
      logger.error('Missing cvText parameter in analyze request');
      return NextResponse.json({ success: false, error: 'CV text is required' }, { status: 400 });
    }

    // Analyze CV content using Mistral AI
    const analysis = await analyzeCVContent(cvText);

    // Return the analysis
    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error in CV analyze API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 