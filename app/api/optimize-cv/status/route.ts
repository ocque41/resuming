import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, like } from 'drizzle-orm';
import { updateCVAnalysis } from '@/lib/db/queries.server';
import { getCVByFileName } from '@/lib/db/queries.server';
import { apiLogger } from '@/lib/logger';
import { createError, ErrorType, ErrorSeverity, handleError } from '@/lib/errorHandler';

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  optimizedText?: string;
  optimizedCV?: string;
  selectedTemplate?: string;
  progress?: number;
  startTime?: string; // Track when optimization started
  error?: string; // Store any error messages
  optimizedPDFBase64?: string;
  lastProgressUpdate?: string; // Track the last progress update time
  optimizationCompleted?: boolean; // Explicit flag for completion
  stalledDetected?: boolean; // Explicit flag for stalled detection
  progressStalled?: boolean; // Explicit flag for stalled progress
  partialResultsAvailable?: boolean; // Explicit flag for partial results
  atsScore?: number;
  improvedAtsScore?: number;
  [key: string]: any; // Allow for additional properties
}

// Constants for optimization monitoring
const OPTIMIZATION_TIMEOUT_MINUTES = 5;
const PROGRESS_STALL_MINUTES = 2;

/**
 * API endpoint to check the status of a CV optimization
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
      
    if (!session || !session.user) {
      apiLogger.warn("Unauthorized: No valid session found");
      const error = createError(
        ErrorType.AUTHENTICATION,
        "Unauthorized: No valid session found",
        ErrorSeverity.HIGH
      );
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const userId = session.user.id;
    const fileName = request.nextUrl.searchParams.get('fileName');
    const cvId = request.nextUrl.searchParams.get('cvId');

    apiLogger.debug(`Checking optimization status`, { userId, fileName, cvId });

    if (!fileName && !cvId) {
      apiLogger.warn("Missing fileName or cvId parameter", { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Missing fileName or cvId parameter",
        ErrorSeverity.LOW
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get CV record either by ID or fileName
    let cvRecord = null;
    
    try {
      if (cvId) {
        apiLogger.debug(`Looking up CV with ID: ${cvId}`, { userId, cvId });
        cvRecord = await db.query.cvs.findFirst({
          where: eq(cvs.id, parseInt(cvId)),
        });
      } else {
        apiLogger.debug(`Looking up CV with fileName: ${fileName!}`, { userId, fileName });
        cvRecord = await getCVByFileName(fileName!);
      }
    } catch (lookupError) {
      apiLogger.error("Error looking up CV", lookupError as Error, { userId, cvId, fileName });
      const error = createError(
        ErrorType.SERVER,
        "Error looking up CV",
        ErrorSeverity.MEDIUM,
        lookupError as Error,
        { userId, cvId, fileName }
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!cvRecord) {
      const errorMessage = cvId 
        ? `CV not found with ID: ${cvId}` 
        : `CV not found with fileName: ${fileName}`;
      apiLogger.warn(errorMessage, { userId, cvId, fileName });
      const error = createError(
        ErrorType.NOT_FOUND,
        "CV not found",
        ErrorSeverity.LOW,
        undefined,
        { userId, cvId, fileName }
      );
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    apiLogger.debug(`Found CV record: id=${cvRecord.id}, fileName=${cvRecord.fileName}`, { userId, cvId: cvRecord.id });

    // Verify ownership
    if (cvRecord.userId !== userId) {
      apiLogger.error(
        `User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`,
        new Error("Unauthorized access"),
        { userId, cvId: cvRecord.id, ownerId: cvRecord.userId }
      );
      const error = createError(
        ErrorType.AUTHORIZATION,
        "Unauthorized access to CV",
        ErrorSeverity.HIGH,
        undefined,
        { userId, cvId: cvRecord.id, ownerId: cvRecord.userId }
      );
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Parse metadata with error handling
    let metadata = null;
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    } catch (parseError) {
      apiLogger.error(`Error parsing metadata for CV ${cvRecord.id}`, parseError as Error, { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.VALIDATION,
        "Invalid CV metadata",
        ErrorSeverity.MEDIUM,
        parseError as Error,
        { userId, cvId: cvRecord.id }
      );
      // Continue with null metadata instead of returning an error
      metadata = null;
    }
    
    if (!metadata) {
      apiLogger.warn(`No metadata available for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.VALIDATION,
        "No metadata available for this CV",
        ErrorSeverity.LOW,
        undefined,
        { userId, cvId: cvRecord.id }
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Check for stalled optimization
    if (metadata.optimizing && metadata.startTime) {
      const startTime = new Date(metadata.startTime);
      const currentTime = new Date();
      const timeDiffMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      // If optimization has been running for more than OPTIMIZATION_TIMEOUT_MINUTES, mark it as stalled
      if (timeDiffMinutes > OPTIMIZATION_TIMEOUT_MINUTES && !metadata.stalledDetected) {
        apiLogger.warn(`Optimization for CV ${cvRecord.id} has been running for ${timeDiffMinutes.toFixed(2)} minutes and may be stalled`, { userId, cvId: cvRecord.id });
        
        // Update metadata to mark as stalled
        metadata.stalledDetected = true;
        metadata.error = `Optimization process stalled after ${OPTIMIZATION_TIMEOUT_MINUTES} minutes`;
        
        try {
          await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
          apiLogger.info(`Updated metadata to mark optimization as stalled for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
        } catch (updateError) {
          apiLogger.error(`Failed to update metadata for stalled optimization for CV ${cvRecord.id}`, updateError as Error, { userId, cvId: cvRecord.id });
          // Continue despite the error
        }
      }
      
      // Check if progress has been updated recently
      if (metadata.lastProgressUpdate) {
        const lastUpdateTime = new Date(metadata.lastProgressUpdate);
        const updateTimeDiffMinutes = (currentTime.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
        
        // If progress hasn't been updated for PROGRESS_STALL_MINUTES, mark it as stalled
        if (updateTimeDiffMinutes > PROGRESS_STALL_MINUTES && !metadata.progressStalled) {
          apiLogger.warn(`Progress for CV ${cvRecord.id} hasn't been updated for ${updateTimeDiffMinutes.toFixed(2)} minutes and may be stalled`, { userId, cvId: cvRecord.id });
          
          // Update metadata to mark progress as stalled
          metadata.progressStalled = true;
          metadata.error = `Progress stalled after ${PROGRESS_STALL_MINUTES} minutes`;
          
          try {
            await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
            apiLogger.info(`Updated metadata to mark progress as stalled for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
          } catch (updateError) {
            apiLogger.error(`Failed to update metadata for stalled progress for CV ${cvRecord.id}`, updateError as Error, { userId, cvId: cvRecord.id });
            // Continue despite the error
          }
        }
      }
    }

    apiLogger.debug(`Returning optimization status for CV ${cvRecord.id}`, { 
      userId, 
      cvId: cvRecord.id, 
      progress: metadata.progress || 0, 
      optimized: metadata.optimized || false 
    });

    // Return the optimization status
    return NextResponse.json({
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      optimizing: metadata.optimizing || false,
      optimized: metadata.optimized || false,
      progress: metadata.progress || 0,
      error: metadata.error || null,
      lastProgressUpdate: metadata.lastProgressUpdate || null,
      lastOptimizedAt: metadata.lastOptimizedAt || null,
      originalAtsScore: metadata.atsScore || 65,
      improvedAtsScore: metadata.improvedAtsScore || 85,
      stalledDetected: metadata.stalledDetected || false,
      progressStalled: metadata.progressStalled || false,
      progressMessage: metadata.progressMessage || null
    });
  } catch (error) {
    // Handle unexpected errors
    const handledError = await handleError(
      error instanceof Error ? error : new Error(String(error)), 
      { route: "optimize-cv/status" }
    );
    
    apiLogger.error("Unexpected error checking optimization status", error instanceof Error ? error : new Error(String(error)), { error: handledError.error });
    
    return NextResponse.json({ 
      error: handledError.error?.message || "Failed to check optimization status"
    }, { status: 500 });
  }
}

/**
 * Helper function to update CV metadata in the database
 */
async function updateCVMetadata(cvId: string, metadata: CVMetadata) {
  try {
    // Check if cvId is a number or a filename
    const cvIdNum = parseInt(cvId, 10);
    
    if (!isNaN(cvIdNum)) {
      // If it's a number, use updateCVAnalysis directly
      await updateCVAnalysis(cvIdNum, JSON.stringify(metadata));    
    } else {
      // If it's a filename, get the CV first
      const cvRecord = await getCVByFileName(cvId);
      if (!cvRecord) {
        throw new Error(`CV not found with filename: ${cvId}`);
      }
      await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
    }
    
    apiLogger.debug(`Updated metadata for CV ${cvId}`);
    return true;
  } catch (error) {
    apiLogger.error(`Failed to update metadata for CV ${cvId}`, error as Error);
    return false;
  }
} 