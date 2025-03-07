import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { extractStructuredDataFromPDF } from '@/lib/pdfToJSON';
import { generateDOCXFromJSON, exportDOCXToBuffer } from '@/lib/jsonToDOCX';
import { convertDOCXToPDF } from '@/lib/docxToPDF';
import { getCVByFileName, updateCVAnalysis } from '@/lib/db/queries.server';
import { optimizeCV, optimizeCVWithAnalysis } from '@/lib/optimizeCV';
import { uploadBufferToStorage } from '@/lib/storage';

/**
 * API endpoint to optimize a CV using the new DOCX-based workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { fileName, templateId } = body;
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }
    
    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId parameter" }, { status: 400 });
    }
    
    // Get CV record
    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }
    
    // Update metadata to show optimization in progress
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    const updatedMetadata = {
      ...metadata,
      optimizing: true,
      optimized: false,
      progress: 10,
      startTime: new Date().toISOString(),
      lastProgressUpdate: new Date().toISOString()
    };
    await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));
    
    // Begin optimization process
    try {
      // Step 1: Get the PDF buffer
      if (!cvRecord.filepath) {
        throw new Error("PDF path not found in CV record");
      }
      
      // We'll process this in the background
      processOptimizationBackground(cvRecord, templateId);
      
      // Return immediate response indicating the process has started
      return NextResponse.json({
        message: "CV optimization started",
        cvId: cvRecord.id,
        fileName: cvRecord.fileName,
        status: "optimizing"
      });
    } catch (error: any) {
      console.error("Error starting optimization:", error);
      
      // Update metadata with error
      const errorMetadata = {
        ...updatedMetadata,
        optimizing: false,
        error: `Optimization failed: ${error.message}`,
        errorTimestamp: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(errorMetadata));
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in CV optimization API route:", error.message);
    return NextResponse.json({ error: `CV optimization failed: ${error.message}` }, { status: 500 });
  }
}

/**
 * Process the optimization in the background to avoid timeouts
 */
async function processOptimizationBackground(cvRecord: any, templateId: string): Promise<void> {
  // Run this asynchronously
  (async () => {
    try {
      console.log(`Starting CV optimization for: ${cvRecord.id}, template: ${templateId || 'default'}`);
      
      // Step 1: Parse metadata
      const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      
      // Step 2: Extract text from the PDF (we already have it in rawText)
      const cvText = cvRecord.rawText;
      if (!cvText || cvText.trim().length === 0) {
        throw new Error("CV text content is missing or empty");
      }
      
      // Update progress to 20%
      await updateProgress(cvRecord.id, 20);
      
      // Step 3: Extract structured data from the CV text
      const structuredData = {
        sections: extractSections(cvText),
        nameAndContact: extractNameAndContact(cvText),
        analysis: analyzeCV(cvText),
        originalText: cvText
      };
      
      // Update progress to 30%
      await updateProgress(cvRecord.id, 30);
      
      // Step 4: Generate DOCX from structured data
      const docx = generateDOCXFromJSON(structuredData, templateId);
      const docxBuffer = await exportDOCXToBuffer(docx);
      
      // Update progress to 40%
      await updateProgress(cvRecord.id, 40);
      
      // Step 5: Convert DOCX to PDF for preview
      const pdfBuffer = await convertDOCXToPDF(docxBuffer);
      
      // Update progress to 60%
      await updateProgress(cvRecord.id, 60);
      
      // Step 6: Upload optimized PDF to storage
      const optimizedFilePath = `${cvRecord.userId}/optimized/${Date.now()}_${cvRecord.fileName}`;
      const fileURL = await uploadBufferToStorage(pdfBuffer, optimizedFilePath);
      
      // Update progress to 80%
      await updateProgress(cvRecord.id, 80);
      
      // Step 7: Update metadata with optimization results
      const pdfBase64 = pdfBuffer.toString('base64');
      const finalMetadata = {
        ...metadata,
        optimized: true,
        optimizing: false,
        optimizedPDFBase64: pdfBase64,
        selectedTemplate: templateId,
        optimizedFilePath: fileURL,
        optimizedText: cvText, // Keep the original text since we're just reformatting
        progress: 100,
        lastProgressUpdate: new Date().toISOString(),
        lastOptimizedAt: new Date().toISOString(),
        optimizationCompleted: true
      };
      
      await updateCVAnalysis(cvRecord.id, JSON.stringify(finalMetadata));
      console.log(`CV optimization completed successfully for: ${cvRecord.id}`);
    } catch (error: any) {
      console.error("Error during background optimization:", error);
      
      // Update metadata with error
      try {
        const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
        const errorMetadata = {
          ...metadata,
          optimizing: false,
          error: `Optimization failed: ${error.message}`,
          errorTimestamp: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(errorMetadata));
      } catch (metadataError) {
        console.error("Failed to update error metadata:", metadataError);
      }
    }
  })().catch(error => {
    console.error("Unhandled error in background process:", error);
  });
}

/**
 * Helper function to update progress
 */
async function updateProgress(cvId: number, progress: number): Promise<void> {
  try {
    const cvRecord = await getCVByFileName(cvId.toString());
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
    
    await updateCVAnalysis(cvId, JSON.stringify(updatedMetadata));
    console.log(`Updated progress to ${progress}% for CV ${cvId}`);
  } catch (error) {
    console.error(`Failed to update progress for CV ${cvId}:`, error);
  }
}

// Helper functions
function extractSections(text: string): Record<string, string> {
  // Import from optimizeCV.ts to avoid circular dependencies
  const { extractSections } = require("@/lib/optimizeCV");
  return extractSections(text);
}

function analyzeCV(text: string): any {
  // Import from optimizeCV.ts to avoid circular dependencies
  const { analyzeCVContent } = require("@/lib/optimizeCV");
  return analyzeCVContent(text);
}

function extractNameAndContact(text: string): any {
  // Extract name and contact info from text
  const lines = text.split('\n').filter(line => line.trim());
  
  const result = {
    firstName: 'NAME',
    lastName: 'LAST NAME',
    jobTitle: 'JOB OCCUPIED',
    phone: '',
    email: '',
    location: ''
  };
  
  // First line is often the name
  if (lines.length > 0) {
    const nameParts = lines[0].split(' ');
    if (nameParts.length >= 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts.slice(1).join(' ');
    }
  }
  
  // Look for email, phone, and location
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    if (line.includes('@')) {
      result.email = line.trim();
    } else if (line.match(/\+?[\d\s-]{7,}/)) {
      result.phone = line.trim();
    } else if (line.match(/[A-Za-z]+,\s*[A-Za-z]+/) || line.includes('USA') || line.includes('UK')) {
      result.location = line.trim();
    } else if (line.match(/director|manager|engineer|developer|designer|consultant|specialist|analyst|coordinator/i) && result.jobTitle === 'JOB OCCUPIED') {
      result.jobTitle = line.trim();
    }
  }
  
  return result;
} 