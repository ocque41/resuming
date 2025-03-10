import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';
import { apiLogger } from '@/lib/logger';
import { createError, ErrorType, ErrorSeverity, handleError } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
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
    
    // Parse request body
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

    const { cvId, analysis } = body;

    // Validate required parameters
    if (!cvId) {
      apiLogger.warn("Missing cvId parameter", { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Missing cvId parameter",
        ErrorSeverity.LOW
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!analysis) {
      apiLogger.warn("Missing analysis data", { userId });
      const error = createError(
        ErrorType.VALIDATION,
        "Missing analysis data",
        ErrorSeverity.LOW
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId))
    });

    if (!cvRecord) {
      apiLogger.warn(`CV with ID ${cvId} not found`, { userId, cvId });
      const error = createError(
        ErrorType.NOT_FOUND,
        "CV not found",
        ErrorSeverity.MEDIUM
      );
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    // Convert userId to number for comparison if it's a string
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (cvRecord.userId !== userIdNum) {
      apiLogger.warn(`User ${userId} attempted to access CV ${cvId} belonging to user ${cvRecord.userId}`, { userId, cvId });
      const error = createError(
        ErrorType.AUTHORIZATION,
        "You do not have permission to update this CV",
        ErrorSeverity.HIGH
      );
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Merge with existing metadata if available
    let existingMetadata = {};
    if (cvRecord.metadata) {
      try {
        existingMetadata = JSON.parse(cvRecord.metadata);
      } catch (parseError) {
        apiLogger.error(`Error parsing existing metadata for CV ${cvId}`, parseError as Error, { userId, cvId });
        // Continue with empty metadata
      }
    }

    // Merge the new analysis with existing metadata
    const updatedMetadata = {
      ...existingMetadata,
      ...analysis,
      updatedAt: new Date().toISOString()
    };

    // Update the CV record
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, parseInt(cvId)));

    apiLogger.info(`Updated analysis for CV ${cvId}`, { userId, cvId });

    return NextResponse.json({
      message: "CV analysis updated successfully",
      cvId
    });
  } catch (error: any) {
    // Handle unexpected errors
    const handledError = await handleError(error, { route: "update-cv-analysis" });
    
    apiLogger.error("Unexpected error in update CV analysis API route", error, { error: handledError.error });
    
    return NextResponse.json(
      { error: handledError.error?.message || "Failed to update CV analysis" },
      { status: 500 }
    );
  }
} 