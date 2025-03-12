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
    
    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Parse metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      logger.error(`Error parsing metadata for CV ID ${cvId}:`, error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { success: false, error: "Invalid CV metadata." },
        { status: 500 }
      );
    }
    
    // Check if processing is completed
    let isCompleted = !metadata.processing && (metadata.processingCompleted || metadata.optimized || metadata.ready_for_optimization);
    
    // Check if processing is stuck
    let isStuck = false;
    let stuckMinutes = 0;
    let stuckSince = null;
    
    // More aggressive stuck detection - consider processing stuck if:
    // 1. It's been more than 2 minutes since the last update
    // 2. OR it's been more than 5 minutes since processing started and progress is less than 20%
    // 3. OR it's been more than 3 minutes and the progress has been at the same value for that time
    if (metadata.processing && !isCompleted) {
      const now = new Date();
      
      // Check for last update time
      if (metadata.lastUpdated) {
        const lastUpdated = new Date(metadata.lastUpdated);
        const minutesSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
        
        if (minutesSinceUpdate >= 2) {
          isStuck = true;
          stuckMinutes = minutesSinceUpdate;
          stuckSince = lastUpdated.toISOString();
          
          logger.warn(`CV ID ${cvId} processing appears stuck at ${metadata.processingProgress}% for ${stuckMinutes} minutes (no updates)`);
        }
      }
      
      // Check for processing start time
      if (!isStuck && metadata.processingStartTime) {
        const startTime = new Date(metadata.processingStartTime);
        const minutesSinceStart = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
        
        // If it's been more than 5 minutes and progress is less than 20%, consider it stuck
        if (minutesSinceStart >= 5 && (metadata.processingProgress || 0) < 20) {
          isStuck = true;
          stuckMinutes = minutesSinceStart;
          stuckSince = startTime.toISOString();
          
          logger.warn(`CV ID ${cvId} processing appears stuck at ${metadata.processingProgress}% for ${stuckMinutes} minutes (slow progress)`);
        }
      }
      
      // Check for progress history if available
      if (!isStuck && metadata.progressHistory && Array.isArray(metadata.progressHistory)) {
        const recentHistory = metadata.progressHistory.slice(-5); // Get last 5 progress entries
        
        if (recentHistory.length >= 3) {
          // Check if the last 3 progress values are the same
          const lastProgress = recentHistory[recentHistory.length - 1]?.progress;
          const allSame = recentHistory.slice(-3).every(entry => entry.progress === lastProgress);
          
          if (allSame) {
            const lastProgressTime = new Date(recentHistory[recentHistory.length - 3]?.timestamp || now);
            const minutesSinceProgressChange = Math.floor((now.getTime() - lastProgressTime.getTime()) / (1000 * 60));
            
            if (minutesSinceProgressChange >= 3) {
              isStuck = true;
              stuckMinutes = minutesSinceProgressChange;
              stuckSince = lastProgressTime.toISOString();
              
              logger.warn(`CV ID ${cvId} processing appears stuck at ${lastProgress}% for ${stuckMinutes} minutes (no progress change)`);
            }
          }
        }
      }
      
      // If stuck for over 10 minutes, log an error to make it more visible
      if (isStuck && stuckMinutes >= 10) {
        logger.error(`CV ID ${cvId} processing is CRITICALLY STUCK at ${metadata.processingProgress}% for ${stuckMinutes} minutes. Current step: ${metadata.processingStatus}`);
      }
    }
    
    // Check if analysis is available but processing is stuck at local_analysis_complete
    if (metadata.processing && metadata.processingStatus === 'local_analysis_complete' && 
        metadata.atsScore && metadata.strengths && metadata.weaknesses && metadata.recommendations) {
      // We have analysis results but the process is stuck at local_analysis_complete
      // This means the RAG analysis completed but the process didn't continue
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
      } catch (updateError) {
        logger.error(`Error updating metadata for stuck CV ID ${cvId}:`, updateError instanceof Error ? updateError.message : String(updateError));
      }
    }
    
    // Extract improvements from metadata or create default values
    const improvements = metadata.improvements || [];
    
    // Extract optimized text from metadata
    const optimizedText = metadata.optimizedText || "";
    
    // Extract analysis data
    const strengths = metadata.strengths || [];
    const weaknesses = metadata.weaknesses || [];
    const recommendations = metadata.recommendations || [];
    const industry = metadata.industry || "General";
    const language = metadata.language || "English";
    const keywordAnalysis = metadata.keywordAnalysis || {};
    const formattingStrengths = metadata.formattingStrengths || [];
    const formattingWeaknesses = metadata.formattingWeaknesses || [];
    const formattingRecommendations = metadata.formattingRecommendations || [];
    
    // Collect debug info if requested
    const debugInfo = debug ? {
      metadata,
      cvRecord: {
        id: cvRecord.id,
        userId: cvRecord.userId,
        filename: cvRecord.fileName,
        createdAt: cvRecord.createdAt
      }
    } : null;
    
    // Prepare response data
    const responseData = {
      success: true,
      processing: metadata.processing || false,
      isComplete: isCompleted,
      step: metadata.processingStatus || null,
      progress: metadata.processingProgress || 0,
      improvements,
      optimizedText,
      error: metadata.processingError || null,
      isStuck,
      stuckMinutes: isStuck ? stuckMinutes : 0,
      stuckSince: isStuck ? stuckSince : null,
      atsScore: metadata.atsScore || 0,
      improvedAtsScore: metadata.improvedAtsScore || 0,
      strengths,
      weaknesses,
      recommendations,
      industry,
      language,
      keywordAnalysis,
      formattingStrengths,
      formattingWeaknesses,
      formattingRecommendations,
      analyzedAt: metadata.analyzedAt || null,
      optimizedAt: metadata.optimizedAt || null,
      debug: debugInfo
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error("Error checking CV processing status:", error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Error checking CV processing status." 
      },
      { status: 500 }
    );
  }
} 