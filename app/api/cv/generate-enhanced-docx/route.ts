import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DocumentGenerator } from "@/lib/utils/documentGenerator";
import { logger } from "@/lib/logger";

/**
 * POST /api/cv/generate-enhanced-docx
 * Optimized endpoint for generating enhanced DOCX files from CV content
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check session
    const session = await getSession();
    if (!session || !session.user) {
      logger.warn("Unauthorized access attempt to generate-enhanced-docx");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId } = body;
    
    // Validate cvId
    if (!cvId) {
      return new Response(JSON.stringify({ error: "Missing cvId parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    logger.info(`Starting enhanced DOCX generation for CV ID: ${cvId}`);
    
    // Get CV record
    const cv = await db.query.cv.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cv) {
      logger.error(`CV not found for ID: ${cvId}`);
      return new Response(JSON.stringify({ error: "CV not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Parse metadata
    let metadata: { optimizedText?: string } = {};
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (e) {
        logger.error(`Error parsing CV metadata: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Check if we have optimized text
    const optimizedText = metadata.optimizedText;
    if (!optimizedText) {
      logger.error(`Optimized text not found for CV ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV has not been optimized yet", 
        needsOptimization: true 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Generate DOCX using our fast document generator
    const docxBuffer = await DocumentGenerator.generateDocx(optimizedText, metadata);
    
    // Convert to base64
    const base64Docx = docxBuffer.toString('base64');
    
    // Update metadata to record document generation
    const updatedMetadata = {
      ...metadata,
      enhancedDocxGenerated: true,
      enhancedDocxGeneratedAt: new Date().toISOString(),
      enhancedDocxGenerationTime: Date.now() - startTime,
    };
    
    // Update CV record
    await db.update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, parseInt(cvId)));
    
    logger.info(`Enhanced DOCX generated for CV ID: ${cvId} in ${Date.now() - startTime}ms`);
    
    // Return base64 encoded DOCX
    return new Response(JSON.stringify({ 
      success: true, 
      base64Docx,
      generationTimeMs: Date.now() - startTime,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`Error generating enhanced DOCX: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(JSON.stringify({ 
      error: "Failed to generate enhanced DOCX", 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 