import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { convertDocxToPdf } from "@/lib/docxToPdfConverter";
import { saveFile, FileType, StorageType } from "@/lib/fileStorage";
import * as path from "path";
import * as fs from "fs";
import { promises as fsPromises } from "fs";

export async function POST(request: Request) {
  console.log("PDF conversion API called");
  
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      console.error("Unauthorized: No valid session found");
      return NextResponse.json(
        { success: false, error: "You must be logged in to convert files." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`Request from user: ${userId}`);
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid request format." },
        { status: 400 }
      );
    }
    
    const { cvId, docxBase64, forceRefresh } = body;
    
    // Handle direct docxBase64 conversion (no CV ID needed)
    if (docxBase64 && typeof docxBase64 === 'string') {
      console.log("Converting directly provided docxBase64 data to PDF");
      
      try {
        // Create temp directory for DOCX file
        const tempDir = path.join(process.cwd(), "tmp");
        await fsPromises.mkdir(tempDir, { recursive: true });
        
        // Create temp DOCX file from base64
        const tempDocxPath = path.join(tempDir, `temp-docx-direct-${Date.now()}.docx`);
        await fsPromises.writeFile(tempDocxPath, Buffer.from(docxBase64, 'base64'));
        console.log(`Created temporary DOCX file at: ${tempDocxPath}`);
        
        // Convert the temp DOCX to PDF
        const pdfFileName = `converted-document-${Date.now()}.pdf`;
        
        const conversionResult = await convertDocxToPdf(
          tempDocxPath,
          tempDir,
          pdfFileName
        );
        
        if (!conversionResult.success) {
          console.error(`PDF conversion failed: ${conversionResult.error}`);
          return NextResponse.json(
            { success: false, error: conversionResult.error || "PDF conversion failed." },
            { status: 500 }
          );
        }
        
        // Clean up temp file
        try {
          await fsPromises.unlink(tempDocxPath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp file: ${tempDocxPath}`, cleanupError);
        }
        
        return NextResponse.json({
          success: true,
          message: "DOCX data successfully converted to PDF.",
          fileName: pdfFileName,
          pdfBase64: conversionResult.base64,
        });
      } catch (error) {
        console.error("Error converting direct docxBase64 to PDF:", error);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to convert DOCX data to PDF: ${error instanceof Error ? error.message : String(error)}` 
          },
          { status: 500 }
        );
      }
    }
    
    // If no direct docxBase64 provided, we need a CV ID
    if (!cvId) {
      console.error("Missing CV ID in request and no docxBase64 provided");
      return NextResponse.json(
        { success: false, error: "Missing CV ID or docxBase64 data." },
        { status: 400 }
      );
    }
    
    console.log(`Processing convert-to-pdf request for CV ID: ${cvId}`);
    
    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId.toString())),
    });
    
    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} tried to access CV ${cvId} belonging to user ${cvRecord.userId}`);
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
      console.error("Error parsing metadata:", error);
      return NextResponse.json(
        { success: false, error: "Invalid CV metadata." },
        { status: 500 }
      );
    }
    
    // Check if we already have PDF data in the metadata and are not forcing refresh
    if (!forceRefresh && metadata.optimizedPdfBase64) {
      console.log("Using previously generated PDF data from metadata");
      return NextResponse.json({
        success: true,
        message: "PDF data retrieved from metadata.",
        fileName: metadata.optimizedPdfFileName || `optimized-cv-${cvId}.pdf`,
        pdfBase64: metadata.optimizedPdfBase64,
      });
    }
    
    // Use provided docxBase64 or get from metadata
    let docxData = docxBase64;
    
    // Check if we have DocX base64 in the metadata if not provided directly
    if (!docxData && metadata.optimizedDocxBase64) {
      console.log("Found DOCX base64 data in metadata, will convert to PDF");
      docxData = metadata.optimizedDocxBase64;
    }
    
    if (docxData) {
      // Create temp directory for DOCX file
      const tempDir = path.join(process.cwd(), "tmp");
      await fsPromises.mkdir(tempDir, { recursive: true });
      
      // Create temp DOCX file from base64
      const tempDocxPath = path.join(tempDir, `temp-docx-${cvId}-${Date.now()}.docx`);
      await fsPromises.writeFile(tempDocxPath, Buffer.from(docxData, 'base64'));
      console.log(`Created temporary DOCX file at: ${tempDocxPath}`);
      
      // Convert the temp DOCX to PDF
      const pdfFileName = `optimized-cv-${cvId}-${Date.now()}.pdf`;
      
      const conversionResult = await convertDocxToPdf(
        tempDocxPath,
        tempDir,
        pdfFileName
      );
      
      if (!conversionResult.success) {
        console.error(`PDF conversion failed: ${conversionResult.error}`);
        return NextResponse.json(
          { success: false, error: conversionResult.error || "PDF conversion failed." },
          { status: 500 }
        );
      }
      
      // Update metadata with PDF information
      metadata.optimizedPdfFileName = pdfFileName;
      metadata.optimizedPdfFilePath = conversionResult.filePath;
      metadata.optimizedPdfBase64 = conversionResult.base64;
      metadata.lastConvertedAt = new Date().toISOString();
      
      await db
        .update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, cvRecord.id));
        
      console.log(`PDF conversion completed successfully for CV ${cvId}`);
      
      // Clean up temp file
      try {
        await fsPromises.unlink(tempDocxPath);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temp file: ${tempDocxPath}`, cleanupError);
      }
      
      return NextResponse.json({
        success: true,
        message: "DOCX file successfully converted to PDF.",
        fileName: pdfFileName,
        pdfBase64: conversionResult.base64,
      });
    }
    
    // Check if optimized DOCX file path exists
    if (!metadata.optimizedDocxFilePath) {
      console.error("No DOCX file path found in metadata");
      return NextResponse.json(
        { success: false, error: "Optimized DOCX file not found." },
        { status: 400 }
      );
    }
    
    const docxPath = metadata.optimizedDocxFilePath;
    console.log(`Using DOCX file from path: ${docxPath}`);
    
    const outputDir = path.join(process.cwd(), "tmp");
    const pdfFileName = `optimized-cv-${cvId}-${Date.now()}.pdf`;
    
    try {
      // Convert DOCX to PDF
      console.log("Starting DOCX to PDF conversion");
      const conversionResult = await convertDocxToPdf(
        docxPath,
        outputDir,
        pdfFileName
      );
      
      if (!conversionResult.success) {
        console.error(`PDF conversion failed: ${conversionResult.error}`);
        return NextResponse.json(
          { success: false, error: conversionResult.error || "PDF conversion failed." },
          { status: 500 }
        );
      }
      
      // Save the PDF file to storage (optionally)
      let storageFilePath = conversionResult.filePath;
      let fileMetadata;
      
      try {
        fileMetadata = await saveFile(
          Buffer.from(conversionResult.base64 || "", "base64"),
          pdfFileName,
          'pdf' as FileType,
          'local' as StorageType
        );
        storageFilePath = fileMetadata.filePath;
        console.log(`Saved PDF to storage at: ${storageFilePath}`);
      } catch (storageError) {
        console.error("Error saving PDF to storage:", storageError);
        // Continue anyway, we still have the local file
      }
      
      // Update metadata with PDF file information
      metadata = {
        ...metadata,
        optimizedPdfFilePath: storageFilePath,
        optimizedPdfFileName: pdfFileName,
        optimizedPdfBase64: conversionResult.base64, // Store base64 data in metadata for quick access
        lastConvertedAt: new Date().toISOString(),
      };
      
      // Update CV record with new metadata
      await db
        .update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, cvRecord.id));
      
      console.log(`PDF conversion completed successfully for CV ${cvId}`);
      
      // Return success with file data
      return NextResponse.json({
        success: true,
        message: "DOCX file successfully converted to PDF.",
        fileName: pdfFileName,
        pdfBase64: conversionResult.base64,
      });
      
    } catch (error) {
      console.error("Error converting DOCX to PDF:", error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to convert DOCX to PDF: ${error instanceof Error ? error.message : String(error)}` 
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in convert-to-pdf API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request." },
      { status: 500 }
    );
  }
} 