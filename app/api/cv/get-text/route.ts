import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * API endpoint to get the raw text content of a CV
 * 
 * Query parameters:
 * - cvId: ID of the CV to retrieve text for
 * 
 * Returns:
 * - success: boolean indicating if the operation was successful
 * - text: the raw text content of the CV
 * - error: error message if the operation failed
 */
export async function GET(request: NextRequest) {
  try {
    // Get session to authenticate the user
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to access CV data." },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Get the cvId from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID parameter." },
        { status: 400 }
      );
    }
    
    // Fetch the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    // Check if the CV exists
    if (!cvRecord) {
      return NextResponse.json(
        { success: false, error: "CV not found." },
        { status: 404 }
      );
    }
    
    // Check if the CV belongs to the user
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Check if the CV has raw text content
    if (!cvRecord.rawText || cvRecord.rawText.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "CV text content not available. The CV may need to be processed first.",
          needsProcessing: true
        },
        { status: 404 }
      );
    }
    
    // Return the raw text content
    return NextResponse.json({
      success: true,
      text: cvRecord.rawText,
      fileName: cvRecord.fileName,
      cvId: cvRecord.id
    });
    
  } catch (error) {
    console.error("Error retrieving CV text:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve CV text content." },
      { status: 500 }
    );
  }
} 