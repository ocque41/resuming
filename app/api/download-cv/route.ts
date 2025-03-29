import { NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";
import { retrieveFile } from "@/lib/fileStorage";
import { logger } from "@/lib/logger";

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

    // Parse metadata once to reuse
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    const storageType = metadata?.storageType || (cvRecord.filepath?.startsWith('/') ? 'dropbox' : 's3');
    
    let pdfBytes;
    
    if (optimized) {
      // Get the optimized version if it exists
      if (!metadata?.optimizedPDFBase64) {
        return NextResponse.json({ error: "Optimized version not found" }, { status: 404 });
      }
      
      // Convert base64 to bytes
      pdfBytes = Buffer.from(metadata.optimizedPDFBase64, 'base64');
    } else {
      try {
        // Try using the fileStorage abstraction first if we have a storageType
        if (storageType && cvRecord.filepath) {
          logger.info(`Retrieving file using fileStorage from ${storageType}: ${cvRecord.filepath}`);
          pdfBytes = await retrieveFile(cvRecord.filepath, storageType as any);
        } else {
          // Fall back to the legacy method
          logger.info(`Retrieving file using legacy method from: ${cvRecord.filepath}`);
          pdfBytes = await getOriginalPdfBytes(cvRecord);
        }
      } catch (error) {
        logger.error(`Error retrieving file: ${error}`);
        // If direct retrieval fails, try the legacy method as fallback
        pdfBytes = await getOriginalPdfBytes(cvRecord);
      }
    }

    // Return the PDF file
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    logger.error(`Error downloading CV: ${error}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 