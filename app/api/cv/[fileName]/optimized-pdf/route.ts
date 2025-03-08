import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getSession } from "@/lib/auth/session";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";

/**
 * API endpoint to retrieve the optimized PDF for a specific CV
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fileName: string } }
) {
  try {
    // Authentication check
    const session = await getSession();
      
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { fileName } = params;

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    // Get the CV record
    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }

    // Parse metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    
    if (!metadata || !metadata.optimized) {
      return NextResponse.json({ error: "CV has not been optimized yet" }, { status: 400 });
    }

    // Check if we already have the optimized PDF data
    if (metadata.optimizedPdfBase64) {
      return NextResponse.json({ 
        pdfBase64: metadata.optimizedPdfBase64,
        message: "Retrieved cached optimized PDF"
      });
    }

    // If we don't have the PDF data but have optimized text, generate the PDF
    if (metadata.optimizedText) {
      try {
        console.log("Generating PDF from optimized text");
        
        // Get the template if specified
        let template = undefined;
        if (metadata.templateId) {
          template = getTemplateById(metadata.templateId);
        }
        
        // Generate the PDF
        const pdfBuffer = await modifyPDFWithOptimizedContent(
          metadata.optimizedText,
          cvRecord.rawText || "",
          template
        );
        
        // Convert to base64
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
        
        // Cache the PDF data in metadata for future requests
        metadata.optimizedPdfBase64 = pdfBase64;
        await updateCVAnalysis(Number(cvRecord.id), JSON.stringify(metadata));
        
        return NextResponse.json({ 
          pdfBase64,
          message: "Generated optimized PDF"
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        return NextResponse.json({ 
          error: `Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}` 
        }, { status: 500 });
      }
    }

    // If we don't have optimized text, return an error
    return NextResponse.json({ error: "No optimized text available to generate PDF" }, { status: 400 });
  } catch (error) {
    console.error("Error retrieving optimized PDF:", error);
    return NextResponse.json({ 
      error: `Failed to retrieve optimized PDF: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

// Helper function to update CV analysis metadata
async function updateCVAnalysis(cvId: number, metadata: string) {
  try {
    // Import the function dynamically to avoid circular dependencies
    const { updateCVAnalysis } = await import("@/lib/db/queries.server");
    return await updateCVAnalysis(cvId, metadata);
  } catch (error) {
    console.error("Error updating CV analysis:", error);
    throw error;
  }
} 