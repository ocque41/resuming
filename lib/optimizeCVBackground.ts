// lib/optimizeCVBackground.ts
import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // using updated storage helper

export async function optimizeCVBackground(cvRecord: any) {
  try {
    // Check if pdfPath (or filepath) exists
    if (!cvRecord.filepath) {
      throw new Error("PDF path not found in CV record");
    }
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};

    // Generate optimized text and PDF instructions using GPT-3.5-turbo.
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);
    
    // Retrieve the original PDF bytes from storage.
    const originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    
    // Modify the PDF using pdf-lib.
    const modifiedPdfBase64 = await modifyPDFWithOptimizedContent(
      originalPdfBytes,
      optimizationResult.optimizedText
    );

    // Merge new optimization data into metadata.
    const newMetadata = {
      ...metadata,
      optimizedCV: optimizationResult.optimizedText,
      optimizedPDFBase64: modifiedPdfBase64,
      optimized: true,
      optimizing: false,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
      error: null,
    };

    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
  } catch (error: any) {
    console.error("Background optimization error:", error);
    // Update metadata to remove the optimizing flag and record the error
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = false;
    metadata.error = error.message;
    await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
  }
}
