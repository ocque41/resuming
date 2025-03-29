export const dynamic = "force-dynamic"; // Prevent pre-rendering at build time

import { NextResponse } from "next/server";
import formidable from "formidable";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { Readable } from "stream";
import { IncomingMessage } from "http";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { extractTextFromPdf } from "@/lib/metadata/extract";
import { saveFile, FileMetadata } from "@/lib/fileStorage"; // Use the storage abstraction
import { processCVWithAI } from "@/lib/utils/cvProcessor";
import { logger } from "@/lib/logger";

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Helper function to sanitize file names
function sanitizeFileName(fileName: string): string {
  // Remove invalid characters
  let sanitized = fileName.replace(/[<>:"/\\|?*]/g, '_');
  
  // Ensure the file name is not too long
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  return sanitized;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to handle form data
async function parseFormData(req: Request): Promise<{ fields: formidable.Fields, files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const bufs: Buffer[] = [];
    let size = 0;
    
    const stream = new Readable({
      read() {}
    });
    
    req.body?.getReader().read().then(function process({ done, value }): Promise<void> | void {
      if (done) {
        stream.push(null);
        return;
      }
      
      size += value.length;
      if (size > MAX_FILE_SIZE) {
        reject(new Error("File size too large"));
        return;
      }
      
      bufs.push(Buffer.from(value));
      stream.push(Buffer.from(value));
      
      return req.body?.getReader().read().then(process);
    });
    
    // Use the formidable to parse the request
    const form = formidable({ multiples: true });
    
    form.parse(stream as unknown as IncomingMessage, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

export async function POST(request: Request) {
  // Retrieve the session.
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  
  try {
    const userId = session.user.id;
    
    // Parse the form data
    const { files } = await parseFormData(request);
    const uploadedFile = files.file?.[0];
    
    if (!uploadedFile) {
      return NextResponse.json(
        { message: "No file was uploaded." },
        { status: 400 }
      );
    }

    const fileName = uploadedFile.originalFilename || "UnnamedDocument";
    const localFilePath = uploadedFile.filepath;
    logger.info(`File saved at: ${localFilePath}, original name: ${fileName}`);
    
    // Get file type/extension
    const fileExt = path.extname(fileName).toLowerCase();
    const fileType = uploadedFile.mimetype || 'application/octet-stream';
    
    // Read the file buffer
    const fileBuffer = await fs.readFile(localFilePath);
    
    // Use S3 storage for the file (provide "s3" as storageType)
    try {
      // Determine the appropriate file type for our system
      const storageFileType = fileExt === '.pdf' ? 'pdf' : 
                              fileExt === '.docx' ? 'docx' : 'txt';
      
      const fileMetadata = await saveFile(
        fileBuffer, 
        fileName, 
        storageFileType,
        's3' // Use S3 storage
      );
      
      logger.info(`File saved to S3: ${fileMetadata.filePath}`);
      
      // Extract raw text from the file if it's a PDF
      let rawText = "";
      try {
        if (fileExt === '.pdf' || fileType.includes('pdf')) {
          rawText = await extractTextFromPdf(localFilePath);
          logger.info(`Extracted raw text (first 200 chars): ${rawText.slice(0, 200)}`);
        } else {
          logger.info(`Skipping text extraction for non-PDF file: ${fileName}`);
        }
      } catch (err) {
        logger.error(`Error extracting text: ${err}`);
      }
      
      // Create initial metadata
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
      
      // Save to database - note the field is 'filepath' not 'filePath'
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
      
      // Process CV with AI in the background (don't await)
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
      
      // Clean up the temporary file
      try {
        await fs.unlink(localFilePath);
      } catch (unlinkError) {
        logger.warn(`Error removing temporary file: ${unlinkError}`);
      }
      
      return NextResponse.json({ 
        success: true,
        id: createdCv.id,
        message: "CV uploaded successfully",
        fileName: fileName,
        fileUrl: fileMetadata.url, // Use the URL from fileMetadata
      });
      
    } catch (storageError) {
      logger.error(`S3 storage error: ${storageError}`);
      return NextResponse.json({ error: "File storage failed" }, { status: 500 });
    }
    
  } catch (error) {
    logger.error(`Upload error: ${error}`);
    return NextResponse.json(
      { message: `Upload failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
