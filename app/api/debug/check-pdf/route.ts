import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";

/**
 * Debug API route to check PDF integrity
 * This will examine a PDF file and return information about its structure
 * to help diagnose corruption issues
 */
export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated (only in non-dev environments)
    if (!session?.user?.id && process.env.NODE_ENV !== 'development') {
      console.error("Unauthorized access attempt to debug API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the file name from the query parameters
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    console.log(`Debug check-pdf API called for file: ${fileName}`);
    
    // Get the CV record
    const cvRecord = await getCVByFileName(fileName);
    
    if (!cvRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    // Get the PDF bytes
    let pdfBytes;
    try {
      pdfBytes = await getOriginalPdfBytes(cvRecord);
    } catch (error) {
      return NextResponse.json({ 
        error: `Failed to get PDF bytes: ${error instanceof Error ? error.message : String(error)}` 
      }, { status: 500 });
    }
    
    // Check basic PDF structure
    const isPdf = pdfBytes.slice(0, 5).toString() === '%PDF-';
    const hasEof = pdfBytes.slice(-6).toString().includes('%%EOF');
    const version = isPdf ? pdfBytes.slice(5, 8).toString() : 'unknown';
    
    // Get the first 100 bytes as hex for examination
    const firstBytesHex = Buffer.from(pdfBytes.slice(0, 100)).toString('hex');
    const lastBytesHex = Buffer.from(pdfBytes.slice(-100)).toString('hex');
    
    // Count occurrences of key PDF elements
    const objCount = countOccurrences(pdfBytes, ' 0 obj');
    const streamCount = countOccurrences(pdfBytes, 'stream');
    const endstreamCount = countOccurrences(pdfBytes, 'endstream');
    const xrefPos = findPosition(pdfBytes, 'xref');
    const trailerPos = findPosition(pdfBytes, 'trailer');
    const startxrefPos = findPosition(pdfBytes, 'startxref');
    
    // Return PDF analysis
    return NextResponse.json({
      fileName,
      fileSize: pdfBytes.length,
      isPdf,
      version,
      hasEof,
      structureInfo: {
        objCount,
        streamCount,
        endstreamCount,
        hasXref: xrefPos > 0,
        hasTrailer: trailerPos > 0,
        hasStartxref: startxrefPos > 0,
        xrefPosition: xrefPos,
        trailerPosition: trailerPos,
        startxrefPosition: startxrefPos
      },
      hexDump: {
        firstBytes: firstBytesHex,
        lastBytes: lastBytesHex
      }
    });
  } catch (error) {
    console.error("Error in check-pdf debug API:", error);
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

/**
 * Count occurrences of a string pattern in a buffer
 */
function countOccurrences(buffer: Buffer, pattern: string): number {
  const patternBuffer = Buffer.from(pattern);
  let count = 0;
  let position = 0;
  
  while (position < buffer.length) {
    const index = buffer.indexOf(patternBuffer, position);
    if (index === -1) break;
    count++;
    position = index + patternBuffer.length;
  }
  
  return count;
}

/**
 * Find position of a string pattern in a buffer
 */
function findPosition(buffer: Buffer, pattern: string): number {
  const patternBuffer = Buffer.from(pattern);
  return buffer.indexOf(patternBuffer);
} 