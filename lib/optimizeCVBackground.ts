import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // Using updated storage helper

export async function optimizeCVBackground(cvRecord: any) {
  try {
    if (!cvRecord.filepath) {
      throw new Error("PDF path not found in CV record");
    }
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};

    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);
    const originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    
    if (!originalPdfBytes || originalPdfBytes.length === 0) {
      throw new Error("Failed to retrieve original PDF content");
    }
    
    const modifiedPdfBase64 = await modifyPDFWithOptimizedContent(
      originalPdfBytes,
      optimizationResult.optimizedText
    );
    
    if (!modifiedPdfBase64) {
      throw new Error("PDF modification failed to produce output");
    }

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
    console.error("CV Record ID:", cvRecord.id);
    console.error("Error stack:", error.stack);
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = false;
    metadata.error = error.message;
    metadata.errorTimestamp = new Date().toISOString();
    await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
  }
}
