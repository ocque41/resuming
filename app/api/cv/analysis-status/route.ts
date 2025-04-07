import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get CV ID from URL params
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    
    if (!cvId) {
      return NextResponse.json({ error: 'Missing cvId parameter' }, { status: 400 });
    }
    
    // Parse CV ID
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(cvId);
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      logger.error(`Error parsing cvId: ${cvId}`, parseError instanceof Error ? parseError : String(parseError));
      return NextResponse.json({ 
        error: `Invalid cvId: ${cvId} is not a valid number`,
        success: false 
      }, { status: 400 });
    }
    
    // Fetch CV record
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });
    } catch (dbError) {
      logger.error(`Database error fetching CV ${cvId}:`, dbError instanceof Error ? dbError : String(dbError));
      return NextResponse.json({ 
        error: 'Database error while fetching CV',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error',
        success: false
      }, { status: 500 });
    }
    
    // Check if CV exists
    if (!cv) {
      logger.error(`CV not found: ${cvId}`);
      return NextResponse.json({ 
        error: 'CV not found',
        success: false 
      }, { status: 404 });
    }
    
    // Check if CV belongs to the user
    if (cv.userId !== userId) {
      logger.error(`User ${userId} attempted to access CV ${cvId} belonging to user ${cv.userId}`);
      return NextResponse.json({ 
        error: 'You don\'t have permission to access this CV',
        success: false 
      }, { status: 403 });
    }
    
    // Parse metadata
    let metadata = {};
    try {
      metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
    } catch (parseError) {
      logger.error(`Error parsing metadata for CV ${cvId}:`, parseError instanceof Error ? parseError : String(parseError));
      metadata = {}; // Continue with empty metadata
    }
    
    // Check if analysis is complete
    const isComplete = metadata && 
                      (metadata as any).analyzedAt && 
                      (metadata as any).atsScore;
    
    // Check if analysis is in progress
    const isAnalyzing = metadata && (metadata as any).analyzing === true;
    
    // Check if analysis has failed
    const hasFailed = metadata && (metadata as any).analysisError;
    
    let status = 'unknown';
    if (isComplete) {
      status = 'complete';
    } else if (hasFailed) {
      status = 'failed';
    } else if (isAnalyzing) {
      status = 'in_progress';
    } else {
      status = 'not_started';
    }
    
    // If analysis is complete, return full results
    if (isComplete) {
      return NextResponse.json({
        success: true,
        status,
        complete: true,
        analysis: {
          cvId,
          userId: cv.userId,
          atsScore: (metadata as any).atsScore,
          language: (metadata as any).language || 'en',
          industry: (metadata as any).industry || 'General',
          keywords: (metadata as any).keywordAnalysis || [],
          strengths: (metadata as any).strengths || [],
          weaknesses: (metadata as any).weaknesses || [],
          recommendations: (metadata as any).recommendations || [],
          formatStrengths: (metadata as any).formattingStrengths || [],
          formatWeaknesses: (metadata as any).formattingWeaknesses || [],
          formatRecommendations: (metadata as any).formattingRecommendations || [],
          skills: (metadata as any).skills || [],
          experienceEntries: (metadata as any).experienceEntries || [],
          industryKeywords: (metadata as any).industryKeywords || [],
          missingSoftSkills: (metadata as any).missingSoftSkills || [],
          missingHardSkills: (metadata as any).missingHardSkills || [],
          industrySuggestions: (metadata as any).industrySuggestions || []
        },
        metadata
      });
    }
    
    // If analysis has failed, return error details
    if (hasFailed) {
      return NextResponse.json({
        success: false,
        status,
        error: (metadata as any).analysisError || 'Analysis failed for unknown reasons',
        failedAt: (metadata as any).analysisFailedAt,
        metadata
      });
    }
    
    // If analysis is in progress, return progress details
    if (isAnalyzing) {
      return NextResponse.json({
        success: true,
        status,
        inProgress: true,
        startedAt: (metadata as any).analysisStartedAt,
        progress: (metadata as any).analysisProgress || 0,
        currentStatus: (metadata as any).analysisStatus || 'analyzing',
        metadata
      });
    }
    
    // If analysis hasn't started, return status
    return NextResponse.json({
      success: true,
      status,
      message: 'CV analysis has not been started',
      metadata
    });
  } catch (error) {
    logger.error('Error in CV analysis status API:', error instanceof Error ? error : String(error));
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get CV analysis status',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 