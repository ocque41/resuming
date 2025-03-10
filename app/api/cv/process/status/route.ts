import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to check CV processing status." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Get CV ID from query parameter
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      return NextResponse.json(
        { success: false, error: "Missing CV ID parameter." },
        { status: 400 }
      );
    }
    
    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Parse metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      return NextResponse.json(
        { success: false, error: "Invalid CV metadata." },
        { status: 500 }
      );
    }
    
    // Check if processing is completed
    const completed = !metadata.processing && (metadata.processingCompleted || metadata.optimized);
    
    // Extract improvements from metadata or create default values
    const improvements = metadata.improvements || [];
    
    // Extract optimized text from metadata
    const optimizedText = metadata.optimizedText || "";
    
    // Return the processing status with enhanced data
    return NextResponse.json({
      success: true,
      cvId: cvRecord.id,
      fileName: cvRecord.fileName,
      processing: metadata.processing || false,
      progress: metadata.processingProgress || 0,
      step: metadata.processingStatus || "Waiting to start",
      isComplete: completed,
      originalAtsScore: metadata.atsScore || 0,
      improvedAtsScore: metadata.improvedAtsScore || 0,
      error: metadata.processingError || null,
      improvements,
      optimizedText,
      lastUpdated: metadata.lastUpdated || new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error in CV process status API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get CV processing status." },
      { status: 500 }
    );
  }
} 