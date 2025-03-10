import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/**
 * Process CV asynchronously with OpenAI GPT-4o
 * This function handles the entire CV processing workflow without blocking the API response
 */
export async function processCVWithAI(cvId: number, rawText: string, currentMetadata: any) {
  try {
    // Update progress - text extraction completed
    const metadata = {
      ...currentMetadata,
      processingProgress: 10,
      processingStatus: "Analyzing CV content with AI",
      processingError: null,
      lastUpdated: new Date().toISOString(),
    };
    
    await updateCVMetadata(cvId, metadata);
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get system reference content
    const systemReferenceContent = await getSystemReferenceContent();
    
    // Start AI processing
    logger.info(`Starting CV processing with OpenAI for CV ID: ${cvId}`);
    
    // First step: Analyze the CV (20%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 20,
      processingStatus: "Analyzing CV structure and content...",
      lastUpdated: new Date().toISOString(),
    });
    
    // Implement CV analysis logic here
    
    // Update progress (40%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 40,
      processingStatus: "Optimizing CV content...",
      lastUpdated: new Date().toISOString(),
    });
    
    // Implement optimization logic here
    
    // Update progress (70%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 70,
      processingStatus: "Generating optimized document...",
      lastUpdated: new Date().toISOString(),
    });
    
    // Implement document generation logic here
    
    // Update progress (90%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 90,
      processingStatus: "Finalizing documents...",
      lastUpdated: new Date().toISOString(),
    });
    
    // Mark as complete (100%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 100,
      processingCompleted: true,
      processingStatus: "Processing completed successfully!",
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    
    logger.info(`CV processing completed for CV ID: ${cvId}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error in CV processing for CV ID: ${cvId}`, errorMessage);
    
    // Update metadata with error
    await updateCVMetadata(cvId, {
      ...currentMetadata,
      processingError: errorMessage,
      processingStatus: "Processing failed",
      processingCompleted: false,
      lastUpdated: new Date().toISOString(),
    });
  }
}

/**
 * Helper function to update CV metadata
 */
async function updateCVMetadata(cvId: number, metadata: any) {
  try {
    await db.update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvId));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to update CV metadata for CV ID: ${cvId}`, errorMessage);
  }
}

/**
 * Get system reference content from a file
 */
async function getSystemReferenceContent(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "system-reference.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "No reference content available.";
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Error reading system reference content", errorMessage);
    return "Error loading reference content.";
  }
} 