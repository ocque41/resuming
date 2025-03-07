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

    // Get the optimized PDF from metadata
    const optimizedPDFBase64 = metadata.optimizedPDFBase64;
    
    if (!optimizedPDFBase64) {
      console.error(`Optimized PDF not found in metadata for CV ID ${cvId}`);
      
      // Check if we have optimized text but no PDF
      if (metadata.optimizedText) {
        console.log(`Found optimized text but no PDF for CV ID ${cvId}`);
        
        // Return the optimized text as a fallback
        return NextResponse.json({ 
          error: "Optimized PDF not found, but optimized text is available",
          optimizedText: metadata.optimizedText
        }, { status: 206 }); // 206 Partial Content
      }
      
      return NextResponse.json({ 
        error: "Optimized PDF not found in metadata" 
      }, { status: 404 });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(optimizedPDFBase64, 'base64');
    
    // Create a new filename for the optimized version
    const fileName = cvRecord.fileName;
    const fileNameParts = fileName.split('.');
    const extension = fileNameParts.pop();
    const baseName = fileNameParts.join('.');
    const optimizedFileName = `${baseName}-optimized.pdf`;

    // Return the PDF file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
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