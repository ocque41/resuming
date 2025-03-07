import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { convertDOCXToPDF } from '@/lib/docxToPDF';
import { generateDOCXFromJSON, exportDOCXToBuffer } from '@/lib/jsonToDOCX';
import { 
  optimizeCV, 
  optimizeCVWithAnalysis, 
  extractSections as extractCVSections,
  analyzeCVContent
} from '@/lib/optimizeCV';
import { uploadBufferToStorage, getOriginalPdfBytes, extractTextFromPdf } from '@/lib/storage';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';

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
    // Authenticate user using the new auth system
    const session = await auth();
     
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Convert string ID to number for database operations
    const userId = parseInt(session.user.id, 10);
    
    if (isNaN(userId)) {
      console.error(`Invalid user ID: ${session.user.id}`);
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }
    
    // Parse request body
    const body = await request.json();
    const { fileName, templateId, includePhoto } = body;
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }
    
    // Get the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.fileName, fileName)
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Check if the CV belongs to the authenticated user
    if (cvRecord.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }
    
    // Initialize metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Update metadata to indicate optimization is in progress
    metadata.optimizing = true;
    metadata.progress = 10;
    metadata.startTime = new Date().toISOString();
    metadata.lastProgressUpdate = new Date().toISOString();
    
    // Save the updated metadata
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(metadata)
      })
      .where(eq(cvs.id, cvRecord.id));
    
    // We'll process this in the background
    processOptimizationBackground(cvRecord, templateId, includePhoto);
    
    // Return immediate response indicating the process has started
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
 * Process the optimization in the background to avoid timeouts
 */
async function processOptimizationBackground(cvRecord: any, templateId: string, includePhoto: boolean): Promise<void> {
  // Run this asynchronously
  (async () => {
    let metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    try {
      // Step 1: Get the PDF buffer
      if (!cvRecord.filepath) {
        throw new Error("PDF path not found in CV record");
      }
      
      // Clear any previous errors
      delete metadata.error;
      delete metadata.errorTimestamp;
      
      // Step 2: Extract text from PDF
      const pdfBytes = await getOriginalPdfBytes(cvRecord);
      const cvText = await extractTextFromPdf(pdfBytes);
      
      if (!cvText || cvText.trim().length === 0) {
        throw new Error("Failed to extract text from PDF or PDF is empty");
      }
      
      // Update progress to 20%
      await updateProgress(cvRecord.id, 20);
      
      // Step 3: Extract structured data from the PDF
      const structuredData = {
        sections: extractCVSections(cvText),
        nameAndContact: extractNameAndContact(cvText),
        analysis: analyzeCV(cvText),
        originalText: cvText
      };
      
      // Update progress to 30%
      await updateProgress(cvRecord.id, 30);
      
      // Check if we should include a photo
      let photoData;
      if (includePhoto && metadata.photoData) {
        photoData = metadata.photoData;
      }
      
      // Step 4: Generate DOCX from structured data
      const docx = await generateDOCXFromJSON(structuredData, templateId, photoData);
      const docxBuffer = await exportDOCXToBuffer(docx);
      
      // Update progress to 40%
      await updateProgress(cvRecord.id, 40);
      
      // Step 5: Try to convert DOCX to PDF, but use fallback if it fails
      const conversionResult = await convertDOCXToPDF(docxBuffer);
      
      // Store the DOCX for later use regardless of PDF conversion success
      const docxPath = `/cv-optimized/${cvRecord.id}/optimized.docx`;
      await uploadBufferToStorage(docxBuffer, docxPath);
      
      // Update progress based on conversion result
      if (conversionResult.conversionSuccessful) {
        // If conversion worked, update to 60%
        await updateProgress(cvRecord.id, 60);
        
        // Step 6: Save optimized PDF to storage
        if (conversionResult.pdfBuffer) {
          const pdfPath = `/cv-optimized/${cvRecord.id}/optimized.pdf`;
          await uploadBufferToStorage(conversionResult.pdfBuffer, pdfPath);
        } else {
          throw new Error("PDF conversion produced null buffer");
        }
      } else {
        // Conversion failed or used fallback, so we'll save metadata about the DOCX
        await updateProgress(cvRecord.id, 50);
        metadata.docxOnly = true;
        metadata.docxPath = docxPath;
      }
      
      // Update progress to 80%
      await updateProgress(cvRecord.id, 80);
      
      // Step 7: Update CV record with results
      metadata.optimized = true;
      metadata.optimizing = false;
      metadata.error = null;
      metadata.progress = 100;
      metadata.selectedTemplate = templateId;
      metadata.completedAt = new Date().toISOString();
      metadata.docxPath = docxPath;
      
      // Create base64 version of PDF if available for download
      if (conversionResult.conversionSuccessful && conversionResult.pdfBuffer) {
        metadata.optimizedPDFBase64 = conversionResult.pdfBuffer.toString('base64');
      }
      
      // Store original file details for reference
      metadata.originalFileName = cvRecord.fileName;
      
      // Save the optimized text in the metadata - this is important for recovery
      if (structuredData.sections) {
        metadata.optimizedText = JSON.stringify(structuredData.sections);
      }
      
      // If we have the structured data, store it for potential reuse
      metadata.structuredData = structuredData;
      
      // Save all updates to the database
      await db.update(cvs)
        .set({
          metadata: JSON.stringify(metadata)
        })
        .where(eq(cvs.id, cvRecord.id));
      
      console.log(`Optimization completed for CV ${cvRecord.id}`);
      
    } catch (error) {
      console.error("Error during background optimization:", error);
      
      // Update metadata with error information
      metadata.error = error instanceof Error ? error.message : String(error);
      metadata.errorTimestamp = new Date().toISOString();
      metadata.optimizing = false;
      
      // If we have partial progress, mark it
      if (metadata.progress && metadata.progress > 0) {
        metadata.partialOptimization = true;
      }
      
      // Save the error information to the database
      try {
        await db.update(cvs)
          .set({
            metadata: JSON.stringify(metadata)
          })
          .where(eq(cvs.id, cvRecord.id));
      } catch (dbError) {
        console.error("Failed to update CV record with error information:", dbError);
      }
    }
  })().catch(error => {
    console.error("Unhandled error in background optimization process:", error);
  });
}

/**
 * Helper function to update progress
 */
async function updateProgress(cvId: number, progress: number): Promise<void> {
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
      progress,
      lastProgressUpdate: new Date().toISOString()
    };
    
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, cvId));
    console.log(`Updated progress to ${progress}% for CV ${cvId}`);
  } catch (error) {
    console.error(`Failed to update progress for CV ${cvId}:`, error);
  }
}

// Helper functions
function analyzeCV(text: string): any {
  // Use the imported analyzeCVContent function
  return analyzeCVContent(text);
}

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