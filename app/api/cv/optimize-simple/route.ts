import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Import directly from the module file
import { extractSections } from '@/lib/optimizeCV.fixed';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { fileName } = body;
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }
    
    // Get the CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.fileName, fileName)
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Update metadata to indicate optimization is in progress
    let metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = true;
    metadata.progress = 10;
    metadata.startTime = new Date().toISOString();
    
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(metadata)
      })
      .where(eq(cvs.id, cvRecord.id));
    
    // Start the background process
    startSimpleProcess(cvRecord);
    
    // Return immediate response
    return NextResponse.json({
      message: "Simple optimization process started",
      status: "optimizing",
      progress: 10
    });
    
  } catch (error) {
    console.error("Error starting simple optimization:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to start simple optimization: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * Start a simplified background process
 */
function startSimpleProcess(cvRecord: any) {
  // Run this asynchronously
  (async () => {
    try {
      // Get the raw text from the record
      const cvText = cvRecord.rawText || '';
      
      // Update progress
      await updateSimpleMetadata(cvRecord.id, { progress: 50 });
      
      // Just check if extractSections is a function
      if (typeof extractSections !== 'function') {
        throw new Error("extractSections is not a function");
      }
      
      // Try to extract sections
      const sections = extractSections(cvText);
      
      // Mark as complete
      await updateSimpleMetadata(cvRecord.id, {
        progress: 100,
        optimized: true,
        optimizing: false,
        completedAt: new Date().toISOString(),
        optimizedText: JSON.stringify(sections)
      });
      
      console.log(`Simple optimization completed for CV ${cvRecord.id}`);
    } catch (error) {
      console.error("Error in simple process:", error);
      
      // Update metadata with error
      await updateSimpleMetadata(cvRecord.id, {
        error: error instanceof Error ? error.message : String(error),
        errorTimestamp: new Date().toISOString(),
        optimizing: false
      });
    }
  })().catch(error => {
    console.error("Unhandled error in simple process:", error);
  });
}

/**
 * Update the metadata for a CV
 */
async function updateSimpleMetadata(cvId: number, updates: Record<string, any>): Promise<void> {
  try {
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });
    
    if (!cvRecord) {
      console.error(`CV not found for ID: ${cvId}`);
      return;
    }
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    const updatedMetadata = {
      ...metadata,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, cvId));
      
    console.log(`Updated simple metadata for CV ${cvId}:`, updates);
  } catch (error) {
    console.error(`Failed to update simple metadata for CV ${cvId}:`, error);
  }
} 