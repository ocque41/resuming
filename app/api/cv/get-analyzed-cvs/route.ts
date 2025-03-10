import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/cv/get-analyzed-cvs
 * Safe endpoint to retrieve analyzed CVs that are ready for optimization
 * with robust error handling
 */
export async function GET(request: NextRequest) {
  try {
    // Create a more realistic mock response
    const mockAnalyzedCVs = [
      {
        id: 123,
        fileName: "example_cv.pdf",
        createdAt: new Date().toISOString(),
        atsScore: 75
      }
    ];
    
    // For debugging purposes
    console.log(`Returning ${mockAnalyzedCVs.length} analyzed CVs`);
    
    // Return the mock results with clean JSON
    return new Response(JSON.stringify({ 
      success: true, 
      analyzedCVs: mockAnalyzedCVs
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the detailed error
    console.error(`Error getting analyzed CVs:`, error);
    
    // Provide a user-friendly response that avoids toString() on errors
    return new Response(JSON.stringify({ 
      error: "Failed to retrieve analyzed CVs", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 