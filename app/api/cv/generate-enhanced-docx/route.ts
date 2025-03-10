import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEnhancedCVDocx } from "@/lib/enhancedDocxGenerator";
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
        { error: "You must be logged in to generate DOCX files." },
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
    
    // Check if optimized text exists
    if (!metadata.optimizedText) {
      return NextResponse.json(
        { error: "CV has not been optimized yet." },
        { status: 400 }
      );
    }
    
    // Generate enhanced DOCX file
    const outputDir = path.join(process.cwd(), "tmp");
    const fileName = `optimized-cv-${cvId}-${Date.now()}.docx`;
    
    try {
      // Generate the DOCX file
      const { filePath, base64 } = await generateEnhancedCVDocx(
        metadata.optimizedText,
        outputDir,
        fileName
      );
      
      // Save the file to storage (optionally)
      let storageFilePath = filePath;
      let fileMetadata;
      try {
        fileMetadata = await saveFile(
          Buffer.from(base64, "base64"),
          fileName,
          'docx' as FileType,
          'local' as StorageType
        );
        storageFilePath = fileMetadata.filePath;
      } catch (storageError) {
        console.error("Error saving file to storage:", storageError);
        // Continue anyway, we still have the local file
      }
      
      // Update metadata with DOCX file information
      metadata = {
        ...metadata,
        optimizedDocxFilePath: storageFilePath,
        optimizedDocxFileName: fileName,
        lastGeneratedAt: new Date().toISOString(),
      };
      
      // Update CV record with new metadata
      await db
        .update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, cvRecord.id));
      
      // Return success with file data
      return NextResponse.json({
        message: "DOCX file generated successfully.",
        fileName: fileName,
        docxBase64: base64,
      });
      
    } catch (error) {
      console.error("Error generating DOCX file:", error);
      return NextResponse.json(
        { error: "Failed to generate DOCX file." },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in generate-enhanced-docx API:", error);
    return NextResponse.json(
      { error: "Failed to process request." },
      { status: 500 }
    );
  }
} 