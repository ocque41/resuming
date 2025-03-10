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
    const requestData = await request.json();
    const { cvId, forceRefresh } = requestData;
    
    if (!cvId) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID." },
        { status: 400 }
      );
    }
    
    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Parse existing metadata
    let metadata = {};
    if (cvRecord.metadata) {
      try {
        metadata = JSON.parse(cvRecord.metadata);
      } catch (error) {
        logger.error(`Error parsing metadata for CV ID ${cvId}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Check if CV is already being processed and not forcing refresh
    const isProcessing = metadata && (metadata as any).processing;
    
    if (isProcessing && !forceRefresh) {
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
      return NextResponse.json(
        { success: false, error: "CV text content not available." },
        { status: 400 }
      );
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
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, cvId));
    
    // Process CV asynchronously to avoid blocking the API response
    processCVWithAI(cvId, cvRecord.rawText, updatedMetadata, forceRefresh)
      .catch((error) => {
        logger.error(`Error processing CV ID ${cvId}:`, error instanceof Error ? error.message : String(error));
      });
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: forceRefresh ? "CV processing restarted." : "CV processing started.",
      cvId,
      isProcessing: true,
      forceRefresh: !!forceRefresh,
      metadata: updatedMetadata
    });
    
  } catch (error) {
    logger.error("Error in CV process API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to process CV." },
      { status: 500 }
    );
  }
}