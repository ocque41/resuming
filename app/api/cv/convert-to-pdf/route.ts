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
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "You must be logged in to convert files." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { cvId } = body;
    
    if (!cvId) {
      return NextResponse.json(
        { error: "Missing CV ID." },
        { status: 400 }
      );
    }
    
    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId.toString())),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { error: "You don't have permission to access this CV." },
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
        { error: "Invalid CV metadata." },
        { status: 500 }
      );
    }
    
    // Check if optimized DOCX exists
    if (!metadata.optimizedDocxFilePath) {
      return NextResponse.json(
        { error: "Optimized DOCX file not found." },
        { status: 400 }
      );
    }
    
    const docxPath = metadata.optimizedDocxFilePath;
    const outputDir = path.join(process.cwd(), "tmp");
    const pdfFileName = `optimized-cv-${cvId}-${Date.now()}.pdf`;
    
    try {
      // Convert DOCX to PDF
      const conversionResult = await convertDocxToPdf(
        docxPath,
        outputDir,
        pdfFileName
      );
      
      if (!conversionResult.success) {
        return NextResponse.json(
          { error: conversionResult.error || "PDF conversion failed." },
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
      } catch (storageError) {
        console.error("Error saving PDF to storage:", storageError);
        // Continue anyway, we still have the local file
      }
      
      // Update metadata with PDF file information
      metadata = {
        ...metadata,
        optimizedPdfFilePath: storageFilePath,
        optimizedPdfFileName: pdfFileName,
        lastConvertedAt: new Date().toISOString(),
      };
      
      // Update CV record with new metadata
      await db
        .update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, cvRecord.id));
      
      // Return success with file data
      return NextResponse.json({
        message: "DOCX file successfully converted to PDF.",
        fileName: pdfFileName,
        pdfBase64: conversionResult.base64,
      });
      
    } catch (error) {
      console.error("Error converting DOCX to PDF:", error);
      return NextResponse.json(
        { error: "Failed to convert DOCX to PDF." },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in convert-to-pdf API:", error);
    return NextResponse.json(
      { error: "Failed to process request." },
      { status: 500 }
    );
  }
} 