import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * API endpoint to restart failed CV processing
 * This is used by the error recovery system to retry failed processing jobs
 */
export async function POST(request: Request) {
  console.log("CV processing restart API called");

  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      console.error("Unauthorized: No valid session found");
      return NextResponse.json(
        { error: "You must be logged in to restart CV processing." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`Restart request from user: ${userId}`);

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request format." },
        { status: 400 }
      );
    }

    const { cvId } = body;

    if (!cvId) {
      console.error("Missing CV ID in restart request");
      return NextResponse.json(
        { error: "Missing CV ID." },
        { status: 400 }
      );
    }

    console.log(`Processing restart request for CV ID: ${cvId}`);

    // Get CV record from database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId.toString())),
    });

    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found." }, { status: 404 });
    }

    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} tried to access CV ${cvId} belonging to user ${cvRecord.userId}`);
      return NextResponse.json(
        { error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }

    // Get the raw text
    if (!cvRecord.rawText) {
      console.error(`CV ${cvId} has no raw text content`);
      return NextResponse.json(
        { error: "CV text content is missing. Please re-upload the CV." },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }

    // Reset processing state
    metadata = {
      ...metadata,
      processing: true,
      processingStartTime: new Date().toISOString(),
      processingStatus: "Restarting CV analysis",
      processingProgress: 0,
      processingError: null,
      optimized: false,
      optimizing: true,
      retryCount: (metadata.retryCount || 0) + 1,
    };

    // Update CV record with reset state
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvRecord.id));

    // Import processCV dynamically to avoid circular dependencies
    const { processCV } = await import("../route");

    // Start processing in the background
    processCV(cvRecord.id, cvRecord.rawText, metadata);

    return NextResponse.json({
      message: "CV processing restarted successfully.",
      cvId: cvRecord.id,
      status: "processing",
    });
  } catch (error) {
    console.error("Error in CV processing restart API:", error);
    return NextResponse.json(
      { error: "Failed to restart CV processing." },
      { status: 500 }
    );
  }
} 