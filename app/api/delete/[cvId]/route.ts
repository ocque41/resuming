// app/api/delete/[cvId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";

interface Context {
  params: {
    cvId: string;
  };
}

export async function DELETE(
  request: NextRequest,
  context: Context
): Promise<NextResponse> {
  const { cvId } = context.params;
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

  if (cvRecord.filePath) {
    try {
      await fs.unlink(cvRecord.filePath);
    } catch (err) {
      console.error("Error deleting file from filesystem:", err);
    }
  }

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
