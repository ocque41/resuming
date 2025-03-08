import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCV, optimizeCVWithAnalysis } from "@/lib/optimizeCV";
import { optimizeCVBackground } from "@/lib/optimizeCVBackground";
import { getSession } from "@/lib/auth/session";
import { CV_TEMPLATES } from "@/types/templates";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export async function GET(request: Request) {
  return NextResponse.json({ message: "Use POST to optimize a CV" });
}

export async function POST(request: Request) {
  try {
    // Authentication check using the app's custom auth system
    const session = await getSession();
      
    if (!session || !session.user) {
      console.log("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`Processing optimization request for user: ${userId}`);

    const body = await request.json();
    const { fileName, cvId, templateId, forceReoptimize } = body;

    console.log(`Optimization request details: fileName=${fileName}, cvId=${cvId}, templateId=${templateId}, forceReoptimize=${forceReoptimize}`);

    if (!fileName && !cvId) {
      return NextResponse.json({ error: "Missing fileName or cvId parameter" }, { status: 400 });
    }

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId parameter" }, { status: 400 });
    }

    // Get CV record either by ID or fileName
    let cvRecord = null;
    
    if (cvId) {
      console.log(`Looking up CV with ID: ${cvId}`);
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId)),
      });
    } else {
      console.log(`Looking up CV with fileName: ${fileName}`);
      cvRecord = await getCVByFileName(fileName!);
    }
    
    if (!cvRecord) {
      const errorMessage = cvId 
        ? `CV not found with ID: ${cvId}` 
        : `CV not found with fileName: ${fileName}`;
      console.error(errorMessage);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    console.log(`Found CV record: id=${cvRecord.id}, userId=${cvRecord.userId}, fileName=${cvRecord.fileName}`);

    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }

    // Parse metadata with error handling
    let metadata = null;
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    } catch (error) {
      console.error(`Error parsing metadata for CV ${cvRecord.id}:`, error);
      metadata = null;
    }

    if (!metadata || !metadata.atsScore) {
      console.log(`CV ${cvRecord.id} has not been analyzed yet or has invalid metadata`);
      return NextResponse.json({ error: "CV has not been analyzed yet." }, { status: 400 });
    }

    // If forceReoptimize is true, reset optimization state
    if (forceReoptimize && metadata) {
      console.log(`Force re-optimization requested for CV ${cvRecord.id}`);
      // Reset optimization state
      const resetMetadata = {
        ...metadata,
        optimizing: false,
        optimized: false,
        progress: 0,
        error: null,
        stalledDetected: false,
        progressStalled: false
      };
      await updateCVAnalysis(cvRecord.id, JSON.stringify(resetMetadata));
    }

    // Use the new background optimization that uses analysis data
    try {
      console.log(`Starting background optimization for CV ${cvRecord.id} with template ${templateId}`);
      // Start optimization in background
      optimizeCVBackground(cvRecord, templateId);
      
      // Return success immediately - optimization continues in background
      return NextResponse.json({ 
        message: "CV optimization started", 
        cvId: cvRecord.id,
        fileName: cvRecord.fileName,
        status: "optimizing"
      });
    } catch (error) {
      console.error("Failed to start CV optimization:", error);
      return NextResponse.json({ error: "Failed to start CV optimization" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in CV optimization API route:", error.message);
    return NextResponse.json(
      { error: `CV optimization failed: ${error.message}` },
      { status: 500 }
    );
  }
}
