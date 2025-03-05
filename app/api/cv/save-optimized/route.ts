import { NextResponse } from "next/server";
import { getUser } from "@/lib/db/queries.server";
import { extractTextFromPdf } from "@/lib/storage";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const originalCvName = formData.get("originalCv") as string;
    const template = formData.get("template") as string;

    if (!file || !originalCvName) {
      return NextResponse.json(
        { error: "File and original CV name are required" },
        { status: 400 }
      );
    }

    // Get the original CV to retrieve any existing metadata
    const originalCVs = await db.select().from(cvs).where(
      and(
        eq(cvs.userId, user.id),
        eq(cvs.fileName, originalCvName)
      )
    ).limit(1);
    
    const originalCV = originalCVs.length > 0 ? originalCVs[0] : null;

    if (!originalCV) {
      return NextResponse.json(
        { error: "Original CV not found" },
        { status: 404 }
      );
    }

    // Read file content as text
    const fileContent = await file.text();

    // Create a new CV record for the optimized version
    let metadata;
    try {
      metadata = originalCV.metadata ? JSON.parse(originalCV.metadata) : {};
    } catch (error) {
      console.error("Error parsing original metadata:", error);
      metadata = {};
    }

    // Update metadata
    metadata = {
      ...metadata,
      optimized: true,
      optimizedTimes: (metadata.optimizedTimes || 0) + 1,
      optimizedAt: new Date().toISOString(),
      template: template,
      originalCvId: originalCV.id,
    };

    // Store the optimized CV in the database
    const [savedCV] = await db.insert(cvs).values({
      userId: user.id,
      fileName: file.name,
      filepath: `${user.id}/${file.name}`,
      rawText: fileContent,
      metadata: JSON.stringify(metadata),
    }).returning();

    return NextResponse.json({ 
      success: true, 
      message: "Optimized CV saved successfully",
      cv: {
        id: savedCV.id,
        fileName: savedCV.fileName
      }
    });

  } catch (error) {
    console.error("Error saving optimized CV:", error);
    return NextResponse.json(
      { error: "Failed to save optimized CV" },
      { status: 500 }
    );
  }
} 