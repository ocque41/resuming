import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/cv/generate-enhanced-docx
 * Simplified endpoint for generating DOCX files from CV content
 */
export async function POST(request: NextRequest) {
  try {
    // Check session
    const session = await getSession();
    if (!session || !session.user) {
      console.warn("Unauthorized access attempt to generate-enhanced-docx");
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
    
    console.log(`Starting enhanced DOCX generation for CV ID: ${cvId}`);
    
    // Get CV record
    const cv = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cv) {
      console.error(`CV not found for ID: ${cvId}`);
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
        console.error(`Error parsing CV metadata: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Check if we have optimized text
    const optimizedText = metadata.optimizedText;
    if (!optimizedText) {
      console.error(`Optimized text not found for CV ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV has not been optimized yet", 
        needsOptimization: true 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Simulate document generation with a simple message
    // In a real implementation, this would generate a DOCX file
    const mockBase64Docx = "UEsDBBQAAA..."; // Mock base64-encoded DOCX
    
    // Update metadata to record document generation
    const updatedMetadata = {
      ...metadata,
      enhancedDocxGenerated: true,
      enhancedDocxGeneratedAt: new Date().toISOString(),
    };
    
    // Update CV record
    await db.update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, parseInt(cvId)));
    
    console.log(`Enhanced DOCX generated for CV ID: ${cvId}`);
    
    // Return mock DOCX data
    return new Response(JSON.stringify({ 
      success: true, 
      base64Docx: mockBase64Docx,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error generating enhanced DOCX: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(JSON.stringify({ 
      error: "Failed to generate enhanced DOCX", 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 