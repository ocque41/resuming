import { NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  const optimized = searchParams.get("optimized") === "true";
  
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  try {
    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    let pdfBytes;
    
    if (optimized) {
      // Get the optimized version if it exists
      const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
      
      if (!metadata?.optimizedPDFBase64) {
        return NextResponse.json({ error: "Optimized version not found" }, { status: 404 });
      }
      
      // Convert base64 to bytes
      pdfBytes = Buffer.from(metadata.optimizedPDFBase64, 'base64');
    } else {
      // Get the original PDF
      pdfBytes = await getOriginalPdfBytes(cvRecord);
    }

    // Return the PDF file
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading CV:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 