import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, like } from 'drizzle-orm';
import { updateCVAnalysis } from '@/lib/db/queries.server';
import { getCVByFileName } from '@/lib/db/queries.server';

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

/**
 * API endpoint to check the status of a CV optimization
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
      
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const fileName = request.nextUrl.searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    // Get the CV record
    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }

    // Parse metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    
    if (!metadata) {
      return NextResponse.json({ error: "No metadata available for this CV" }, { status: 400 });
    }

    // Return the optimization status
    return NextResponse.json({
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      optimizing: metadata.optimizing || false,
      optimized: metadata.optimized || false,
      progress: metadata.progress || 0,
      error: metadata.error || null,
      lastProgressUpdate: metadata.lastProgressUpdate || null,
      lastOptimizedAt: metadata.lastOptimizedAt || null
    });
  } catch (error) {
    console.error("Error checking optimization status:", error);
    return NextResponse.json({ 
      error: `Failed to check optimization status: ${error instanceof Error ? error.message : String(error)}` 
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
    
    console.log(`Updated metadata for CV ${cvId}`);
    return true;
  } catch (error) {
    console.error(`Failed to update metadata for CV ${cvId}:`, error);
    return false;
  }
} 