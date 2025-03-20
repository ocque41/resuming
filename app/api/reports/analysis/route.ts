import { NextRequest, NextResponse } from "next/server";
import { getLatestDocumentAnalysis } from "@/lib/db/queries.server";
import { AnalysisReportGenerator } from "@/lib/pdf/analysis-report-generator";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Generate and download a PDF report for document analysis
 * 
 * This API endpoint generates a PDF report based on the analysis results
 * for a specific document.
 * 
 * Query parameters:
 * - documentId: The ID of the document to generate a report for
 */
export async function GET(req: NextRequest) {
  try {
    // Get document ID from query params
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    
    // Validate documentId
    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }
    
    // Get the document analysis from the database
    const analysis = await getLatestDocumentAnalysis(Number(documentId));
    
    if (!analysis) {
      return NextResponse.json({ error: "No analysis found for the document" }, { status: 404 });
    }
    
    // Get the CV document to get the file name
    const documents = await db.select().from(cvs).where(eq(cvs.id, Number(documentId))).limit(1);
    const document = documents.length > 0 ? documents[0] : null;
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    
    // Create a PDF generator
    const generator = new AnalysisReportGenerator(
      analysis, 
      document.fileName || `Document_${documentId}`
    );
    
    // Generate the PDF
    const pdfBytes = await generator.generatePDF();
    
    // Create a clean filename for the download
    const fileName = document.fileName 
      ? document.fileName.replace(/\.[^.]+$/, '') // Remove extension
      : `Document_${documentId}`;
    
    // Format the current date for the filename
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Return the PDF as a downloadable file
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CV_Analysis_${fileName}_${date}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    return NextResponse.json({ 
      error: "Failed to generate report", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 