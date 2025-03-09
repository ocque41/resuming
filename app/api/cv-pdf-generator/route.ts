import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { convertDOCXToPDF } from "@/lib/docxToPDF";
import { generateCVDocx, parseStandardCVFromSections } from "@/lib/docxGenerator";
import { apiLogger } from "@/lib/logger";

/**
 * API endpoint to retrieve the optimized PDF for a specific CV
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
      
    if (!session || !session.user) {
      apiLogger.warn("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    
    if (!cvId) {
      apiLogger.warn("Missing cvId parameter", { userId });
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    // Get the CV record
    const cvIdNum = parseInt(cvId, 10);
    if (isNaN(cvIdNum)) {
      apiLogger.warn("Invalid cvId parameter", { userId, cvId });
      return NextResponse.json({ error: "Invalid cvId parameter" }, { status: 400 });
    }

    apiLogger.info(`Processing PDF generation request for CV ${cvIdNum}`, { userId, cvId: cvIdNum });

    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvIdNum),
    });

    if (!cvRecord) {
      apiLogger.warn(`CV not found with ID: ${cvIdNum}`, { userId });
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Verify ownership
    if (cvRecord.userId !== userId) {
      apiLogger.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }

    // Parse metadata
    let metadata = null;
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    } catch (parseError) {
      apiLogger.error(`Error parsing CV metadata for CV ${cvRecord.id}`, parseError as Error, { userId, cvId: cvRecord.id });
      return NextResponse.json({ error: "Invalid CV metadata" }, { status: 500 });
    }
    
    if (!metadata) {
      apiLogger.warn(`No metadata available for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
      return NextResponse.json({ error: "No metadata available for this CV" }, { status: 400 });
    }

    // Check if the CV has been optimized
    if (!metadata.optimized && !metadata.optimizedText) {
      apiLogger.warn(`CV ${cvRecord.id} has not been optimized yet`, { userId, cvId: cvRecord.id });
      return NextResponse.json({ error: "CV has not been optimized yet" }, { status: 400 });
    }

    // Check if we already have the optimized PDF data
    if (metadata.optimizedPdfBase64) {
      apiLogger.info(`Returning cached optimized PDF for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
      return NextResponse.json({ 
        pdfBase64: metadata.optimizedPdfBase64,
        message: "Retrieved cached optimized PDF"
      });
    }

    // If we have a DOCX buffer in the metadata, try to convert it to PDF
    if (metadata.optimizedDocxBase64) {
      try {
        apiLogger.info(`Converting cached DOCX to PDF for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
        const docxBuffer = Buffer.from(metadata.optimizedDocxBase64, 'base64');
        
        // Use our improved DOCX to PDF conversion
        const { pdfBuffer, conversionSuccessful } = await convertDOCXToPDF(docxBuffer);
        
        if (conversionSuccessful && pdfBuffer) {
          // Convert to base64
          const pdfBase64 = pdfBuffer.toString('base64');
          
          // Cache the PDF data in metadata for future requests
          metadata.optimizedPdfBase64 = pdfBase64;
          await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
          
          apiLogger.info(`Successfully converted DOCX to PDF for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
          return NextResponse.json({ 
            pdfBase64,
            message: "Generated optimized PDF from cached DOCX"
          });
        } else {
          // If conversion failed, return the DOCX data
          apiLogger.warn(`DOCX to PDF conversion failed for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
          return NextResponse.json({ 
            docxBase64: metadata.optimizedDocxBase64,
            error: "PDF conversion failed, but DOCX is available for download",
            message: "PDF conversion failed, but DOCX is available for download"
          });
        }
      } catch (conversionError) {
        apiLogger.error(`Error converting DOCX to PDF for CV ${cvRecord.id}`, conversionError as Error, { userId, cvId: cvRecord.id });
        // Return the DOCX data if PDF conversion fails
        return NextResponse.json({ 
          docxBase64: metadata.optimizedDocxBase64,
          error: "PDF conversion failed, but DOCX is available for download",
          message: "PDF conversion failed, but DOCX is available for download"
        });
      }
    }

    // If we don't have the PDF or DOCX data but have optimized text, generate the DOCX and PDF
    if (metadata.optimizedText) {
      try {
        apiLogger.info(`Generating DOCX and PDF from optimized text for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
        
        // Get the template if specified
        let template = undefined;
        if (metadata.templateId) {
          apiLogger.debug(`Using template ID from metadata: ${metadata.templateId}`, { userId, cvId: cvRecord.id });
          template = getTemplateById(metadata.templateId);
        } else if (metadata.selectedTemplate) {
          apiLogger.debug(`Using selectedTemplate from metadata: ${metadata.selectedTemplate}`, { userId, cvId: cvRecord.id });
          template = getTemplateById(metadata.selectedTemplate);
        } else {
          apiLogger.debug("No template specified, using default", { userId, cvId: cvRecord.id });
          template = getTemplateById('professional-classic');
        }
        
        // Parse the optimized text into sections
        const sections = parseTextIntoSections(metadata.optimizedText);
        
        // Convert sections to StandardCV format
        const standardCV = parseStandardCVFromSections(sections);
        
        // Generate DOCX
        const docxBuffer = await generateCVDocx(standardCV);
        
        // Convert DOCX to base64
        const docxBase64 = docxBuffer.toString('base64');
        
        // Store the DOCX data in metadata
        metadata.optimizedDocxBase64 = docxBase64;
        await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
        
        // Convert DOCX to PDF
        const { pdfBuffer, conversionSuccessful } = await convertDOCXToPDF(docxBuffer);
        
        if (conversionSuccessful && pdfBuffer) {
          // Convert to base64
          const pdfBase64 = pdfBuffer.toString('base64');
          
          // Cache the PDF data in metadata for future requests
          metadata.optimizedPdfBase64 = pdfBase64;
          await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
          
          apiLogger.info(`Successfully generated PDF for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
          return NextResponse.json({ 
            pdfBase64,
            docxBase64,
            message: "Generated optimized PDF and DOCX"
          });
        } else {
          // If PDF conversion failed, return the DOCX data
          apiLogger.warn(`PDF conversion failed for CV ${cvRecord.id}, returning DOCX data only`, { userId, cvId: cvRecord.id });
          return NextResponse.json({ 
            docxBase64,
            error: "PDF conversion failed, but DOCX is available for download",
            message: "PDF conversion failed, but DOCX is available for download"
          });
        }
      } catch (error) {
        apiLogger.error(`Error generating PDF or DOCX for CV ${cvRecord.id}`, error as Error, { userId, cvId: cvRecord.id });
        return NextResponse.json({ 
          error: `Failed to generate PDF or DOCX: ${error instanceof Error ? error.message : String(error)}` 
        }, { status: 500 });
      }
    }

    // If we don't have optimized text, return an error
    apiLogger.warn(`No optimized text available for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
    return NextResponse.json({ error: "No optimized text available to generate PDF" }, { status: 400 });
  } catch (error) {
    apiLogger.error("Error retrieving optimized PDF", error as Error);
    return NextResponse.json({ 
      error: `Failed to retrieve optimized PDF: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

// Helper function to update CV analysis metadata
async function updateCVAnalysis(cvId: number, metadata: string) {
  try {
    // Import the function dynamically to avoid circular dependencies
    const { updateCVAnalysis } = await import("@/lib/db/queries.server");
    return await updateCVAnalysis(cvId, metadata);
  } catch (error) {
    apiLogger.error(`Error updating CV analysis for CV ${cvId}`, error as Error);
    throw error;
  }
}

// Helper function to parse text into sections
function parseTextIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Split the text by section headings (lines starting with ## or #)
  const lines = text.split('\n');
  let currentSection = 'General';
  let currentContent = '';
  
  for (const line of lines) {
    if (line.startsWith('##') || line.startsWith('#')) {
      // Save the previous section
      if (currentContent.trim()) {
        sections[currentSection] = currentContent.trim();
      }
      
      // Start a new section
      currentSection = line.replace(/^#+\s*/, '').trim();
      currentContent = '';
    } else {
      // Add to the current section content
      currentContent += line + '\n';
    }
  }
  
  // Save the last section
  if (currentContent.trim()) {
    sections[currentSection] = currentContent.trim();
  }
  
  return sections;
} 