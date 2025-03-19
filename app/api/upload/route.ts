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
import { uploadFileToDropbox } from "@/lib/dropboxStorage"; // Dropbox upload function
import { processCVWithAI } from "@/lib/utils/cvProcessor"; // Import the CV processor
import { logger } from "@/lib/logger"; // Import the logger

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function POST(request: Request) {
  // Retrieve the session.
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json(
      { message: "You must be logged in to upload your document." },
      { status: 401 }
    );
  }

  // Determine the upload directory.
  const baseDir = process.env.NODE_ENV === "production" ? "/tmp" : process.cwd();
  const uploadDir = path.join(baseDir, "uploads");
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  // Read the request body as a Buffer and convert it to a stream.
  const buffer = Buffer.from(await request.arrayBuffer());
  
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "File size exceeds the 10MB limit." },
      { status: 400 }
    );
  }
  
  const stream = bufferToStream(buffer);

  // Create a fake IncomingMessage by attaching headers/method.
  const fakeReq = stream as unknown as IncomingMessage;
  (fakeReq as any).headers = Object.fromEntries(request.headers.entries());
  (fakeReq as any).method = request.method;

  // Parse the form using formidable.
  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
    // Accept all file types - no restriction
    filter: () => true,
  });
  const { fields, files } = await new Promise<any>((resolve, reject) => {
    form.parse(fakeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  }).catch((err) => {
    console.error("Formidable parse error:", err);
    return { fields: null, files: null };
  });
  if (!files) {
    return NextResponse.json(
      { message: "Error processing file upload." },
      { status: 500 }
    );
  }

  const fileOrFiles = files.file;
  const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
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
  
  // **Dropbox Upload with Detailed Logging**
  let dropboxUrl = localFilePath;
  logger.info(`Starting Dropbox upload for file: ${localFilePath}, with filename: ${fileName}`);
  try {
    dropboxUrl = await uploadFileToDropbox(localFilePath, fileName);
    logger.info(`Dropbox upload successful. Received URL: ${dropboxUrl}`);
  } catch (err) {
    logger.error(`Dropbox upload error: ${err}`);
    // Optionally, you may choose to return an error instead of falling back.
    return NextResponse.json({ error: "Dropbox upload failed" }, { status: 500 });
  }
  
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

  try {
    // Insert the new document record with rawText and default metadata.
    // IMPORTANT: Use 'filepath' (all lowercase) to match your database schema.
    const initialMetadata = {
      fileType: fileType,
      fileExt: fileExt,
      originalName: fileName,
      atsScore: "N/A", 
      optimized: "No", 
      sent: "No",
      processing: false,
      processingStatus: "Uploaded, waiting to start processing",
      processingProgress: 0,
      lastUpdated: new Date().toISOString()
    };
    
    const [newCV] = await db.insert(cvs).values({
      userId: session.user.id,
      fileName,
      filepath: dropboxUrl,
      rawText,
      metadata: JSON.stringify(initialMetadata),
    }).returning();
    
    logger.info(`Document record inserted successfully: ${JSON.stringify(newCV)}`);
    
    // Start CV processing immediately, but only if it's a CV/resume (PDF, DOC, DOCX)
    const cvId = newCV.id;
    const isCV = fileExt === '.pdf' || fileExt === '.doc' || fileExt === '.docx' || 
                fileType.includes('pdf') || fileType.includes('word');
                
    if (isCV && rawText && rawText.length > 0) {
      logger.info(`Starting immediate processing for CV ID: ${cvId}`);
      // Don't await this - let it run in the background
      processCVWithAI(cvId, rawText, initialMetadata, false, session.user.id)
        .catch(error => {
          logger.error(`Error starting CV processing for CV ID ${cvId}: ${
            error instanceof Error ? error.message : String(error)
          }`);
        });
    } else {
      logger.info(`Document ID ${cvId} is not a CV or has no text content, skipping processing`);
    }
    
    return NextResponse.json({ 
      message: "Document uploaded successfully!", 
      documentId: newCV.id,
      processingStarted: isCV && rawText && rawText.length > 0
    });
  } catch (dbError) {
    logger.error(`Database error: ${dbError}`);
    return NextResponse.json(
      { message: "Error saving document to database." },
      { status: 500 }
    );
  }
}
