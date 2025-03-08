import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Import the entire module to avoid bundling issues
import * as optimizeCVModule from '@/lib/optimizeCV.fixed';
import { getOriginalPdfBytes, extractTextFromPdf } from '@/lib/storage';

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

/**
 * API endpoint to optimize a CV using the new DOCX-based workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { fileName, templateId } = body;
    
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
    
    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
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
    startBackgroundProcess(cvRecord, templateId);
    
    // Return immediate response
    return NextResponse.json({
      message: "Optimization process started",
      status: "optimizing",
      progress: 10
    });
    
  } catch (error) {
    console.error("Error starting optimization:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to start optimization: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * Start the background optimization process
 */
function startBackgroundProcess(cvRecord: any, templateId: string) {
  // Run this asynchronously
  (async () => {
    try {
      // Get the PDF text
      const pdfBytes = await getOriginalPdfBytes(cvRecord);
      const cvText = await extractTextFromPdf(pdfBytes);
      
      // Update progress
      await updateMetadata(cvRecord.id, { progress: 20 });
      
      // Extract sections using the module
      const sections = optimizeCVModule.extractSections(cvText);
      
      // Update progress
      await updateMetadata(cvRecord.id, { 
        progress: 50,
        optimizedText: JSON.stringify(sections)
      });
      
      // Mark as complete
      await updateMetadata(cvRecord.id, {
        progress: 100,
        optimized: true,
        optimizing: false,
        completedAt: new Date().toISOString()
      });
      
      console.log(`Optimization completed for CV ${cvRecord.id}`);
    } catch (error) {
      console.error("Error in background process:", error);
      
      // Update metadata with error
      await updateMetadata(cvRecord.id, {
        error: error instanceof Error ? error.message : String(error),
        errorTimestamp: new Date().toISOString(),
        optimizing: false
      });
    }
  })().catch(error => {
    console.error("Unhandled error in background process:", error);
  });
}

/**
 * Update the metadata for a CV
 */
async function updateMetadata(cvId: number, updates: Record<string, any>): Promise<void> {
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
      
    console.log(`Updated metadata for CV ${cvId}:`, updates);
  } catch (error) {
    console.error(`Failed to update metadata for CV ${cvId}:`, error);
  }
}

/**
 * Extract name and contact information from CV text
 */
function extractNameAndContact(text: string): any {
  // Extract name and contact info from text
  const lines = text.split('\n').filter(line => line.trim());
  
  const result = {
    firstName: 'NAME',
    lastName: 'LAST NAME',
    jobTitle: 'JOB OCCUPIED',
    phone: '+1 234 567 890',
    email: 'email@example.com',
    location: 'City, Country'
  };
  
  // Try to extract real name from first lines
  if (lines.length > 0) {
    const nameLine = lines[0].trim();
    const nameParts = nameLine.split(' ');
    
    if (nameParts.length >= 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts.slice(1).join(' ');
    }
    
    // Try to extract job title from second line
    if (lines.length > 1) {
      result.jobTitle = lines[1].trim();
    }
    
    // Look for email and phone in the first few lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      
      // Email pattern
      if (line.includes('@') && line.includes('.')) {
        const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          result.email = emailMatch[0];
        }
      }
      
      // Phone pattern
      if (line.match(/\+?\d[\d\s-]{7,}/)) {
        const phoneMatch = line.match(/\+?\d[\d\s-]{7,}/);
        if (phoneMatch) {
          result.phone = phoneMatch[0];
        }
      }
      
      // Location pattern - look for city, country format
      if (line.includes(',') && !line.includes('@')) {
        result.location = lines[i].trim();
      }
    }
  }
  
  return result;
} 