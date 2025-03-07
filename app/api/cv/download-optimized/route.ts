import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  hasOptimizedVersion?: boolean;
  optimizedVersionId?: string;
  optimizedPDFBase64?: string;
  optimizedPdfUrl?: string;
  optimizedText?: string;
  selectedTemplate?: string;
  progress?: number;
  startTime?: string;
  completedAt?: string;
  [key: string]: any; // Allow for additional properties
}

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      console.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      console.error("Missing cvId parameter");
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    console.log(`Processing download request for CV ID: ${cvId}`);

    // Fetch the CV record from the database
    let cvRecord;
    try {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId)),
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        error: "Database error while fetching CV" 
      }, { status: 500 });
    }
    
    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

    // Parse the metadata
    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (parseError) {
      console.error("Error parsing metadata:", parseError);
      return NextResponse.json({ error: "Invalid metadata format" }, { status: 500 });
    }

    // Check if the CV has been optimized
    if (!metadata.optimized && !metadata.hasOptimizedVersion) {
      console.error(`CV ${cvId} has not been optimized yet`);
      return NextResponse.json({ 
        error: "This CV has not been optimized yet" 
      }, { status: 400 });
    }

    // Check if optimized text is available
    if (!metadata.optimizedText) {
      console.error(`No optimized text found for CV ${cvId}`);
      return NextResponse.json({ 
        error: "No optimized content available for download" 
      }, { status: 404 });
    }

    // Create a text file from the optimized content
    const textContent = metadata.optimizedText;
    
    // Create a new filename for the optimized version
    const fileName = cvRecord.fileName;
    const fileNameParts = fileName.split('.');
    fileNameParts.pop(); // Remove extension
    const baseName = fileNameParts.join('.');
    const optimizedFileName = `${baseName}-optimized.txt`;

    console.log(`Returning optimized content for CV ${cvId} as ${optimizedFileName}`);

    // Return the text file
    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${optimizedFileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error downloading optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to download optimized CV: ${errorMessage}` 
    }, { status: 500 });
  }
} 