import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractTextFromPdf } from "@/lib/metadata/extract";
import { getOriginalPdfBytes } from "@/lib/storage";
import { getCVByFileName } from "@/lib/db/queries.server";
import OpenAI from "openai";
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { generateEnhancedCVDocx } from "@/lib/enhancedDocxGenerator";
import { saveFile, FileType, StorageType } from "@/lib/fileStorage";
import { processCVWithAI } from "@/lib/utils/cvProcessor";
import { logger } from "@/lib/logger";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Define metadata type for type checking
interface CVMetadata {
  processing?: boolean;
  processingStartTime?: string;
  processingStatus?: string;
  processingProgress?: number;
  processingCompleted?: boolean;
  optimized?: boolean;
  lastUpdated?: string;
  atsScore?: number;
  improvedAtsScore?: number;
  improvements?: string[];
  optimizedText?: string;
  [key: string]: any; // Allow additional properties
}

// Load and cache the system reference file
let systemReferenceContent: string | null = null;

async function getSystemReferenceContent(): Promise<string> {
  if (systemReferenceContent) {
    return systemReferenceContent;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'system-reference.md');
    systemReferenceContent = await fsPromises.readFile(filePath, 'utf-8');
    return systemReferenceContent;
  } catch (error) {
    console.error('Error loading system reference file:', error);
    return 'Error loading system reference file.';
  }
}

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to process a CV." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      logger.error("Failed to parse request body", 
        parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json(
        { success: false, error: "Invalid request format. Please provide valid JSON." },
        { status: 400 }
      );
    }
    
    const { cvId, forceRefresh } = requestData;
    
    // Validate cvId
    if (!cvId) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID." },
        { status: 400 }
      );
    }
    
    // Use a timeout for database operations
    let cvRecord;
    try {
      // Set up a timeout for the database query
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database query timed out")), 5000);
      });
      
      // Query the database
      const dbQueryPromise = db.query.cvs.findFirst({
        where: eq(cvs.id, cvId),
      });
      
      // Race the query against the timeout
      cvRecord = await Promise.race([dbQueryPromise, timeoutPromise]);
    } catch (dbError) {
      logger.error(`Database error fetching CV ${cvId}:`, 
        dbError instanceof Error ? dbError.message : String(dbError));
      return NextResponse.json(
        { success: false, error: "Error accessing CV data. Please try again." },
        { status: 500 }
      );
    }
    
    if (!cvRecord) {
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      logger.warn(`User ${userId} attempted to access CV ${cvId} belonging to user ${cvRecord.userId}`);
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Parse existing metadata with error handling
    let metadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (parseError) {
      logger.error(`Error parsing metadata for CV ID ${cvId}:`, 
        parseError instanceof Error ? parseError.message : String(parseError));
      metadata = {}; // Reset to empty object in case of parsing error
    }
    
    // Check if CV is already being processed and not forcing refresh
    const isProcessing = metadata && (metadata as any).processing;
    const lastUpdateTime = new Date((metadata as any).lastUpdated || 0);
    const currentTime = new Date();
    const minutesSinceLastUpdate = (currentTime.getTime() - lastUpdateTime.getTime()) / (1000 * 60);
    
    // If processing for over 10 minutes, assume it's stalled
    const isStalled = isProcessing && minutesSinceLastUpdate > 10;
    
    // Return status if already processing and not stalled or forced
    if (isProcessing && !isStalled && !forceRefresh) {
      return NextResponse.json({
        success: true,
        message: "CV is already being processed.",
        cvId,
        isProcessing: true,
        metadata
      });
    }
    
    // Check if processing is already completed and not forcing refresh
    const isCompleted = metadata && (metadata as any).processingCompleted;
    
    if (isCompleted && !forceRefresh) {
      return NextResponse.json({
        success: true,
        message: "CV processing has already been completed.",
        cvId,
        isProcessing: false,
        isCompleted: true,
        metadata
      });
    }
    
    // Check if we have raw text content
    if (!cvRecord.rawText) {
      // Try to extract text if we don't have it
      try {
        const pdfBytes = await getOriginalPdfBytes(cvRecord);
        // Convert pdfBytes to the correct format for extractTextFromPdf
        // We need to specify the path for a temporary file or convert the bytes to a string
        const filePath = path.join(process.cwd(), 'tmp', `${cvId}_${Date.now()}.pdf`);
        
        // Create the tmp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        try {
          await fsPromises.mkdir(tmpDir, { recursive: true });
        } catch (mkdirError) {
          logger.warn(`Failed to create tmp directory: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
        }
        
        // Write the PDF bytes to a temporary file
        await fsPromises.writeFile(filePath, pdfBytes);
        
        // Now extract text from the file
        const extractedText = await extractTextFromPdf(filePath);
        
        // Clean up the temporary file
        try {
          await fsPromises.unlink(filePath);
        } catch (unlinkError) {
          logger.warn(`Failed to delete temporary file ${filePath}: ${unlinkError instanceof Error ? unlinkError.message : String(unlinkError)}`);
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: "Could not extract text from the CV. Please upload a valid PDF." },
            { status: 400 }
          );
        }
        
        // Update the CV with the extracted text
        await db.update(cvs)
          .set({ rawText: extractedText })
          .where(eq(cvs.id, cvId));
        
        cvRecord.rawText = extractedText;
      } catch (extractError) {
        logger.error(`Failed to extract text from CV ${cvId}:`, 
          extractError instanceof Error ? extractError.message : String(extractError));
        return NextResponse.json(
          { success: false, error: "Could not read the CV content. Please upload a valid PDF." },
          { status: 400 }
        );
      }
    }
    
    // Update metadata to mark as processing
    const updatedMetadata = {
      ...metadata,
      processing: true,
      processingCompleted: false,
      processingProgress: 0,
      processingStatus: "Starting CV processing...",
      processingError: null,
      lastUpdated: new Date().toISOString()
    };
    
    // Update the CV record to mark as processing
    try {
      await db.update(cvs)
        .set({
          metadata: JSON.stringify(updatedMetadata)
        })
        .where(eq(cvs.id, cvId));
    } catch (updateError) {
      logger.error(`Failed to update CV ${cvId} metadata:`, 
        updateError instanceof Error ? updateError.message : String(updateError));
      return NextResponse.json(
        { success: false, error: "Failed to start processing. Please try again." },
        { status: 500 }
      );
    }
    
    // Process CV asynchronously in the background
    // This allows the API to return immediately while processing continues
    // We don't use await here intentionally
    processCVWithAI(cvId, cvRecord.rawText, updatedMetadata, forceRefresh, userId)
      .catch((error) => {
        logger.error(`Unhandled error in background processing for CV ID ${cvId}:`, 
          error instanceof Error ? error.message : String(error));
      });
    
    // Return success response immediately
    return NextResponse.json({
      success: true,
      message: forceRefresh ? "CV processing restarted." : "CV processing started.",
      cvId,
      isProcessing: true,
      forceRefresh: !!forceRefresh,
      estimatedTime: "30-60 seconds",
      metadata: updatedMetadata
    });
    
  } catch (error) {
    logger.error("Unexpected error in CV process API:", 
      error instanceof Error ? error.message : String(error));
    
    // Return a user-friendly error
    return NextResponse.json(
      { 
        success: false, 
        error: "An unexpected error occurred. Please try again later.",
        requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
      },
      { status: 500 }
    );
  }
}