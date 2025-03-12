import { NextRequest, NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx/docxGenerator';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEnhancedCVDocx } from "@/lib/enhancedDocxGenerator";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId, optimizedText } = body;
    
    // Validate request
    if (!cvId) {
      return NextResponse.json({ error: "CV ID is required" }, { status: 400 });
    }
    
    if (!optimizedText || typeof optimizedText !== 'string') {
      return NextResponse.json({ error: "Optimized text is required" }, { status: 400 });
    }
    
    // Get CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId),
    });
    
    // Validate CV record
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    if (cvRecord.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized to access this CV" }, { status: 403 });
    }
    
    // Generate DOCX file
    const docxResult = await generateEnhancedCVDocx(optimizedText);
    
    // Return success response with DOCX file
    return NextResponse.json({
      success: true,
      message: "DOCX file generated successfully",
      docxBase64: docxResult.base64
    });
  } catch (error) {
    logger.error("Error generating DOCX file:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    // Get all CVs for the user
    const cvs = await getCVsForUser(user.id);
    
    // Find the specific CV by ID
    const cvRecord = cvs.find(cv => cv.id === parseInt(cvId));

    if (!cvRecord) {
      return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
    }

    // Use rawText since optimizedText doesn't exist in the schema
    if (!cvRecord.rawText) {
      return NextResponse.json(
        { success: false, error: 'No text available for this CV' },
        { status: 400 }
      );
    }

    // Generate the DOCX file
    const docxBuffer = await generateDocx(cvRecord.rawText);

    // Create a filename for the download
    const filename = cvRecord.fileName 
      ? `${cvRecord.fileName.replace(/\.[^/.]+$/, '')}-optimized.docx` 
      : 'optimized-cv.docx';

    // Return the DOCX file as a downloadable attachment
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 