// lib/optimizeCVBackground.ts
import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // <-- Import the new function

export async function optimizeCVBackground(cvRecord: any) {
  try {
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};

    // 1. Generate optimized text and PDF instructions using GPT-3.5-turbo.
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);
    
    // 2. Retrieve the original PDF bytes from storage.
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
      optimizedPDFBase64: modifiedPdfBase64, // Now contains the modified PDF in Base64.
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
