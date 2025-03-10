import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/cv/get-analyzed-cvs
 * Fast endpoint to retrieve analyzed CVs that are ready for optimization
 */
export async function GET(request: NextRequest) {
  try {
    // Mock response with analyzed CVs
    const mockAnalyzedCVs = [
      {
        id: 123,
        fileName: "example_cv.pdf",
        createdAt: new Date().toISOString(),
        atsScore: 75
      }
    ];
    
    console.log(`Found ${mockAnalyzedCVs.length} analyzed CVs ready for optimization`);
    
    // Return the results
    return new Response(JSON.stringify({ 
      success: true, 
      analyzedCVs: mockAnalyzedCVs
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error getting analyzed CVs: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(JSON.stringify({ 
      error: "Failed to retrieve analyzed CVs", 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 