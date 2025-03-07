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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    // Fetch the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

    // Parse the metadata
    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      return NextResponse.json({ error: "Invalid metadata format" }, { status: 500 });
    }

    // Check if the CV has been optimized
    if (!metadata.optimized && !metadata.hasOptimizedVersion) {
      return NextResponse.json({ 
        error: "This CV has not been optimized yet" 
      }, { status: 400 });
    }

    // Prioritize optimized text over PDF for reliability
    if (metadata.optimizedText) {
      // Create a text file from the optimized content
      const textContent = metadata.optimizedText;
      
      // Create a new filename for the optimized version
      const fileName = cvRecord.fileName;
      const fileNameParts = fileName.split('.');
      fileNameParts.pop(); // Remove extension
      const baseName = fileNameParts.join('.');
      const optimizedFileName = `${baseName}-optimized.txt`;

      // Return the text file
      return new NextResponse(textContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${optimizedFileName}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    // If no optimized text is available, return an error
    return NextResponse.json({ 
      error: "No optimized content available for download" 
    }, { status: 404 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error downloading optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to download optimized CV: ${errorMessage}` 
    }, { status: 500 });
  }
} 