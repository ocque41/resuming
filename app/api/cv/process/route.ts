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
        { error: "You must be logged in to process your CV." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { cvId, fileName } = body;
    
    if (!cvId && !fileName) {
      return NextResponse.json(
        { error: "Missing CV ID or file name." },
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
      return NextResponse.json({ error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { error: "You don't have permission to access this CV." },
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
            { error: "Failed to extract text from PDF." },
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
          { error: "Failed to extract text from PDF." },
          { status: 500 }
        );
      }
    }
    
    // Parse existing metadata or initialize new metadata
    let metadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }
    
    // Set processing status in metadata
    metadata = {
      ...metadata,
      processing: true,
      processingStartTime: new Date().toISOString(),
      processingStatus: "Initiating CV analysis with AI",
      processingProgress: 5,
    };
    
    // Update CV record with processing status
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvRecord.id));
    
    // Begin async processing (don't await here to avoid timeout)
    processCVWithAI(cvRecord.id, rawText, metadata);
    
    return NextResponse.json({
      message: "CV processing initiated successfully.",
      cvId: cvRecord.id,
      status: "processing",
    });
    
  } catch (error) {
    console.error("Error in CV processing API:", error);
    return NextResponse.json(
      { error: "Failed to process CV." },
      { status: 500 }
    );
  }
}