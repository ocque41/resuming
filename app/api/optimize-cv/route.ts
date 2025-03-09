import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCV, optimizeCVWithAnalysis } from "@/lib/optimizeCV.fixed";
import { optimizeCVBackground } from "@/lib/optimizeCVBackground";
import { getSession } from "@/lib/auth/session";
import { CV_TEMPLATES } from "@/types/templates";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiLogger } from "@/lib/logger";
import { createError, ErrorType, ErrorSeverity, handleError } from "@/lib/errorHandler";

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
      apiLogger.warn("Unauthorized: No valid session found");
      const error = createError(
        ErrorType.AUTHENTICATION,
        "Unauthorized: No valid session found",
        ErrorSeverity.HIGH
      );
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const userId = session.user.id;
    apiLogger.info(`Processing optimization request for user: ${userId}`, { userId });

    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      apiLogger.error("Failed to parse request body", parseError as Error, { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Invalid request body",
        ErrorSeverity.MEDIUM,
        parseError as Error
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { fileName, cvId, templateId, forceReoptimize } = body;

    apiLogger.debug(`Optimization request details`, { userId, fileName, cvId, templateId, forceReoptimize });

    // Validate required parameters
    if (!fileName && !cvId) {
      apiLogger.warn("Missing fileName or cvId parameter", { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Missing fileName or cvId parameter",
        ErrorSeverity.LOW
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!templateId) {
      apiLogger.warn("Missing templateId parameter", { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Missing templateId parameter",
        ErrorSeverity.LOW
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get CV record either by ID or fileName
    let cvRecord = null;
    
    try {
      if (cvId) {
        apiLogger.debug(`Looking up CV with ID: ${cvId}`, { userId, cvId });
        cvRecord = await db.query.cvs.findFirst({
          where: eq(cvs.id, parseInt(cvId)),
        });
      } else {
        apiLogger.debug(`Looking up CV with fileName: ${fileName}`, { userId, fileName });
        cvRecord = await getCVByFileName(fileName!);
      }
    } catch (lookupError) {
      apiLogger.error("Error looking up CV", lookupError as Error, { userId, cvId, fileName });
      const error = createError(
        ErrorType.SERVER,
        "Error looking up CV",
        ErrorSeverity.MEDIUM,
        lookupError as Error,
        { userId, cvId, fileName }
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!cvRecord) {
      const errorMessage = cvId 
        ? `CV not found with ID: ${cvId}` 
        : `CV not found with fileName: ${fileName}`;
      apiLogger.warn(errorMessage, { userId, cvId, fileName });
      const error = createError(
        ErrorType.NOT_FOUND,
        "CV not found",
        ErrorSeverity.LOW,
        undefined,
        { userId, cvId, fileName }
      );
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    apiLogger.info(`Found CV record: id=${cvRecord.id}, fileName=${cvRecord.fileName}`, { userId, cvId: cvRecord.id });

    // Verify ownership
    if (cvRecord.userId !== userId) {
      apiLogger.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`, new Error("Unauthorized access"), { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.AUTHORIZATION,
        "Unauthorized access to CV",
        ErrorSeverity.HIGH,
        undefined,
        { userId, cvId: cvRecord.id, ownerId: cvRecord.userId }
      );
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Parse metadata with error handling
    let metadata = null;
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    } catch (parseError) {
      apiLogger.error(`Error parsing metadata for CV ${cvRecord.id}`, parseError as Error, { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.VALIDATION,
        "Invalid CV metadata",
        ErrorSeverity.MEDIUM,
        parseError as Error,
        { userId, cvId: cvRecord.id }
      );
      // Continue with null metadata instead of returning an error
      metadata = null;
    }

    if (!metadata || !metadata.atsScore) {
      apiLogger.warn(`CV ${cvRecord.id} has not been analyzed yet or has invalid metadata`, { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.VALIDATION,
        "CV has not been analyzed yet",
        ErrorSeverity.LOW,
        undefined,
        { userId, cvId: cvRecord.id }
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If forceReoptimize is true, reset optimization state
    if (forceReoptimize && metadata) {
      apiLogger.info(`Force re-optimization requested for CV ${cvRecord.id}`, { userId, cvId: cvRecord.id });
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
      
      try {
        await updateCVAnalysis(cvRecord.id, JSON.stringify(resetMetadata));
      } catch (updateError) {
        apiLogger.error(`Failed to reset optimization state for CV ${cvRecord.id}`, updateError as Error, { userId, cvId: cvRecord.id });
        // Continue despite the error
      }
    }

    // Use the new background optimization that uses analysis data
    try {
      apiLogger.info(`Starting background optimization for CV ${cvRecord.id} with template ${templateId}`, { userId, cvId: cvRecord.id, templateId });
      // Start optimization in background
      optimizeCVBackground(cvRecord, templateId);
      
      // Return success immediately - optimization continues in background
      return NextResponse.json({ 
        message: "CV optimization started", 
        cvId: cvRecord.id,
        fileName: cvRecord.fileName,
        status: "optimizing"
      });
    } catch (optimizationError) {
      apiLogger.error("Failed to start CV optimization", optimizationError as Error, { userId, cvId: cvRecord.id });
      const error = createError(
        ErrorType.SERVER,
        "Failed to start CV optimization",
        ErrorSeverity.HIGH,
        optimizationError as Error,
        { userId, cvId: cvRecord.id }
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (error: any) {
    // Handle unexpected errors
    const handledError = await handleError(error, { route: "optimize-cv" });
    
    apiLogger.error("Unexpected error in CV optimization API route", error, { error: handledError.error });
    
    return NextResponse.json(
      { error: handledError.error?.message || "CV optimization failed" },
      { status: 500 }
    );
  }
}
