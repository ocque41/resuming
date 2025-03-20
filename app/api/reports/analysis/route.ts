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
  console.log("PDF report generation API: Request received");
  
  try {
    // Get document ID from query params
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    
    // Validate documentId
    if (!documentId) {
      console.error("PDF report generation failed: Missing document ID");
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }
    
    console.log(`Generating PDF report for document ID: ${documentId}`);
    
    // Get the CV document first to ensure it exists
    const documents = await db.select().from(cvs).where(eq(cvs.id, Number(documentId))).limit(1);
    const document = documents.length > 0 ? documents[0] : null;
    
    if (!document) {
      console.error(`PDF report generation failed: Document with ID ${documentId} not found`);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    
    console.log(`Found document: ${document.fileName}`);
    
    // Get the document analysis from the database
    let analysis = await getLatestDocumentAnalysis(Number(documentId));
    
    // If no analysis found in the analyses table, try to get from metadata (legacy)
    if (!analysis && document.metadata) {
      console.log(`No analysis found in documentAnalyses table, checking metadata`);
      try {
        // Try to parse the metadata
        const metadataAnalysis = JSON.parse(document.metadata);
        if (metadataAnalysis && Object.keys(metadataAnalysis).length > 0) {
          console.log(`Found analysis in document metadata`);
          analysis = {
            id: 0,
            cvId: Number(documentId),
            version: 1,
            analysisType: metadataAnalysis.analysisType || "general",
            createdAt: new Date(),
            contentAnalysis: metadataAnalysis.contentAnalysis,
            sentimentAnalysis: metadataAnalysis.sentimentAnalysis,
            keyInformation: metadataAnalysis.keyInformation,
            summary: metadataAnalysis.summary,
            rawAnalysisResponse: metadataAnalysis,
            overallScore: metadataAnalysis.summary?.overallScore || 0,
            sentimentScore: metadataAnalysis.sentimentAnalysis?.overallScore ? Math.round(metadataAnalysis.sentimentAnalysis.overallScore * 100) : 0,
            keywordCount: metadataAnalysis.contentAnalysis?.topKeywords?.length || 0,
            entityCount: metadataAnalysis.keyInformation?.entities?.length || 0,
          };
        }
      } catch (parseError) {
        console.error(`Error parsing metadata analysis:`, parseError);
      }
    }
    
    if (!analysis) {
      console.error(`PDF report generation failed: No analysis found for document ${documentId}`);
      return NextResponse.json({ error: "No analysis found for the document. Please analyze the document first." }, { status: 404 });
    }
    
    console.log(`Analysis found for document ${documentId}, generating PDF...`);
    
    // Create a PDF generator
    const generator = new AnalysisReportGenerator(
      analysis.rawAnalysisResponse || analysis, 
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
    
    console.log(`PDF generated successfully, size: ${pdfBytes.length} bytes`);
    
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