import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs, deletedCvMetadata, jobStatus, documentAnalyses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/db/queries.server";
import { deleteFileFromS3 } from "@/lib/s3Storage";

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the CV ID from the query parameter
    const cvId = request.nextUrl.searchParams.get('cvId');
    
    if (!cvId) {
      return NextResponse.json(
        { error: "Missing cvId parameter" },
        { status: 400 }
      );
    }
    
    console.log(`Attempting to delete CV with ID: ${cvId}`);
    
    // Get the CV record first to store metadata
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });

    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json(
        { error: "CV not found" },
        { status: 404 }
      );
    }

    console.log(`Found CV record: id=${cvRecord.id}, userId=${cvRecord.userId}, fileName=${cvRecord.fileName}`);

    // Check if the CV belongs to the user
    if (String(cvRecord.userId) !== String(user.id)) {
      console.error(`User ${user.id} attempted to delete CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Store metadata in deleted_cv_metadata table
    await db.insert(deletedCvMetadata).values({
      originalCvId: cvRecord.id,
      userId: user.id.toString(),
      fileName: cvRecord.fileName,
      metadata: cvRecord.metadata || null,
      rawText: cvRecord.rawText || null,
      deletedAt: new Date(),
    });

    console.log(`Stored metadata for deleted CV ${cvRecord.id} in deleted_cv_metadata table`);

    // Delete all related records in the correct order to handle foreign key constraints
    
    // 1. Delete related documentAnalyses records
    try {
      await db.delete(documentAnalyses).where(eq(documentAnalyses.cvId, parseInt(cvId)));
      console.log(`Deleted related document analyses for CV ${cvRecord.id}`);
    } catch (error) {
      console.error(`Error deleting document analyses for CV ${cvRecord.id}:`, error);
      return NextResponse.json(
        { error: "Failed to delete related document analyses" },
        { status: 500 }
      );
    }

    // 2. Delete related job_status records
    try {
      await db.delete(jobStatus).where(eq(jobStatus.cvId, parseInt(cvId)));
      console.log(`Deleted related job_status records for CV ${cvRecord.id}`);
    } catch (error) {
      console.error(`Error deleting related job_status records for CV ${cvRecord.id}:`, error);
      return NextResponse.json(
        { error: "Failed to delete related job status records" },
        { status: 500 }
      );
    }

    // 3. Delete the CV file from S3
    if (cvRecord.filepath) {
      try {
        await deleteFileFromS3(cvRecord.filepath);
        console.log(`Deleted CV file from S3: ${cvRecord.filepath}`);
      } catch (s3Error) {
        console.error(`Error deleting CV file from S3: ${cvRecord.filepath}:`, s3Error);
        // Continue with deletion even if S3 deletion fails
      }
    }
    
    // 4. Delete optimized DOCX file from S3 if it exists
    if (cvRecord.optimizedDocxPath) {
      try {
        await deleteFileFromS3(cvRecord.optimizedDocxPath);
        console.log(`Deleted optimized DOCX file from S3: ${cvRecord.optimizedDocxPath}`);
      } catch (s3Error) {
        console.error(`Error deleting optimized DOCX from S3: ${cvRecord.optimizedDocxPath}:`, s3Error);
        // Continue with deletion even if S3 deletion fails
      }
    }

    // 5. Finally delete the CV record from the database
    try {
      await db.delete(cvs).where(eq(cvs.id, parseInt(cvId)));
      console.log(`Successfully deleted CV ${cvRecord.id}`);
    } catch (error) {
      console.error(`Error deleting CV ${cvRecord.id}:`, error);
      return NextResponse.json(
        { error: "Failed to delete CV" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting CV:", error);
    return NextResponse.json(
      { error: "Failed to delete CV" },
      { status: 500 }
    );
  }
} 