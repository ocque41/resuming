import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Local implementation of extractSections to avoid import issues
 */
function localExtractSections(text: string): Record<string, string> {
  // Initialize with more section types to better capture CV content
  const sections: Record<string, string> = {
    contact: '',
    profile: '',
    experience: '',
    education: '',
    skills: '',
    projects: '',
    certifications: '',
    languages: '',
    achievements: '',
    interests: '',
    publications: '',
    references: '',
    volunteer: '',
    awards: ''
  };
  
  // Simple parsing logic - in real app would be more sophisticated
  const lines = text.split('\n');
  let currentSection = 'profile';
  
  // First pass: detect section headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    
    if (line.includes('experience') || line.includes('employment') || line.includes('work history')) {
      currentSection = 'experience';
      continue;
    }
    
    if (line.includes('education') || line.includes('academic') || line.includes('qualification')) {
      currentSection = 'education';
      continue;
    }
    
    if (line.includes('skills') || line.includes('competences') || line.includes('abilities')) {
      currentSection = 'skills';
      continue;
    }
    
    if (line.includes('profile') || line.includes('summary') || line.includes('objective') || line.includes('about')) {
      currentSection = 'profile';
      continue;
    }
    
    if (line.includes('language') || line.includes('languages')) {
      currentSection = 'languages';
      continue;
    }
    
    // Add content to current section
    sections[currentSection] += lines[i] + '\n';
  }
  
  return sections;
}

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
    startLocalProcess(cvRecord);
    
    // Return immediate response
    return NextResponse.json({
      message: "Local optimization process started",
      status: "optimizing",
      progress: 10
    });
    
  } catch (error) {
    console.error("Error starting local optimization:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to start local optimization: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * Start a process using local functions
 */
function startLocalProcess(cvRecord: any) {
  // Run this asynchronously
  (async () => {
    try {
      // Get the raw text from the record
      const cvText = cvRecord.rawText || '';
      
      // Update progress
      await updateLocalMetadata(cvRecord.id, { progress: 50 });
      
      // Use the local implementation
      const sections = localExtractSections(cvText);
      
      // Mark as complete
      await updateLocalMetadata(cvRecord.id, {
        progress: 100,
        optimized: true,
        optimizing: false,
        completedAt: new Date().toISOString(),
        optimizedText: JSON.stringify(sections)
      });
      
      console.log(`Local optimization completed for CV ${cvRecord.id}`);
    } catch (error) {
      console.error("Error in local process:", error);
      
      // Update metadata with error
      await updateLocalMetadata(cvRecord.id, {
        error: error instanceof Error ? error.message : String(error),
        errorTimestamp: new Date().toISOString(),
        optimizing: false
      });
    }
  })().catch(error => {
    console.error("Unhandled error in local process:", error);
  });
}

/**
 * Update the metadata for a CV
 */
async function updateLocalMetadata(cvId: number, updates: Record<string, any>): Promise<void> {
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
      
    console.log(`Updated local metadata for CV ${cvId}:`, updates);
  } catch (error) {
    console.error(`Failed to update local metadata for CV ${cvId}:`, error);
  }
} 