import { optimizeCV } from "./optimizeCV";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { updateCVAnalysis } from "@/lib/db/queries.server";
import { getOriginalPdfBytes } from "./storage"; // Using updated storage helper
import { CV_TEMPLATES } from "@/types/templates";
import { verifyContentPreservation, extractSections } from "./optimizeCV"; // Import needed functions

export async function optimizeCVBackground(cvRecord: any, templateId?: string) {
  try {
    if (!cvRecord.filepath && !cvRecord.filePath) {
      throw new Error("PDF path not found in CV record");
    }
    
    console.log(`Starting CV optimization for: ${cvRecord.id}, template: ${templateId || 'default'}`);
    
    // Parse existing metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Clear any previous errors or stalled state
    delete metadata.error;
    delete metadata.errorTimestamp;
    
    // Check if optimization is already in progress and has been running for too long
    if (metadata.optimizing && metadata.startTime) {
      const startTime = new Date(metadata.startTime);
      const currentTime = new Date();
      const timeDiffMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      // If optimization has been running for more than 5 minutes, reset it
      if (timeDiffMinutes > 5) {
        console.log(`Previous optimization for CV ${cvRecord.id} had been running for ${timeDiffMinutes.toFixed(2)} minutes. Resetting.`);
        console.log(`Previous progress: ${metadata.progress}%, Status: optimizing=${metadata.optimizing}, optimized=${metadata.optimized}`);
      }
    }
    
    // Reset optimization state to start fresh
    metadata.optimizing = true;
    metadata.optimized = false; // Ensure we're not marked as optimized until complete
    
    // Add startTime to the metadata to track optimization progress
    const startTime = new Date().toISOString();
    const updatedMetadata = {
      ...metadata,
      startTime: startTime,
      progress: 10, // Initialize progress at 10%
      lastProgressUpdate: new Date().toISOString() // Track when progress last changed
    };
    
    // Save initial state to database
    try {
      await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));
      console.log(`Initialized optimization state for CV ${cvRecord.id} at 10%`);
    } catch (updateError) {
      console.error("Failed to initialize optimization state:", updateError);
      throw new Error(`Failed to initialize optimization: ${(updateError as Error).message}`);
    }
    
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

    // Update progress to 20%
    try {
      const progress20Metadata = {
        ...updatedMetadata,
        progress: 20,
        lastProgressUpdate: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress20Metadata));
      console.log(`Updated progress to 20% for CV ${cvRecord.id}`);
    } catch (updateError) {
      console.error("Failed to update progress to 20%:", updateError);
      // Continue despite the error
    }

    // Include template information in the optimization process
    console.log("Starting AI optimization...");
    let optimizationResult;
    try {
      // Set a timeout for the AI optimization
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("AI optimization timed out after 60 seconds")), 60000);
      });
      
      // Race the optimization against the timeout
      optimizationResult = await Promise.race([
        optimizeCV(cvRecord.rawText, selectedTemplate),
        timeoutPromise
      ]) as { optimizedText: string; error?: string };
      
      console.log("AI optimization completed successfully");
      
      // Immediately verify we got a valid result
      if (!optimizationResult) {
        throw new Error("Optimization result is undefined");
      }
      
      if (!optimizationResult.optimizedText || optimizationResult.optimizedText.trim().length === 0) {
        console.error("Optimization returned empty text");
        throw new Error("Optimization returned empty text");
      }
      
      console.log(`Optimized text received (length: ${optimizationResult.optimizedText.length} characters)`);
      console.log(`First 100 chars: "${optimizationResult.optimizedText.substring(0, 100).replace(/\n/g, "\\n")}..."`);
      
      // Immediately save the optimized text to avoid loss
      try {
        const progress40Metadata = {
          ...updatedMetadata,
          progress: 40,
          optimizedText: optimizationResult.optimizedText, // Save text immediately
          lastProgressUpdate: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(progress40Metadata));
        console.log(`Saved optimized text at 40% progress for CV ${cvRecord.id}`);
      } catch (immediateUpdateError) {
        console.error("Failed to save optimized text immediately:", immediateUpdateError);
        // Continue despite this error
      }
    } catch (optimizeError) {
      console.error("Error during AI optimization:", optimizeError);
      
      // Update metadata to reflect the error
      try {
        const errorMetadata = {
          ...updatedMetadata,
          optimizing: false,
          error: `AI optimization failed: ${(optimizeError as Error).message}`,
          errorTimestamp: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(errorMetadata));
      } catch (metadataError) {
        console.error("Failed to update error metadata:", metadataError);
      }
      
      throw optimizeError;
    }
    
    // Update progress to 60%
    try {
      const progress60Metadata = {
        ...updatedMetadata,
        progress: 60,
        optimizedText: optimizationResult.optimizedText, // Ensure text is saved here too
        lastProgressUpdate: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress60Metadata));
      console.log(`Updated progress to 60% for CV ${cvRecord.id}`);
    } catch (updateError) {
      console.error("Failed to update progress to 60%:", updateError);
      // Continue despite the error
    }
    
    // Double-check the optimization result again
    if (!optimizationResult || !optimizationResult.optimizedText) {
      console.error("Optimization failed to produce valid output");
      throw new Error("No optimized text was returned from the optimization process");
    }
    
    // Store the optimized text in a variable for further use
    const optimizedText = optimizationResult.optimizedText;
    
    // Update progress to 70%
    try {
      const progress70Metadata = {
        ...updatedMetadata,
        progress: 70,
        optimizedText: optimizedText, // Keep saving the text at each step
        lastProgressUpdate: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress70Metadata));
      console.log(`Updated progress to 70% for CV ${cvRecord.id}`);
    } catch (updateError) {
      console.error("Failed to update progress to 70%:", updateError);
      // Continue despite the error
    }
    
    // Retrieve the original PDF bytes
    let originalPdfBytes;
    try {
      console.log(`Retrieving original PDF for CV ${cvRecord.id}...`);
      originalPdfBytes = await getOriginalPdfBytes(cvRecord);
      
      if (!originalPdfBytes || originalPdfBytes.length === 0) {
        throw new Error("Retrieved empty PDF content");
      }
      
      console.log(`Retrieved original PDF (${originalPdfBytes.length} bytes)`);
    } catch (pdfError) {
      console.error("Error retrieving original PDF bytes:", pdfError);
      
      // Save optimization result without PDF but with text
      try {
        const errorButWithTextMetadata = {
          ...updatedMetadata,
          optimizing: false,
          optimized: true, // Mark as optimized since we have the text
          optimizedText: optimizedText,
          progress: 100,
          error: `PDF retrieval failed: ${(pdfError as Error).message}, but optimized text is available`,
          lastOptimizedAt: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(errorButWithTextMetadata));
        console.log(`Saved optimized text despite PDF error for CV ${cvRecord.id}`);
      } catch (metadataError) {
        console.error("Failed to update error metadata with text:", metadataError);
      }
      
      throw new Error(`Failed to retrieve original PDF: ${(pdfError as Error).message}`);
    }
    
    // Update progress to 80%
    try {
      const progress80Metadata = {
        ...updatedMetadata,
        progress: 80,
        optimizedText: optimizedText, // Keep saving the text
        lastProgressUpdate: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress80Metadata));
      console.log(`Updated progress to 80% for CV ${cvRecord.id}`);
    } catch (updateError) {
      console.error("Failed to update progress to 80%:", updateError);
      // Continue despite the error
    }
    
    // Generate optimized PDF
    let pdfBuffer;
    try {
      console.log("Generating optimized PDF...");
      // Set a timeout for PDF generation
      const pdfTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PDF generation timed out after 30 seconds")), 30000);
      });
      
      // Race the PDF generation against the timeout
      pdfBuffer = await Promise.race([
        modifyPDFWithOptimizedContent(optimizedText, cvRecord.rawText, selectedTemplate),
        pdfTimeoutPromise
      ]) as Uint8Array;
      
      console.log("PDF generation completed successfully");
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("PDF generation produced empty output");
      }
    } catch (pdfError) {
      console.error("Error during PDF modification:", pdfError);
      
      // Save optimization result without PDF but with text
      try {
        const pdfErrorButWithTextMetadata = {
          ...updatedMetadata,
          optimizing: false,
          optimized: true, // Mark as optimized since we have the text
          optimizedText: optimizedText,
          progress: 100,
          error: `PDF generation failed: ${(pdfError as Error).message}, but optimized text is available`,
          lastOptimizedAt: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(pdfErrorButWithTextMetadata));
        console.log(`Saved optimized text despite PDF generation error for CV ${cvRecord.id}`);
      } catch (metadataError) {
        console.error("Failed to update PDF error metadata with text:", metadataError);
      }
      
      throw new Error(`PDF modification failed: ${(pdfError as Error).message}`);
    }
    
    // Update progress to 90%
    try {
      const progress90Metadata = {
        ...updatedMetadata,
        progress: 90,
        optimizedText: optimizedText, // Keep saving the text
        lastProgressUpdate: new Date().toISOString()
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(progress90Metadata));
      console.log(`Updated progress to 90% for CV ${cvRecord.id}`);
    } catch (updateError) {
      console.error("Failed to update progress to 90%:", updateError);
      // Continue despite the error
    }
    
    // Convert PDF buffer to base64
    let modifiedPdfBase64;
    try {
      modifiedPdfBase64 = Buffer.isBuffer(pdfBuffer) 
        ? pdfBuffer.toString('base64')
        : Buffer.from(pdfBuffer).toString('base64');
      
      console.log(`Generated optimized PDF base64 (${modifiedPdfBase64.length} chars)`);
      
      if (!modifiedPdfBase64 || modifiedPdfBase64.length === 0) {
        throw new Error("Failed to convert PDF to base64");
      }
    } catch (base64Error) {
      console.error("Error converting PDF to base64:", base64Error);
      
      // Save optimization result without PDF base64 but with text
      try {
        const base64ErrorButWithTextMetadata = {
          ...updatedMetadata,
          optimizing: false,
          optimized: true,
          optimizedText: optimizedText,
          progress: 100,
          error: `Base64 conversion failed: ${(base64Error as Error).message}, but optimized text is available`,
          lastOptimizedAt: new Date().toISOString()
        };
        await updateCVAnalysis(cvRecord.id, JSON.stringify(base64ErrorButWithTextMetadata));
        console.log(`Saved optimized text despite base64 conversion error for CV ${cvRecord.id}`);
      } catch (metadataError) {
        console.error("Failed to update base64 error metadata with text:", metadataError);
      }
      
      throw new Error(`Failed to convert PDF to base64: ${(base64Error as Error).message}`);
    }
    
    // Prepare final metadata with all optimization results
    const finalMetadata = {
      ...metadata, // Start with original metadata (strengths, weaknesses, etc.)
      optimizedText: optimizedText,
      optimizedPDFBase64: modifiedPdfBase64,
      selectedTemplate: selectedTemplateId,
      optimized: true,
      optimizing: false,
      optimizedTimes: (metadata.optimizedTimes || 0) + 1,
      error: null, // Clear any errors
      progress: 100,
      lastProgressUpdate: new Date().toISOString(),
      lastOptimizedAt: new Date().toISOString(),
      optimizationCompleted: true // Add this flag to explicitly indicate completion
    };
    
    // Verify the final metadata has the optimized text before saving
    if (!finalMetadata.optimizedText || finalMetadata.optimizedText.trim().length === 0) {
      console.error("Final metadata is missing optimized text");
      throw new Error("Final metadata is missing optimized text");
    }
    
    // After optimizing the CV, verify keyword preservation
    try {
      const verification = verifyContentPreservation(cvRecord.rawText, optimizedText);
      console.log(`Keyword preservation score: ${verification.keywordScore}%`);
      
      // If keyword preservation is poor, attempt to recover
      if (!verification.preserved) {
        console.warn(`Keyword preservation failed. Score: ${verification.keywordScore}%. Missing ${verification.missingItems.length} items.`);
        
        // If severe content loss (below 70%), fall back to a more conservative optimization
        if (verification.keywordScore < 70) {
          console.warn("Severe content loss detected. Falling back to conservative optimization...");
          
          try {
            // Update progress to indicate recovery attempt
            const recoveryMetadata = {
              ...updatedMetadata,
              progress: 75,
              warning: "Initial optimization lost important keywords. Attempting recovery.",
              lastProgressUpdate: new Date().toISOString()
            };
            await updateCVAnalysis(cvRecord.id, JSON.stringify(recoveryMetadata));
            
            // Create a conservative fallback that preserves more of the original
            const conservativeOptimizedText = createConservativeOptimizedCV(cvRecord.rawText, templateId || 'default');
            
            // Verify the conservative version
            const conservativeVerification = verifyContentPreservation(cvRecord.rawText, conservativeOptimizedText);
            
            // If conservative approach works better, use it instead
            if (conservativeVerification.keywordScore > verification.keywordScore) {
              console.log(`Conservative optimization improved keyword score to ${conservativeVerification.keywordScore}%`);
              // Create a new optimized text variable instead of reassigning
              const betterOptimizedText = conservativeOptimizedText;
              
              // Update metadata to indicate recovery was successful
              const recoveredMetadata = {
                ...updatedMetadata,
                progress: 80,
                optimizedText: betterOptimizedText,
                warning: "Recovered from keyword loss using conservative optimization.",
                keywordPreservationScore: conservativeVerification.keywordScore,
                lastProgressUpdate: new Date().toISOString()
              };
              await updateCVAnalysis(cvRecord.id, JSON.stringify(recoveredMetadata));
              
              // Return early with the better version
              return {
                optimizedText: betterOptimizedText,
                pdf: await modifyPDFWithOptimizedContent(
                  betterOptimizedText,
                  cvRecord.rawText,
                  selectedTemplate
                ),
                status: 'success',
                message: 'Optimization completed with keyword preservation recovery'
              };
            } else {
              console.warn("Conservative approach did not improve keyword preservation. Using original optimization.");
            }
          } catch (recoveryError) {
            console.error("Error during recovery optimization:", recoveryError);
            // Continue with original optimization despite the keyword loss
          }
        }
        
        // Add missing keywords to metadata for transparency
        const updatedProgress80Metadata = {
          ...updatedMetadata,
          progress: 80,
          optimizedText: optimizedText,
          keywordPreservationScore: verification.keywordScore,
          missingKeywordCount: verification.missingItems.length,
          lastProgressUpdate: new Date().toISOString()
        };
        
        if (verification.missingItems.length > 0) {
          updatedProgress80Metadata.missingKeywordSample = verification.missingItems.slice(0, 10);
        }
        
        await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedProgress80Metadata));
      }
    } catch (verificationError) {
      console.error("Error during content verification:", verificationError);
      // Continue despite verification error
    }
    
    // Save the final optimization results
    try {
      await updateCVAnalysis(cvRecord.id, JSON.stringify(finalMetadata));
      console.log(`CV optimization completed successfully for: ${cvRecord.id}`);
      console.log(`Saved optimized text (${optimizedText.length} chars) and PDF (${modifiedPdfBase64.length} base64 chars)`);
    } catch (finalUpdateError) {
      console.error("Failed to update final metadata:", finalUpdateError);
      throw new Error(`Failed to save optimization results: ${(finalUpdateError as Error).message}`);
    }
    
    return finalMetadata;
  } catch (error) {
    console.error("Background optimization error:", error);
    console.error("CV Record ID:", cvRecord?.id);
    console.error("Error stack:", (error as Error).stack);
    
    try {
      const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      
      // Update metadata to reflect the error
      const errorMetadata = {
        ...metadata,
        optimizing: false, // No longer optimizing
        error: `Optimization failed: ${(error as Error).message}`,
        errorTimestamp: new Date().toISOString()
      };
      
      await updateCVAnalysis(cvRecord.id, JSON.stringify(errorMetadata));
      console.log(`Updated error state for CV ${cvRecord.id}`);
    } catch (metadataError) {
      console.error("Failed to update error metadata:", metadataError);
    }
    
    throw error; // Re-throw the error to be handled by the caller
  }
}

// This function creates a more conservative optimization that preserves more original content
function createConservativeOptimizedCV(originalText: string, templateId: string): string {
  console.log("Creating conservative optimization to preserve keywords");
  
  // Extract sections from the original text
  const sections = extractSections(originalText);
  
  // Create a new CV with better formatting but minimal content changes
  let conservativeCV = `# PROFESSIONAL CV

`;

  // Add sections with minimal changes to preserve keywords
  if (sections.contact) {
    conservativeCV += `## CONTACT INFORMATION
${sections.contact.trim()}

`;
  }

  if (sections.profile) {
    conservativeCV += `## PROFESSIONAL SUMMARY
${sections.profile.trim()}

`;
  }

  if (sections.experience) {
    conservativeCV += `## PROFESSIONAL EXPERIENCE
${sections.experience.trim()}

`;
  }

  if (sections.education) {
    conservativeCV += `## EDUCATION
${sections.education.trim()}

`;
  }

  if (sections.skills) {
    conservativeCV += `## SKILLS
${sections.skills.trim()}

`;
  }

  // Add any additional sections with minimal changes
  for (const [key, value] of Object.entries(sections)) {
    if (!['contact', 'profile', 'experience', 'education', 'skills'].includes(key) && value.trim()) {
      conservativeCV += `## ${key.toUpperCase()}
${value.trim()}

`;
    }
  }

  return conservativeCV;
}
