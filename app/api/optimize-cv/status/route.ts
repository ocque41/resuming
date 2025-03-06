import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';
import { updateCVAnalysis } from '@/lib/db/queries.server';

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
  [key: string]: any; // Allow for additional properties
}

// Constants for optimization monitoring
const OPTIMIZATION_TIMEOUT_MINUTES = 5;
const PROGRESS_STALL_MINUTES = 2;

export async function GET(request: NextRequest) {
  try {
    // Auth check using app's custom auth system
    const session = await getSession();
    
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session found in status check");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get cv ID from query params
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    
    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }

    console.log(`Checking optimization status for: ${cvId}`);

    // Get the CV from the database
    // Convert cvId to the correct type for the database
    const cvIdNum = parseInt(cvId, 10);
    if (isNaN(cvIdNum)) {
      return NextResponse.json({ error: 'Invalid CV ID format' }, { status: 400 });
    }
    
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvIdNum),
    });

    if (!cvRecord) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let metadata: CVMetadata = {};
    
    // Parse the metadata from the CV record
    if (cvRecord.metadata) {
      try {
        metadata = JSON.parse(cvRecord.metadata);
      } catch (error) {
        console.error(`Error parsing metadata for CV ${cvId}:`, error);
        return NextResponse.json({ 
          error: 'Invalid metadata format',
          details: (error as Error).message
        }, { status: 500 });
      }
    }

    // Log metadata for debugging
    console.log(`Parsed metadata for ${cvRecord.fileName}:`, JSON.stringify(metadata, null, 2));

    // Detect stalled optimizations by checking startTime and progress updates
    if (metadata.optimizing && metadata.startTime) {
      const startTime = new Date(metadata.startTime);
      const currentTime = new Date();
      const timeDiffMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);

      // Check if the entire optimization has been running too long (over 5 minutes)
      if (timeDiffMinutes > OPTIMIZATION_TIMEOUT_MINUTES) {
        console.warn(`Optimization for ${cvRecord.fileName} has been running for ${timeDiffMinutes.toFixed(2)} minutes and appears stalled.`);
        
        // Update metadata to reflect the stalled state
        metadata.error = `Optimization process stalled after ${timeDiffMinutes.toFixed(1)} minutes`;
        
        // We'll keep optimizing true but add an error so the frontend can show appropriate message
        // This lets the user decide to try again or continue with partial results
        if (!metadata.optimizationCompleted && metadata.optimizedText) {
          console.log(`CV ${cvId} has partial results available despite stalled optimization`);
          metadata.partialResultsAvailable = true;
        }
        
        // Only update the database if we're adding new information
        if (!metadata.stalledDetected) {
          metadata.stalledDetected = true;
          await updateCVMetadata(cvId, metadata);
        }
      }
      
      // Check if progress hasn't updated in a while but optimization is still running
      if (metadata.lastProgressUpdate) {
        const lastUpdateTime = new Date(metadata.lastProgressUpdate);
        const updateTimeDiffMinutes = (currentTime.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
        
        if (updateTimeDiffMinutes > PROGRESS_STALL_MINUTES && metadata.progress && metadata.progress < 100) {
          console.warn(`Progress for ${cvRecord.fileName} has been stuck at ${metadata.progress}% for ${updateTimeDiffMinutes.toFixed(2)} minutes.`);
          
          // Add progress stalled info but don't change overall status yet
          if (!metadata.progressStalled) {
            metadata.progressStalled = true;
            metadata.progressStalledAt = metadata.progress;
            metadata.progressStalledTime = lastUpdateTime.toISOString();
            await updateCVMetadata(cvId, metadata);
          }
        }
      }
    }

    // Check for state inconsistencies that need fixing
    if (metadata.optimized && metadata.optimizing) {
      console.warn(`CV ${cvRecord.fileName} is marked both as optimized and optimizing - resolving conflict`);
      
      // If we have an optimizedText, then optimization succeeded
      if (metadata.optimizedText) {
        metadata.optimizing = false;
        console.log(`Resolved conflict in favor of completed state since optimized text exists`);
        await updateCVMetadata(cvId, metadata);
      } 
      // Otherwise likely the process crashed in the middle
      else {
        metadata.optimized = false;
        metadata.error = "Previous optimization process did not complete successfully";
        console.log(`Resolved conflict by marking as incomplete since no optimized text exists`);
        await updateCVMetadata(cvId, metadata);
      }
    }

    // Handle the error display logic for the frontend
    let displayError = null;
    if (metadata.error) {
      console.log(`Error found in metadata for ${cvRecord.fileName}: ${metadata.error}`);
      
      // Determine if this error should be displayed to the user
      if (metadata.optimizing && !metadata.optimized) {
        displayError = metadata.error;
      } 
      // If optimization is not in progress and we have an error, also display it
      else if (!metadata.optimizing && metadata.error) {
        displayError = metadata.error;
      }
    }

    // Check if optimized but no text found (critical error)
    if (metadata.optimized && (!metadata.optimizedText || metadata.optimizedText.trim().length === 0)) {
      console.error(`Optimization marked as complete but no optimized text found for ${cvRecord.fileName}`);
      metadata.error = "Optimization completed but no optimized text was found";
      displayError = metadata.error;
      
      // Update the database with this critical error
      await updateCVMetadata(cvId, metadata);
    }

    // Create the response object with all necessary information
    const response = {
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      optimizing: metadata.optimizing || false,
      optimized: metadata.optimized || false,
      progress: metadata.progress || 0,
      error: displayError,
      hasOptimizedText: !!metadata.optimizedText,
      hasOptimizedPDF: !!metadata.optimizedPDFBase64,
      template: metadata.selectedTemplate,
      // Include additional metadata that the frontend might need
      lastOptimizedAt: metadata.lastOptimizedAt,
      optimizationCompleted: metadata.optimizationCompleted || false,
      stalledDetected: metadata.stalledDetected || false,
      progressStalled: metadata.progressStalled || false,
      partialResultsAvailable: metadata.partialResultsAvailable || false
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error checking optimization status:", error);
    return NextResponse.json({ 
      error: 'Failed to check optimization status',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Helper function to update CV metadata in the database
 */
async function updateCVMetadata(cvId: string, metadata: CVMetadata) {
  try {
    // Convert string ID to number
    const cvIdNum = parseInt(cvId, 10);
    if (isNaN(cvIdNum)) {
      throw new Error(`Invalid CV ID: ${cvId}`);
    }
    
    await updateCVAnalysis(cvIdNum, JSON.stringify(metadata));    
    console.log(`Updated metadata for CV ${cvId}`);
    return true;
  } catch (error) {
    console.error(`Failed to update metadata for CV ${cvId}:`, error);
    return false;
  }
} 