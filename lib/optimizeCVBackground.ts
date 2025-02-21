// lib/optimizeCVBackground.ts
import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";

/**
 * Performs the optimization in the background.
 * @param cvRecord - The CV record retrieved from the database.
 */
export async function optimizeCVBackground(cvRecord: any) {
  try {
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};

    // 1. Generate optimized text and PDF instructions using GPT-3.5-turbo.
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);
    // 2. Load the original PDF bytes (you would retrieve these from your storage).
    // For demonstration, we assume you have a function getOriginalPdfBytes(cvRecord)
    // that returns a Uint8Array of the original PDF.
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
      optimizedPDFBase64: modifiedPdfBase64, // Store the Base64 string or a URL after saving it externally.
      optimized: true,
      optimizing: false,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
    };

    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
  } catch (error: any) {
    console.error("Background optimization error:", error);
    // Update metadata to remove the optimizing flag and store the error.
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = false;
    metadata.error = error.message;
    await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
  }
}

/**
 * Dummy function to simulate retrieving the original PDF bytes.
 * In production, retrieve the PDF from your storage solution.
 */
async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  // Simulate a delay and return dummy PDF bytes.
  // Replace this with your actual implementation.
  return new Uint8Array(); // <-- Replace with actual PDF bytes.
}
