import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // Using updated storage helper
import { CV_TEMPLATES } from "@/types/templates";

export async function optimizeCVBackground(cvRecord: any, templateId?: string) {
  try {
    if (!cvRecord.filepath) {
      throw new Error("PDF path not found in CV record");
    }
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Use templateId from parameters or from stored metadata if available
    const selectedTemplateId = templateId || metadata.selectedTemplate;
    
    // Find the selected template if a template ID was provided
    let selectedTemplate = undefined;
    if (selectedTemplateId) {
      selectedTemplate = CV_TEMPLATES.find(template => template.id === selectedTemplateId);
      if (!selectedTemplate) {
        console.warn(`Template with ID ${selectedTemplateId} not found. Using default optimization.`);
      }
    }

    // Include template information in the optimization process
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata, selectedTemplate);
    const originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    
    if (!originalPdfBytes || originalPdfBytes.length === 0) {
      throw new Error("Failed to retrieve original PDF content");
    }
    
    // Pass template information to the PDF modification function
    const modifiedPdfBase64 = await modifyPDFWithOptimizedContent(
      originalPdfBytes,
      optimizationResult.optimizedText,
      cvRecord.rawText,
      selectedTemplate
    );
    
    if (!modifiedPdfBase64) {
      throw new Error("PDF modification failed to produce output");
    }

    const newMetadata = {
      ...metadata,
      optimizedCV: optimizationResult.optimizedText,
      optimizedPDFBase64: modifiedPdfBase64,
      selectedTemplate: selectedTemplateId, // Save the template ID in metadata
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
