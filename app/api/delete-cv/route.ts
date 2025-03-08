import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs, deletedCvMetadata } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/db/queries.server";

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
    if (cvRecord.userId !== user.id) {
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

    // Delete the CV
    await db.delete(cvs).where(eq(cvs.id, parseInt(cvId)));
    console.log(`Successfully deleted CV ${cvRecord.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting CV:", error);
    return NextResponse.json(
      { error: "Failed to delete CV" },
      { status: 500 }
    );
  }
} 