// lib/optimizeCVBackground.ts
import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Performs the optimization in the background.
 * @param cvRecord - The CV record retrieved from the database.
 */
export async function optimizeCVBackground(cvRecord: any) {
  try {
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};

    // 1. Generate optimized text and PDF instructions using GPT-3.5-turbo.
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);
    
    // 2. Retrieve a valid original PDF.
    const originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    
    // 3. Modify the PDF using pdf-lib.
    const modifiedPdfBase64 = await modifyPDFWithOptimizedContent(
      originalPdfBytes,
      optimizationResult.optimizedText
    );

    // Merge new optimization data into metadata.
    const newMetadata = {
      ...metadata,
      optimizedCV: optimizationResult.optimizedText,
      optimizedPDFBase64: modifiedPdfBase64, // Now should contain a valid Base64 PDF.
      optimized: true,
      optimizing: false,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
    };

    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
  } catch (error: any) {
    console.error("Background optimization error:", error);
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = false;
    metadata.error = error.message;
    await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
  }
}

/**
 * Returns a valid PDF bytes for testing.
 * In production, you'd load the original PDF from your storage.
 */
async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  // Create a simple PDF document with one page and sample text.
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Original CV Content", { x: 50, y: 750, size: 24, font: helveticaFont });
  return await pdfDoc.save();
}
