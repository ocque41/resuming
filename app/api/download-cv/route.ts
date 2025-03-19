import { NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";

export async function GET(request: Request) {
  console.log("download-cv API called");
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  const optimized = searchParams.get("optimized") === "true";
  
  console.log(`Request params: fileName=${fileName}, optimized=${optimized}`);
  
  if (!fileName) {
    console.error("Missing fileName parameter");
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  try {
    console.log(`Attempting to get CV record for fileName: ${fileName}`);
    const cvRecord = await getCVByFileName(fileName);
    
    if (!cvRecord) {
      console.error(`CV record not found for fileName: ${fileName}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    console.log(`CV record found: id=${cvRecord.id}, filepath=${cvRecord.filepath}`);

    let pdfBytes;
    
    if (optimized) {
      // Get the optimized version if it exists
      console.log("Attempting to get optimized PDF");
      const metadata = cvRecord.metadata ? 
        (typeof cvRecord.metadata === 'string' ? JSON.parse(cvRecord.metadata) : cvRecord.metadata) : 
        null;
      
      if (!metadata?.optimizedPDFBase64) {
        console.error("Optimized version not found in metadata");
        return NextResponse.json({ error: "Optimized version not found" }, { status: 404 });
      }
      
      console.log("Converting optimized PDF from base64");
      // Convert base64 to bytes
      pdfBytes = Buffer.from(metadata.optimizedPDFBase64, 'base64');
    } else {
      // Get the original PDF
      console.log(`Fetching original PDF using: ${JSON.stringify({
        id: cvRecord.id,
        filepath: cvRecord.filepath,
        fileName: cvRecord.fileName
      })}`);
      
      try {
        pdfBytes = await getOriginalPdfBytes(cvRecord);
        console.log(`Successfully retrieved PDF, size: ${pdfBytes.length} bytes`);
      } catch (pdfError) {
        console.error("Error retrieving original PDF:", pdfError);
        return NextResponse.json({ 
          error: `Failed to retrieve original PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}` 
        }, { status: 500 });
      }
    }

    // Return the PDF file
    console.log(`Returning PDF file: ${fileName}`);
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error in download-cv API:", error);
    return NextResponse.json({ 
      error: `Error downloading CV: ${error instanceof Error ? error.message : String(error)}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 