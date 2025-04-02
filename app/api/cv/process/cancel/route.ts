import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/cv/process/cancel
 * Endpoint to cancel CV processing that is taking too long
 */
export async function POST(request: NextRequest) {
  try {
    // Check session
    const session = await getSession();
    if (!session || !session.user) {
      logger.warn("Unauthorized access attempt to cancel CV processing");
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }
    
    // Get cvId from query parameters
    const url = new URL(request.url);
    const cvId = url.searchParams.get("cvId");
    
    if (!cvId) {
      logger.error("Missing cvId parameter in cancel request");
      return NextResponse.json({ error: "Missing cvId parameter", success: false }, { status: 400 });
    }
    
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(cvId);
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      logger.error(`Error parsing cvId: ${cvId}`, parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ error: `Invalid cvId: ${cvId}`, success: false }, { status: 400 });
    }
    
    // Get CV record to verify ownership
    const cv = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvIdNumber)
    });
    
    if (!cv) {
      logger.error(`CV not found for ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found", success: false }, { status: 404 });
    }
    
    // Verify user owns this CV
    if (String(cv.userId) !== String(session.user.id)) {
      logger.warn(`User ${session.user.id} attempted to cancel processing for CV ${cvId} which belongs to user ${cv.userId}`);
      return NextResponse.json({ error: "Not authorized to cancel this CV's processing", success: false }, { status: 403 });
    }
    
    // Parse existing metadata
    let metadata: any = {};
    try {
      if (cv.metadata) {
        metadata = JSON.parse(cv.metadata);
      }
    } catch (parseError) {
      logger.error(`Error parsing metadata for CV ${cvId}:`, parseError instanceof Error ? parseError.message : String(parseError));
      // Continue with empty metadata
    }
    
    // Update metadata to indicate processing has been cancelled
    metadata.processingCancelled = true;
    metadata.lastUpdated = new Date().toISOString();
    
    // Update CV record
    await db.update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvIdNumber));
    
    logger.info(`Processing cancelled for CV ID: ${cvId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Processing cancelled successfully", 
      cvId 
    });
  } catch (error) {
    logger.error("Error cancelling CV processing:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      error: "Failed to cancel processing", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false 
    }, { 
      status: 500 
    });
  }
} 