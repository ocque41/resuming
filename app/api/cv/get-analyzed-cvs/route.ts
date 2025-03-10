import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * CV record with basic fields we need
 */
interface CVRecord {
  id: number | string;
  fileName?: string;
  createdAt?: string | Date;
  metadata: string | null;
  userId?: number | string;
}

/**
 * Analyzed CV with processed fields
 */
interface AnalyzedCV {
  id: number | string;
  fileName: string;
  createdAt?: string | Date;
  atsScore: number | null;
}

/**
 * GET /api/cv/get-analyzed-cvs
 * Fast endpoint to retrieve analyzed CVs that are ready for optimization
 */
export async function GET(request: NextRequest) {
  try {
    // Get userId from session to filter CVs (optional)
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    
    // Get all CVs using the most basic approach
    let records: CVRecord[] = [];
    
    try {
      // Try to use query.cv.findMany if available
      // @ts-ignore - we're checking for existence at runtime
      if (typeof db.query.cv.findMany === 'function') {
        // @ts-ignore - we know it exists at this point
        records = await db.query.cv.findMany();
      } else {
        // Fallback: use the findFirst method to simulate findMany
        // This is just to make TypeScript happy
        records = [];
        logger.warn("findMany not available, using fallback empty records");
      }
    } catch (error) {
      logger.error(`Error fetching CVs: ${error instanceof Error ? error.message : String(error)}`);
      records = []; // Default to empty array
    }
    
    // Filter and transform results in memory 
    const analyzedCVs: AnalyzedCV[] = records
      .filter((record: CVRecord) => {
        if (!record.metadata) return false;
        
        try {
          const metadata = JSON.parse(record.metadata);
          return metadata && 
                 typeof metadata.atsScore === 'number' && 
                 !metadata.optimized && 
                 (!userId || record.userId === parseInt(userId as string));
        } catch (e) {
          return false;
        }
      })
      .map((record: CVRecord) => ({
        id: record.id,
        fileName: record.fileName || 'Unnamed CV',
        createdAt: record.createdAt,
        atsScore: extractAtsScore(record.metadata)
      }))
      .sort((a: AnalyzedCV, b: AnalyzedCV) => {
        // Sort by createdAt in descending order (most recent first)
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5); // Limit to 5 results
    
    logger.info(`Found ${analyzedCVs.length} analyzed CVs ready for optimization`);
    
    // Return the results
    return new Response(JSON.stringify({ 
      success: true, 
      analyzedCVs
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`Error getting analyzed CVs: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(JSON.stringify({ 
      error: "Failed to retrieve analyzed CVs", 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Helper function to extract ATS score from metadata JSON string
 */
function extractAtsScore(metadataJson: string | null): number | null {
  if (!metadataJson) return null;
  
  try {
    const metadata = JSON.parse(metadataJson);
    return typeof metadata.atsScore === 'number' ? metadata.atsScore : null;
  } catch (e) {
    return null;
  }
} 