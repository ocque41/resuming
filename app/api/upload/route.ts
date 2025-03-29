export const dynamic = "force-dynamic"; // Prevent pre-rendering at build time

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import fs from "fs/promises";
import path from "path";
import { extractTextFromPdf } from "@/lib/metadata/extract";
import { saveFile } from "@/lib/fileStorage";
import { processCVWithAI } from "@/lib/utils/cvProcessor";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get content type
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
    }
    
    // Get FormData from request
    const formData = await request.formData();
    const file = formData.get("file");
    
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
    
    // Get file info
    const fileName = file.name;
    const fileType = file.type;
    const fileExt = path.extname(fileName).toLowerCase();
    
    // Create temp file
    const tempDir = path.join(os.tmpdir(), 'cv-optimizer');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    const tempFilePath = path.join(tempDir, `${uuidv4()}${fileExt}`);
    
    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer);
    
    logger.info(`File saved temporarily at: ${tempFilePath}`);
    
    // Determine storage file type
    const storageFileType = fileExt === '.pdf' ? 'pdf' : 
                            fileExt === '.docx' ? 'docx' : 'txt';
    
    try {
      // Upload to S3
      const fileMetadata = await saveFile(
        buffer,
        fileName,
        storageFileType,
        's3' // Use S3 storage
      );
      
      logger.info(`File saved to S3: ${fileMetadata.filePath}`);
      
      // Extract text from PDF if applicable
      let rawText = "";
      try {
        if (fileExt === '.pdf' || fileType.includes('pdf')) {
          rawText = await extractTextFromPdf(tempFilePath);
          logger.info(`Extracted raw text (first 200 chars): ${rawText.slice(0, 200)}`);
        }
      } catch (err) {
        logger.error(`Error extracting text: ${err}`);
      }
      
      // Initial metadata
      const initialMetadata = {
        fileType: fileType,
        fileExt: fileExt,
        originalName: fileName,
        atsScore: "N/A", 
        optimized: "No", 
        sent: "No",
        processing: false,
        processingStatus: "Uploaded",
        processingProgress: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to database
      const [createdCv] = await db
        .insert(cvs)
        .values({
          userId: userId,
          fileName: fileName,
          filepath: fileMetadata.filePath,
          rawText: rawText,
          metadata: JSON.stringify(initialMetadata),
        })
        .returning();
      
      // Process CV with AI in background
      if (createdCv && rawText) {
        processCVWithAI(
          createdCv.id,
          rawText,
          initialMetadata,
          false,
          userId
        ).catch(error => {
          logger.error(`Error processing CV: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      
      // Clean up temp file
      await fs.unlink(tempFilePath).catch(err => {
        logger.warn(`Failed to delete temp file: ${err}`);
      });
      
      return NextResponse.json({
        success: true,
        id: createdCv.id,
        message: "CV uploaded successfully",
        fileName: fileName,
        fileUrl: fileMetadata.url
      });
      
    } catch (storageError) {
      // Try to clean up temp file
      await fs.unlink(tempFilePath).catch(() => {});
      
      logger.error(`Storage error: ${storageError}`);
      return NextResponse.json(
        { error: `Storage failed: ${storageError instanceof Error ? storageError.message : String(storageError)}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    logger.error(`Upload error: ${error}`);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
