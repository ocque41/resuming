import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // Using updated storage helper
import { CV_TEMPLATES } from "@/types/templates";

export async function optimizeCVBackground(cvRecord: any, templateId?: string) {
  try {
    if (!cvRecord.filepath && !cvRecord.filePath) {
      throw new Error("PDF path not found in CV record");
    }
    
    console.log(`Starting CV optimization for: ${cvRecord.id}, template: ${templateId || 'default'}`);
    
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Check if optimization is already in progress and has been running for too long
    if (metadata.optimizing && metadata.startTime) {
      const startTime = new Date(metadata.startTime);
      const currentTime = new Date();
      const timeDiffMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      // If optimization has been running for more than 5 minutes, reset it
      if (timeDiffMinutes > 5) {
        console.log(`Optimization for CV ${cvRecord.id} has been running for ${timeDiffMinutes.toFixed(2)} minutes. Resetting.`);
        metadata.optimizing = false;
        metadata.error = "Previous optimization attempt timed out";
      }
    }
    
    // Add startTime to the metadata to track optimization progress
    const startTime = new Date().toISOString();
    const updatedMetadata = {
      ...metadata,
      optimizing: true,
      startTime: startTime,
      progress: 10, // Initialize progress at 10%
      error: null // Clear any previous errors
    };
    await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));
    
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

    try {
      // Update progress to 20%
      const progress20Metadata = {
        ...metadata,
        optimizing: true,
        startTime: startTime,
        progress: 20
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress20Metadata));
    } catch (updateError) {
      console.error("Failed to update progress to 20%:", updateError);
      // Continue despite the error
    }

    // Include template information in the optimization process
    console.log("Starting optimization with AI...");
    let optimizationResult;
    try {
      optimizationResult = await optimizeCV(cvRecord.rawText, selectedTemplate);
      console.log("AI optimization completed successfully");
      
      // Immediately check if we have valid optimized text
      if (!optimizationResult || !optimizationResult.optimizedText || optimizationResult.optimizedText.trim().length === 0) {
        console.error("Optimization returned empty or invalid text");
        throw new Error("Optimization returned empty or invalid text");
      }
      
      // Log the first part of the optimized text for debugging
      console.log(`Optimized text preview: "${optimizationResult.optimizedText.substring(0, 100)}..."`);
    } catch (optimizeError) {
      console.error("Error during AI optimization:", optimizeError);
      throw optimizeError;
    }
    
    try {
      // Update progress to 60%
      const progress60Metadata = {
        ...metadata,
        optimizing: true,
        startTime: startTime,
        progress: 60
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress60Metadata));
    } catch (updateError) {
      console.error("Failed to update progress to 60%:", updateError);
      // Continue despite the error
    }
    
    // Verify the optimization result
    if (!optimizationResult || !optimizationResult.optimizedText) {
      console.error("Optimization failed to produce valid output");
      throw new Error("No optimized text was returned from the optimization process");
    }
    
    console.log(`Optimized text length: ${optimizationResult.optimizedText.length} characters`);
    console.log(`First 100 characters: \`\`\` ${optimizationResult.optimizedText.substring(0, 100)}...`);
    
    // Store the optimized text in a variable to ensure it's available
    const optimizedText = optimizationResult.optimizedText;
    
    try {
      // Update progress to 70% and save the optimized text immediately
      const progress70Metadata = {
        ...metadata,
        optimizing: true,
        optimized: false, // Don't mark as optimized until the entire process is complete
        startTime: startTime,
        progress: 70,
        optimizedText: optimizedText // Save the optimized text here as well
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress70Metadata));
      console.log("Updated progress to 70% and saved optimized text");
    } catch (updateError) {
      console.error("Failed to update progress to 70%:", updateError);
      // Continue despite the error
    }
    
    let originalPdfBytes;
    try {
      originalPdfBytes = await getOriginalPdfBytes(cvRecord);
    } catch (pdfError: any) {
      console.error("Error retrieving original PDF bytes:", pdfError);
      throw new Error(`Failed to retrieve original PDF: ${pdfError.message}`);
    }
    
    if (!originalPdfBytes || originalPdfBytes.length === 0) {
      throw new Error("Failed to retrieve original PDF content");
    }
    
    console.log(`Retrieved original PDF (${originalPdfBytes.length} bytes)`);
    
    try {
      // Update progress to 80%
      const progress80Metadata = {
        ...metadata,
        optimizing: true,
        startTime: startTime,
        progress: 80
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress80Metadata));
    } catch (updateError) {
      console.error("Failed to update progress to 80%:", updateError);
      // Continue despite the error
    }
    
    // Pass template information to the PDF modification function
    console.log("Generating optimized PDF...");
    let pdfBuffer;
    try {
      pdfBuffer = await modifyPDFWithOptimizedContent(
        optimizationResult.optimizedText,
        cvRecord.rawText,
        selectedTemplate
      );
      console.log("PDF modification completed successfully");
    } catch (pdfError: any) {
      console.error("Error during PDF modification:", pdfError);
      throw new Error(`PDF modification failed: ${pdfError.message}`);
    }
    
    try {
      // Update progress to 90%
      const progress90Metadata = {
        ...metadata,
        optimizing: true,
        startTime: startTime,
        progress: 90
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress90Metadata));
    } catch (updateError) {
      console.error("Failed to update progress to 90%:", updateError);
      // Continue despite the error
    }
    
    if (!pdfBuffer) {
      throw new Error("PDF modification failed to produce output");
    }
    
    // Convert buffer to base64 string
    const modifiedPdfBase64 = Buffer.isBuffer(pdfBuffer) 
      ? pdfBuffer.toString('base64')
      : Buffer.from(pdfBuffer).toString('base64');
    
    console.log(`Generated optimized PDF (${modifiedPdfBase64.length} base64 characters)`);

    // Ensure we're using the optimized text we saved earlier
    const newMetadata = {
      ...metadata,
      optimizedText: optimizedText, // Use the variable we stored earlier
      optimizedPDFBase64: modifiedPdfBase64,
      selectedTemplate: selectedTemplateId, // Save the template ID in metadata
      optimized: true,
      optimizing: false,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
      error: null,
      progress: 100, // Mark as 100% complete
      lastOptimizedAt: new Date().toISOString()
    };

    try {
      // Verify the metadata has the optimized text before saving
      if (!newMetadata.optimizedText || newMetadata.optimizedText.trim().length === 0) {
        console.error("Final metadata is missing optimized text");
        throw new Error("Final metadata is missing optimized text");
      }
      
      await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
      console.log(`CV optimization completed successfully for: ${cvRecord.id}`);
      console.log(`Optimized text saved (${optimizedText.length} characters)`);
    } catch (finalUpdateError: any) {
      console.error("Failed to update final metadata:", finalUpdateError);
      throw new Error(`Failed to save optimization results: ${finalUpdateError.message}`);
    }
    
    return newMetadata;
  } catch (error: any) {
    console.error("Background optimization error:", error);
    console.error("CV Record ID:", cvRecord.id);
    console.error("Error stack:", error.stack);
    
    try {
      const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      metadata.optimizing = false;
      metadata.error = error.message;
      metadata.errorTimestamp = new Date().toISOString();
      await updateCVAnalysis(cvRecord.id, JSON.stringify(metadata));
    } catch (metadataError) {
      console.error("Failed to update error metadata:", metadataError);
    }
    
    throw error; // Re-throw the error to be handled by the caller
  }
}
