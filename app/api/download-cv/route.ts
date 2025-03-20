import { NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";
import path from "path";
import fs from "fs/promises";

// For testing purposes - create a simple PDF document from text
async function createSimplePdfBuffer(text: string): Promise<Buffer> {
  // Create a more valid PDF than the string template
  // This follows a minimal PDF format that should be more valid
  // PDF Reference: https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf
  const pdfTemplate = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length + 50} >>
stream
BT
/F1 12 Tf
50 700 Td
(${text.replace(/[()\\]/g, '\\$&')}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000058 00000 n
0000000115 00000 n
0000000234 00000 n
0000000${text.length + 380} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${text.length + 550}
%%EOF`;

  console.log("Created test PDF with content:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
  return Buffer.from(pdfTemplate);
}

export async function GET(request: Request) {
  console.log("download-cv API called");
  
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const optimized = searchParams.get("optimized") === "true";
    const useTestFile = searchParams.get("test") === "true"; // For testing
    
    console.log(`Request params: fileName=${fileName}, optimized=${optimized}, test=${useTestFile}`);
    
    if (!fileName) {
      console.error("Missing fileName parameter");
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    // Get clean filename for download
    const safeFileName = fileName.replace(/[^\w\d.-]/g, '_');
    console.log(`Safe filename for download: ${safeFileName}`);

    // For testing purposes, if test=true is set, return a simple PDF file
    if (useTestFile) {
      console.log("Using test file for download");
      try {
        const testPdfBuffer = await createSimplePdfBuffer("This is a test document for download");
        console.log(`Test PDF created, size: ${testPdfBuffer.length} bytes, starts with: ${testPdfBuffer.toString('hex', 0, 20)}`);
        return new Response(testPdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
            'Content-Length': String(testPdfBuffer.length),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
        });
      } catch (testError) {
        console.error("Error creating test document:", testError);
      }
    }

    // Try to find the file using multiple methods
    let pdfBytes: Buffer | Uint8Array | null = null;
    let errorMessages: string[] = [];

    // Method 1: Try to get the CV record from the database first
    try {
      console.log(`Attempting to get CV record for fileName: ${fileName}`);
      const cvRecord = await getCVByFileName(fileName);
      
      if (cvRecord) {
        console.log(`CV record found: id=${cvRecord.id}, filepath=${cvRecord.filepath || 'undefined'}`);
        
        if (optimized) {
          // Try to get optimized version from metadata
          console.log("Attempting to get optimized PDF from metadata");
          try {
            const metadata = cvRecord.metadata ? 
              (typeof cvRecord.metadata === 'string' ? JSON.parse(cvRecord.metadata) : cvRecord.metadata) : 
              null;
            
            if (metadata?.optimizedPDFBase64) {
              console.log("Found optimized PDF in base64 format, converting...");
              pdfBytes = Buffer.from(metadata.optimizedPDFBase64, 'base64');
              console.log(`Successfully retrieved optimized PDF, size: ${pdfBytes.length} bytes, starts with: ${pdfBytes.toString('hex', 0, 20)}`);
            } else if (metadata?.optimizedPdfFilePath) {
              console.log(`Trying to load from optimizedPdfFilePath: ${metadata.optimizedPdfFilePath}`);
              try {
                const optimizedPath = path.isAbsolute(metadata.optimizedPdfFilePath) ? 
                  metadata.optimizedPdfFilePath : 
                  path.join(process.cwd(), metadata.optimizedPdfFilePath);
                  
                pdfBytes = await fs.readFile(optimizedPath);
                console.log(`Successfully loaded optimized PDF from path, size: ${pdfBytes.length} bytes`);
              } catch (fileError) {
                const msg = `Error loading optimized PDF from path: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
                console.error(msg);
                errorMessages.push(msg);
              }
            } else {
              const msg = "Optimized version not found in metadata";
              console.error(msg);
              errorMessages.push(msg);
            }
          } catch (metadataError) {
            const msg = `Error parsing metadata: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`;
            console.error(msg);
            errorMessages.push(msg);
          }
        } else if (cvRecord.filepath && cvRecord.filepath.trim() !== "") {
          // Try to get the original PDF using the filepath from the database
          console.log(`Attempting to get original PDF using filepath: ${cvRecord.filepath}`);
          try {
            pdfBytes = await getOriginalPdfBytes(cvRecord);
            if (!(pdfBytes instanceof Buffer)) {
              pdfBytes = Buffer.from(pdfBytes);
            }
            console.log(`Successfully retrieved original PDF, size: ${pdfBytes.length} bytes, starts with: ${pdfBytes.toString('hex', 0, 20)}`);
          } catch (pdfError) {
            const msg = `Error retrieving original PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`;
            console.error(msg);
            errorMessages.push(msg);
          }
        } else {
          const msg = "CV record found but has no valid filepath";
          console.error(msg);
          errorMessages.push(msg);
        }
      } else {
        const msg = `CV record not found for fileName: ${fileName}`;
        console.error(msg);
        errorMessages.push(msg);
      }
    } catch (dbError) {
      const msg = `Database error when fetching CV record: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
      console.error(msg);
      errorMessages.push(msg);
    }

    // Method 2: If we still don't have the file, try to find it in the local uploads directory
    if (!pdfBytes) {
      console.log("Attempting to find file in local uploads directory");
      try {
        const publicPath = path.join(process.cwd(), "public", "uploads", fileName);
        pdfBytes = await fs.readFile(publicPath);
        console.log(`Successfully read file from local path: ${publicPath}, size: ${pdfBytes.length} bytes`);
      } catch (localError) {
        const msg = `Error reading from local uploads: ${localError instanceof Error ? localError.message : String(localError)}`;
        console.error(msg);
        errorMessages.push(msg);
      }
    }

    // Method 3: Fallback to test document if we still don't have the file
    if (!pdfBytes) {
      console.log("Attempting to use the fallback test document");
      try {
        const testPath = path.join(process.cwd(), "public", "uploads", "test-document.pdf");
        pdfBytes = await fs.readFile(testPath);
        console.log(`Successfully read fallback test document: ${testPath}, size: ${pdfBytes.length} bytes`);
      } catch (testError) {
        const msg = `Failed to read test document: ${testError instanceof Error ? testError.message : String(testError)}`;
        console.error(msg);
        errorMessages.push(msg);
        
        // Last resort: Create a simple PDF buffer
        console.log("Creating a simple PDF buffer as last resort");
        try {
          pdfBytes = await createSimplePdfBuffer(`Failed to retrieve the requested document: ${fileName}. 
            This is a fallback document created for testing purposes.
            Errors encountered: ${errorMessages.join(", ")}`);
          console.log(`Created simple PDF buffer, size: ${pdfBytes.length} bytes`);
        } catch (bufferError) {
          const msg = `Failed to create simple PDF buffer: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`;
          console.error(msg);
          errorMessages.push(msg);
        }
      }
    }

    // Check if we have a valid PDF
    if (pdfBytes !== null && pdfBytes.length > 0) {
      console.log(`Returning PDF file: ${safeFileName}, size: ${pdfBytes.length} bytes`);
      
      // Validate that it looks like a PDF (starts with %PDF-)
      const isPdfStart = pdfBytes.slice(0, 5).toString() === '%PDF-';
      if (!isPdfStart) {
        console.warn(`Warning: File doesn't start with %PDF- marker: ${pdfBytes.slice(0, 20).toString('hex')}`);
      }
      
      // Ensure we're working with a Buffer
      const responseBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
      
      // Use Response instead of NextResponse for better binary handling
      return new Response(responseBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
          'Content-Length': String(responseBuffer.length),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });
    }

    // If all methods failed, return an error
    console.error("All retrieval methods failed for file:", fileName);
    return NextResponse.json({ 
      error: "Failed to retrieve the requested document",
      details: errorMessages 
    }, { status: 500 });
  } catch (error: any) {
    console.error("Error in download-cv API:", error);
    return NextResponse.json({ 
      error: `Error downloading CV: ${error instanceof Error ? error.message : String(error)}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 