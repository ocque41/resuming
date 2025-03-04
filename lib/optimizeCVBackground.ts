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
    
    console.log(`Starting CV optimization for: ${cvRecord.id}, template: ${templateId || 'default'}`);
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Use templateId from parameters or from stored metadata if available
    const selectedTemplateId = templateId || metadata.selectedTemplate;
    
    // Find the selected template if a template ID was provided
    let selectedTemplate = undefined;
    if (selectedTemplateId) {
      selectedTemplate = CV_TEMPLATES.find(template => template.id === selectedTemplateId);
      if (!selectedTemplate) {
        console.warn(`Template with ID ${selectedTemplateId} not found. Using default optimization.`);
      } else {
        console.log(`Using template: ${selectedTemplate.name} (${selectedTemplate.company})`);
      }
    }

    // Verify raw text is available
    if (!cvRecord.rawText || cvRecord.rawText.trim().length === 0) {
      console.error("Raw text is missing or empty in CV record");
      throw new Error("CV text content is missing or empty");
    }
    
    console.log(`Raw text length: ${cvRecord.rawText.length} characters`);

    // Include template information in the optimization process
    console.log("Starting optimization with AI...");
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata, selectedTemplate);
    
    // Verify the optimization result
    if (!optimizationResult || !optimizationResult.optimizedText) {
      console.error("Optimization failed to produce valid output");
      throw new Error("No optimized text was returned from the optimization process");
    }
    
    console.log(`Optimized text length: ${optimizationResult.optimizedText.length} characters`);
    console.log(`First 100 characters: ${optimizationResult.optimizedText.substring(0, 100)}...`);
    
    const originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    
    if (!originalPdfBytes || originalPdfBytes.length === 0) {
      throw new Error("Failed to retrieve original PDF content");
    }
    
    console.log(`Retrieved original PDF (${originalPdfBytes.length} bytes)`);
    
    // Pass template information to the PDF modification function
    console.log("Generating optimized PDF...");
    const pdfBuffer = await modifyPDFWithOptimizedContent(
      optimizationResult.optimizedText,
      cvRecord.rawText,
      selectedTemplate
    );
    
    if (!pdfBuffer) {
      throw new Error("PDF modification failed to produce output");
    }
    
    // Convert buffer to base64 string
    const modifiedPdfBase64 = Buffer.isBuffer(pdfBuffer) 
      ? pdfBuffer.toString('base64')
      : Buffer.from(pdfBuffer).toString('base64');
    
    console.log(`Generated optimized PDF (${modifiedPdfBase64.length} base64 characters)`);

    const newMetadata = {
      ...metadata,
      optimizedCV: optimizationResult.optimizedText,
      optimizedPDFBase64: modifiedPdfBase64,
      selectedTemplate: selectedTemplateId, // Save the template ID in metadata
      optimized: true,
      optimizing: false,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
      error: null,
      lastOptimizedAt: new Date().toISOString()
    };

    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
    console.log(`CV optimization completed successfully for: ${cvRecord.id}`);
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
