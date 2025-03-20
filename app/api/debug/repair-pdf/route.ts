import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "@/lib/storage";
import { verifyPdfBuffer, attemptPdfRepair, createValidPdfBuffer } from "@/lib/pdfUtils";

/**
 * Debug API route to validate and repair PDF files
 * This will examine a PDF file, validate it, and attempt to repair if needed
 */
export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated (only in non-dev environments)
    if (!session?.user?.id && process.env.NODE_ENV !== 'development') {
      console.error("Unauthorized access attempt to repair-pdf API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the file name from the query parameters
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const repair = searchParams.get("repair") === "true";
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    console.log(`Debug repair-pdf API called for file: ${fileName}, repair=${repair}`);
    
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
    
    // Validate the PDF
    const validation = verifyPdfBuffer(pdfBytes);
    
    // If repair is requested and the PDF is invalid, attempt to repair it
    if (repair && !validation.isValid) {
      const repairedPdf = attemptPdfRepair(pdfBytes, fileName);
      
      if (repairedPdf) {
        // If repair succeeded, return the repaired PDF with validation results
        console.log(`PDF repaired successfully, new size: ${repairedPdf.length} bytes`);
        
        const repairValidation = verifyPdfBuffer(repairedPdf);
        
        if (searchParams.get("download") === "true") {
          // Return the repaired PDF as a download
          return new Response(repairedPdf, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="repaired-${fileName}"`,
              'Content-Length': String(repairedPdf.length),
            },
          });
        }
        
        return NextResponse.json({
          fileName,
          originalSize: pdfBytes.length,
          repairedSize: repairedPdf.length,
          originalValidation: validation,
          repairedValidation: repairValidation,
          repaired: true
        });
      } else {
        return NextResponse.json({
          fileName,
          originalSize: pdfBytes.length,
          validation,
          repaired: false,
          reason: "Repair failed"
        });
      }
    }
    
    // Return the validation results
    return NextResponse.json({
      fileName,
      fileSize: pdfBytes.length,
      validation,
      repaired: false
    });
  } catch (error) {
    console.error("Error in repair-pdf debug API:", error);
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 