import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  optimizedText?: string;
  optimizedPDFBase64?: string;
  selectedTemplate?: string;
  progress?: number;
  startTime?: string;
  [key: string]: any; // Allow for additional properties
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  try {
    const cvRecord = await getCVByFileName(fileName);
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      return NextResponse.json({ error: "Invalid metadata format" }, { status: 500 });
    }

    // Check if the CV has been optimized
    if (!metadata.optimized) {
      return NextResponse.json({ 
        error: "This CV has not been optimized yet" 
      }, { status: 400 });
    }

    // Get the optimized PDF from metadata
    const optimizedPDFBase64 = metadata.optimizedPDFBase64;
    
    if (!optimizedPDFBase64) {
      return NextResponse.json({ 
        error: "Optimized PDF not found in metadata" 
      }, { status: 404 });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(optimizedPDFBase64, 'base64');
    
    // Create a new filename for the optimized version
    const fileNameParts = fileName.split('.');
    const extension = fileNameParts.pop();
    const baseName = fileNameParts.join('.');
    const optimizedFileName = `${baseName}-optimized.pdf`;

    // Return the PDF file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${optimizedFileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to download optimized CV: ${error.message}` 
    }, { status: 500 });
  }
} 