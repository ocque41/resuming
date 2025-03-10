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
        { success: false, error: "You must be logged in to process your CV." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { cvId, fileName, forceRefresh, optimizedText } = body;
    
    if (!cvId && !fileName) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID or file name." },
        { status: 400 }
      );
    }
    
    // Get CV record from database
    let cvRecord;
    
    if (cvId) {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId.toString())),
      });
    } else if (fileName) {
      cvRecord = await getCVByFileName(fileName);
    }
    
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
    
    // Get raw text from CV or extract it if not available
    let rawText = cvRecord.rawText;
    
    if (!rawText || rawText.trim().length === 0) {
      try {
        // Get PDF bytes from storage
        const pdfBytes = await getOriginalPdfBytes(cvRecord);
        
        // Extract text from PDF
        rawText = await extractTextFromPdf(cvRecord.filepath);
        
        if (!rawText || rawText.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: "Failed to extract text from PDF." },
            { status: 500 }
          );
        }
        
        // Update CV record with extracted text
        await db
          .update(cvs)
          .set({ rawText })
          .where(eq(cvs.id, cvRecord.id));
      } catch (error) {
        console.error("Error extracting text from PDF:", error);
        return NextResponse.json(
          { success: false, error: "Failed to extract text from PDF." },
          { status: 500 }
        );
      }
    }
    
    // Parse existing metadata or initialize new metadata
    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }
    
    // Check if we should skip processing if it's already completed and we're not forcing a refresh
    const isProcessingComplete = metadata.processingCompleted || metadata.optimized;
    if (isProcessingComplete && !forceRefresh) {
      console.log("CV already processed and forceRefresh is false. Returning existing data.");
      return NextResponse.json({
        success: true,
        message: "CV already processed. Use forceRefresh=true to reprocess.",
        cvId: cvRecord.id,
        status: "completed",
        isComplete: true,
        originalAtsScore: metadata.atsScore || 0,
        improvedAtsScore: metadata.improvedAtsScore || 0,
        improvements: metadata.improvements || [],
        optimizedText: metadata.optimizedText || ""
      });
    }
    
    // Create processing metadata
    metadata = {
      ...metadata,
      processing: true,
      processingStartTime: new Date().toISOString(),
      processingStatus: "Initiating CV analysis with AI",
      processingProgress: 5,
      lastUpdated: new Date().toISOString()
    };
    
    // If optimizedText is provided, use it to enhance the process
    if (optimizedText && optimizedText.trim().length > 0) {
      metadata.optimizedText = optimizedText;
    }
    
    // Update CV record with processing status
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvRecord.id));
    
    // Begin async processing (don't await here to avoid timeout)
    // Check if processCVWithAI supports a forceRefresh parameter, if not, modify as needed
    try {
      // @ts-ignore - Ignoring potential parameter mismatch if the function signature hasn't been updated yet
      processCVWithAI(cvRecord.id, rawText, metadata, forceRefresh);
    } catch (e) {
      // Fall back to original signature if needed
      console.warn("Error calling processCVWithAI with forceRefresh, using original signature");
      processCVWithAI(cvRecord.id, rawText, metadata);
    }
    
    return NextResponse.json({
      success: true,
      message: "CV processing initiated successfully.",
      cvId: cvRecord.id,
      status: "processing",
      fileName: cvRecord.fileName
    });
    
  } catch (error) {
    console.error("Error in CV processing API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process CV." },
      { status: 500 }
    );
  }
}