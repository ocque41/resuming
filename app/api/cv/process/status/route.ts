import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// Define stuck threshold in minutes
const STUCK_THRESHOLD_MINUTES = 5;

export async function GET(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to check CV processing status." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Get CV ID from query parameter
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    const debug = searchParams.get("debug") === "true";
    
    if (!cvId) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID parameter." },
        { status: 400 }
      );
    }
    
    // Get CV record from database with timeout
    let cvRecord;
    try {
      // Create a promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database query timed out")), 5000);
      });
      
      // Database query promise
      const dbQueryPromise = db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId)),
      });
      
      // Race the query against the timeout
      cvRecord = await Promise.race([dbQueryPromise, timeoutPromise]);
    } catch (dbError) {
      logger.error(`Database error fetching CV ${cvId}:`, dbError instanceof Error ? dbError.message : String(dbError));
      return NextResponse.json(
        { success: false, error: "Error accessing CV data. Please try again." },
        { status: 500, headers: { 'Retry-After': '5' } }
      );
    }
    
    if (!cvRecord) {
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      logger.error(`User ${userId} attempted to access CV ${cvId} belonging to user ${cvRecord.userId}`);
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Parse metadata with error handling
    let metadata: Record<string, any> = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (parseError) {
      logger.error(`Error parsing metadata for CV ID ${cvId}:`, parseError instanceof Error ? parseError.message : String(parseError));
      
      // Return partial information even if parsing fails
      return NextResponse.json({
        success: true,
        error: "Failed to parse CV metadata",
        processing: false,
        isComplete: false,
        step: null,
        progress: 0,
        partialData: true
      });
    }
    
    // Calculate time-based metrics
    const now = new Date();
    const lastUpdated = metadata.lastUpdated ? new Date(metadata.lastUpdated) : null;
    const processingStartTime = metadata.processingStartTime ? new Date(metadata.processingStartTime) : null;
    const timeSinceLastUpdate = lastUpdated ? Math.floor((now.getTime() - lastUpdated.getTime()) / 1000) : 0;
    const timeSinceStart = processingStartTime ? Math.floor((now.getTime() - processingStartTime.getTime()) / 1000) : 0;
    
    // Check if processing is completed
    let isCompleted = !metadata.processing && (metadata.processingCompleted || metadata.optimized || metadata.ready_for_optimization);
    
    // Check if processing is stuck based on multiple factors
    let isStuck = false;
    let stuckDuration = 0;
    let stuckReason: string | null = null;
    
    if (metadata.processing && !isCompleted) {
      // No updates for over 2 minutes
      if (lastUpdated && timeSinceLastUpdate > 120) {
        isStuck = true;
        stuckDuration = timeSinceLastUpdate;
        stuckReason = 'no_updates';
      }
      
      // Processing for over 5 minutes with low progress
      if (!isStuck && processingStartTime && timeSinceStart > 300 && (metadata.processingProgress || 0) < 20) {
        isStuck = true;
        stuckDuration = timeSinceStart;
        stuckReason = 'slow_progress';
      }
      
      // Progress hasn't changed but time has passed
      if (!isStuck && metadata.progressHistory && Array.isArray(metadata.progressHistory)) {
        const recentHistory = metadata.progressHistory.slice(-5);
        
        if (recentHistory.length >= 3) {
          const lastProgress = recentHistory[recentHistory.length - 1]?.progress;
          const allSame = recentHistory.slice(-3).every(entry => entry.progress === lastProgress);
          
          if (allSame) {
            const lastProgressTime = new Date(recentHistory[recentHistory.length - 3]?.timestamp || now);
            const secondsSinceProgressChange = Math.floor((now.getTime() - lastProgressTime.getTime()) / 1000);
            
            if (secondsSinceProgressChange > 180) {
              isStuck = true;
              stuckDuration = secondsSinceProgressChange;
              stuckReason = 'progress_stalled';
            }
          }
        }
      }
      
      // Log critical stuck states
      if (isStuck && stuckDuration > 600) {
        logger.error(`CV ID ${cvId} processing is CRITICALLY STUCK at ${metadata.processingProgress}% for ${Math.floor(stuckDuration / 60)} minutes. Current step: ${metadata.processingStatus}`);
      }
    }
    
    // Auto-recover: If analysis is available but processing seems stuck
    if (metadata.processing && metadata.processingStatus === 'local_analysis_complete' && 
        metadata.atsScore && metadata.strengths && metadata.weaknesses && metadata.recommendations) {
      // We have analysis results but the process is stuck at local_analysis_complete
      logger.info(`CV ID ${cvId} has analysis results but is stuck at local_analysis_complete, marking as complete`);
      
      // Update the metadata to mark processing as complete
      try {
        const updatedMetadata = {
          ...metadata,
          processing: false,
          processingCompleted: true,
          ready_for_optimization: true,
          processingStatus: 'analysis_complete',
          processingProgress: 100,
          lastUpdated: new Date().toISOString()
        };
        
        await db.update(cvs)
          .set({ metadata: JSON.stringify(updatedMetadata) })
          .where(eq(cvs.id, parseInt(cvId)));
        
        // Update the completed flag for the response
        isCompleted = true;
        isStuck = false;
        metadata = updatedMetadata;
      } catch (updateError) {
        logger.error(`Error updating metadata for stuck CV ID ${cvId}:`, updateError instanceof Error ? updateError.message : String(updateError));
      }
    }
    
    // Extract data from metadata with safe defaults
    const extractWithDefault = (key: string, defaultValue: any) => metadata[key] || defaultValue;
    
    // Prepare response data
    const responseData = {
      success: true,
      processing: metadata.processing || false,
      isComplete: isCompleted,
      step: metadata.processingStatus || null,
      progress: metadata.processingProgress || 0,
      
      // Timing information
      lastUpdated: metadata.lastUpdated || null,
      startedAt: metadata.processingStartTime || null,
      completedAt: metadata.completedAt || null,
      timeSinceLastUpdate: timeSinceLastUpdate,
      timeSinceStart: timeSinceStart,
      
      // Stuck information
      isStuck,
      stuckDuration: isStuck ? stuckDuration : 0,
      stuckReason: isStuck ? stuckReason : null,
      
      // Analysis results
      atsScore: extractWithDefault('atsScore', 0),
      improvedAtsScore: extractWithDefault('improvedAtsScore', 0),
      optimizedText: isCompleted ? extractWithDefault('optimizedText', "") : null,
      improvements: extractWithDefault('improvements', []),
      error: extractWithDefault('processingError', null),
      
      // Analysis data
      strengths: extractWithDefault('strengths', []),
      weaknesses: extractWithDefault('weaknesses', []),
      recommendations: extractWithDefault('recommendations', []),
      industry: extractWithDefault('industry', "General"),
      language: extractWithDefault('language', "English"),
      keywordAnalysis: extractWithDefault('keywordAnalysis', {}),
      formattingStrengths: extractWithDefault('formattingStrengths', []),
      formattingWeaknesses: extractWithDefault('formattingWeaknesses', []),
      formattingRecommendations: extractWithDefault('formattingRecommendations', []),
      
      // Retry information for polling
      retryIn: isStuck ? 5000 : (isCompleted ? null : 2000),
      
      // Debug information if requested
      debug: debug ? {
        metadata,
        cvRecord: {
          id: cvRecord.id,
          userId: cvRecord.userId,
          filename: cvRecord.fileName,
          createdAt: cvRecord.createdAt
        },
        timing: {
          now: now.toISOString(),
          lastUpdated: lastUpdated?.toISOString(),
          processingStartTime: processingStartTime?.toISOString(),
          timeSinceLastUpdate,
          timeSinceStart
        }
      } : null
    };
    
    // Add cache-control headers based on processing state
    const headers: HeadersInit = {};
    
    if (isCompleted) {
      // If complete, can cache longer
      headers['Cache-Control'] = 'private, max-age=60';
    } else if (isStuck) {
      // If stuck, retry less frequently
      headers['Cache-Control'] = 'no-cache';
      headers['Retry-After'] = '5';
    } else if (metadata.processing) {
      // If actively processing, no caching
      headers['Cache-Control'] = 'no-store';
    }
    
    return NextResponse.json(responseData, { headers });
  } catch (error) {
    logger.error("Error checking CV processing status:", error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Error checking CV processing status.",
        retryIn: 5000
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '5'
        }
      }
    );
  }
} 