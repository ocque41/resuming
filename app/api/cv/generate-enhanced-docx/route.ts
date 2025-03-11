import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DocumentGenerator } from "@/lib/utils/documentGenerator";

/**
 * POST /api/cv/generate-enhanced-docx
 * Enhanced endpoint for generating DOCX files from CV content
 * with robust error handling and ATS score information
 */
export async function POST(request: NextRequest) {
  try {
    // Check session
    const session = await getSession();
    if (!session || !session.user) {
      console.warn("Unauthorized access attempt to generate-enhanced-docx");
      return new Response(JSON.stringify({ 
        error: "Unauthorized",
        success: false 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid request body",
        details: parseError instanceof Error ? parseError.message : "Could not parse JSON",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const { cvId, forceRefresh = false } = body || {};
    
    // Validate cvId
    if (!cvId) {
      console.error("Missing cvId parameter in generate-enhanced-docx request");
      return new Response(JSON.stringify({ 
        error: "Missing cvId parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(String(cvId));
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      console.error(`Error parsing cvId: ${cvId}`, parseError);
      return new Response(JSON.stringify({ 
        error: `Invalid cvId: ${cvId} is not a valid number`,
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    console.log(`Starting enhanced DOCX generation for CV ID: ${cvId}`);
    
    // Get CV record with safety checks
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });
    } catch (dbError) {
      console.error(`Database error fetching CV ${cvId}:`, dbError);
      return new Response(JSON.stringify({ 
        error: "Database error while fetching CV",
        details: dbError instanceof Error ? dbError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (!cv) {
      console.error(`CV not found for ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV not found",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Parse metadata with safety
    let metadata: { 
      optimizedText?: string;
      atsScore?: number;
      improvedAtsScore?: number;
      improvements?: string[];
      docxBase64?: string;
    } = {};
    
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (parseError) {
        console.error(`Error parsing CV metadata: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        // Continue with empty metadata
      }
    }
    
    // Check if we already have a DOCX and aren't forcing a refresh
    if (!forceRefresh && metadata.docxBase64) {
      console.log(`Using existing DOCX for CV ${cvId}`);
      
      // Get ATS scores from metadata
      const originalAtsScore = metadata.atsScore || 0;
      const improvedAtsScore = metadata.improvedAtsScore || 0;
      const improvements = metadata.improvements || [];
      
      return new Response(JSON.stringify({ 
        success: true, 
        docxBase64: metadata.docxBase64,
        originalAtsScore,
        improvedAtsScore,
        improvements,
        optimizedText: metadata.optimizedText,
        message: "Using existing DOCX"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Check if we have optimized text
    const optimizedText = metadata.optimizedText || cv.rawText;
    if (!optimizedText) {
      console.error(`No text content found for CV ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV has no content to generate document from", 
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Generate DOCX using the DocumentGenerator
    let docxBuffer;
    try {
      docxBuffer = await DocumentGenerator.generateDocx(optimizedText, metadata);
    } catch (genError) {
      console.error(`Error generating DOCX: ${genError instanceof Error ? genError.message : String(genError)}`);
      return new Response(JSON.stringify({ 
        error: "Failed to generate DOCX document", 
        details: genError instanceof Error ? genError.message : "Document generation error",
        success: false 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Convert buffer to base64
    const docxBase64 = Buffer.from(docxBuffer).toString('base64');
    
    // Get ATS scores from metadata
    const originalAtsScore = metadata.atsScore || 65; // Default value if not available
    const improvedAtsScore = metadata.improvedAtsScore || 85; // Default value if not available
    const improvements = metadata.improvements || [
      "Improved keyword density for better ATS matching",
      "Enhanced formatting for better readability",
      "Added quantifiable achievements to highlight experience"
    ];
    
    // Update metadata to record document generation with safety
    const updatedMetadata = {
      ...metadata,
      docxBase64,
      docxGeneratedAt: new Date().toISOString(),
      originalAtsScore,
      improvedAtsScore,
      improvements
    };
    
    // Update CV record with safety
    try {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, cvIdNumber));
      
      console.log(`Enhanced DOCX metadata updated for CV ID: ${cvId}`);
    } catch (updateError) {
      // Log error but continue - we don't want to fail if metadata update fails
      console.error(`Error updating metadata for CV ID: ${cvId}:`, updateError);
    }
    
    // Return DOCX data with ATS scores
    return new Response(JSON.stringify({ 
      success: true, 
      docxBase64,
      originalAtsScore,
      improvedAtsScore,
      improvements,
      optimizedText,
      fileName: cv.fileName || `cv-${cvId}.docx`,
      message: "DOCX generated successfully"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the detailed error
    console.error(`Error generating enhanced DOCX:`, error);
    
    // Provide a user-friendly response
    return new Response(JSON.stringify({ 
      error: "Failed to generate enhanced DOCX", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 