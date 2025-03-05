// app/api/delete/[cvId]/route.ts

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs, deletedCvMetadata } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";

export async function DELETE(
  request: NextRequest,
  { params }: any  // Use "any" for context to avoid type conflicts.
): Promise<NextResponse> {
  const { cvId } = params;
  const cvIdNumber = Number(cvId);

  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const cvRecord = await db
    .select()
    .from(cvs)
    .where(eq(cvs.id, cvIdNumber))
    .then((rows) => rows[0]);

  if (!cvRecord) {
    return NextResponse.json({ message: "CV not found" }, { status: 404 });
  }

  if (cvRecord.userId !== session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    // Before deleting the CV record, preserve its metadata in a separate table
    await db.insert(deletedCvMetadata).values({
      originalCvId: cvRecord.id,
      userId: String(cvRecord.userId),
      fileName: cvRecord.fileName,
      metadata: cvRecord.metadata || null,
      rawText: cvRecord.rawText || null,
      deletedAt: new Date(),
    });

    // If a physical file exists, delete it from the filesystem
    if (cvRecord.filepath) {
      try {
        await fs.unlink(cvRecord.filepath);
      } catch (err) {
        console.error("Error deleting file from filesystem:", err);
        // Proceed even if file deletion fails
      }
    }

    // Now proceed to delete the CV record from the user's view
    await db.delete(cvs).where(eq(cvs.id, cvIdNumber));
    
    return NextResponse.json({ 
      message: "CV deleted successfully",
      metadataPreserved: true
    });
  } catch (error) {
    console.error("Error processing CV deletion:", error);
    return NextResponse.json(
      { message: "Error deleting CV" },
      { status: 500 }
    );
  }
}
