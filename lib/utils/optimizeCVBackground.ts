/**
 * CV Optimization Background Utility
 * 
 * This utility provides functions to optimize CV PDFs and update their storage.
 * It supports both Dropbox and S3 storage types.
 */

import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { retrieveFile, saveFile } from "@/lib/fileStorage";
import { logger } from "@/lib/logger";

// Define the CV type based on the schema
interface CV {
  id: number;
  metadata: string | null;
  filepath: string;
}

/**
 * Optimizes a CV PDF to reduce its size
 * 
 * @param cvId The ID of the CV to optimize
 * @returns A result object with success status and details
 */
export async function optimizeCV(cvId: number): Promise<{
  success: boolean;
  message: string;
  optimizedSize?: number;
  originalSize?: number;
  cvId: number;
}> {
  try {
    // Fetch the CV record using query API
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId),
    });
    
    if (!cvRecord) {
      return {
        success: false,
        message: `CV with ID ${cvId} not found`,
        cvId
      };
    }
    
    // Parse metadata from string
    let metadataObj = {};
    try {
      if (cvRecord.metadata) {
        metadataObj = JSON.parse(cvRecord.metadata);
      }
    } catch (e) {
      logger.error(`Failed to parse metadata for CV ${cvId}: ${e}`);
    }
    
    // Skip if already optimized
    if (metadataObj && 
        typeof metadataObj === 'object' && 
        'optimizedPdfData' in metadataObj) {
      return {
        success: true,
        message: "CV already optimized",
        cvId
      };
    }
    
    const filePath = cvRecord.filepath;
    if (!filePath) {
      return {
        success: false,
        message: "CV has no file path",
        cvId
      };
    }
    
    // Determine storage type from metadata or file path
    const storageType = (metadataObj as any).storageType || 
                       (filePath.startsWith('/') ? 'dropbox' : 's3');
    
    // Retrieve the file
    const pdfBytes = await retrieveFile(filePath, storageType);
    
    if (!pdfBytes || pdfBytes.length === 0) {
      return {
        success: false,
        message: `Failed to retrieve CV file from ${storageType}`,
        cvId
      };
    }
    
    const originalSize = pdfBytes.length;
    
    // Optimize the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // You can add more optimization techniques here
    // For example, compress images, remove metadata, etc.
    
    // Save the optimized PDF
    const optimizedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    const optimizedSize = optimizedPdfBytes.length;
    
    // Don't save if optimization didn't reduce size
    if (optimizedSize >= originalSize) {
      return {
        success: true,
        message: "Optimization would not reduce file size, skipped",
        originalSize,
        optimizedSize,
        cvId
      };
    }
    
    // Encode optimized PDF as base64
    const optimizedPdfData = Buffer.from(optimizedPdfBytes).toString('base64');
    
    // Update the CV record with optimized PDF data
    const updatedMetadata = {
      ...metadataObj,
      optimizedPdfData,
      originalSize,
      optimizedSize,
      optimizedAt: new Date().toISOString()
    };
    
    // Convert metadata object back to string for database storage
    await db.update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, cvId));
    
    return {
      success: true,
      message: `Successfully optimized CV (${Math.round((originalSize - optimizedSize) / originalSize * 100)}% reduction)`,
      originalSize,
      optimizedSize,
      cvId
    };
    
  } catch (error) {
    logger.error(`Error optimizing CV ${cvId}: ${error}`);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      cvId
    };
  }
}

/**
 * Batch optimize multiple CVs
 * 
 * @param limit Maximum number of CVs to process
 * @returns Array of optimization results
 */
export async function batchOptimizeCVs(limit = 10): Promise<Array<{
  success: boolean;
  message: string;
  optimizedSize?: number;
  originalSize?: number;
  cvId: number;
}>> {
  try {
    // Find CVs that haven't been optimized yet using query API
    const unoptimizedCVs = await db.query.cvs.findMany();
    
    // Filter after fetching to handle metadata properly
    const filteredCVs = unoptimizedCVs.filter((cv: CV) => {
      try {
        if (!cv.metadata) return true;
        const metadataObj = JSON.parse(cv.metadata);
        return !(metadataObj && 
                 typeof metadataObj === 'object' && 
                 'optimizedPdfData' in metadataObj);
      } catch (e) {
        // If we can't parse the metadata, include it for optimization
        return true;
      }
    }).slice(0, limit);
    
    const results = [];
    
    for (const cv of filteredCVs) {
      // Add a small delay to avoid overloading the system
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await optimizeCV(cv.id);
      results.push(result);
    }
    
    return results;
    
  } catch (error) {
    logger.error(`Error in batch CV optimization: ${error}`);
    return [{
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      cvId: -1
    }];
  }
} 