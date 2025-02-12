// app/api/delete/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";

export async function DELETE(
  request: Request,
  { params }: { params: { cvId: string } }
) {
  // Retrieve the session.
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Convert cvId from string to number since the id column is numeric.
  const cvIdNumber = Number(params.cvId);

  // Retrieve the CV record from the database.
  const cvRecord = await db
    .select()
    .from(cvs)
    .where(eq(cvs.id, cvIdNumber))
    .then((rows) => rows[0]);

  if (!cvRecord) {
    return NextResponse.json({ message: "CV not found" }, { status: 404 });
  }

  // Ensure the user owns this CV.
  if (cvRecord.userId !== session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  // Delete the file from the filesystem if a filePath exists.
  if (cvRecord.filePath) {
    try {
      await fs.unlink(cvRecord.filePath);
    } catch (err) {
      console.error("Error deleting file from filesystem:", err);
      // Continue even if file deletion fails.
    }
  }

  // Delete the CV record from the database.
  try {
    await db.delete(cvs).where(eq(cvs.id, cvIdNumber));
    return NextResponse.json({ message: "CV deleted successfully" });
  } catch (error) {
    console.error("Error deleting CV from database:", error);
    return NextResponse.json(
      { message: "Error deleting CV from database" },
      { status: 500 }
    );
  }
}
