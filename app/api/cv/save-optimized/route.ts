import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { extractTextFromPDF } from "@/lib/textExtraction";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { getServerSession } from "next-auth";
import { uploadBufferToStorage } from "@/lib/storage";

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getServerSession() as UserSession | null;
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const originalFileName = formData.get("originalFileName") as string;
    const optimizedText = formData.get("optimizedText") as string;
    
    if (!file || !fileName || !originalFileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Get the original CV record to copy metadata
    const originalCV = await getCVByFileName(originalFileName);
    
    if (!originalCV) {
      return NextResponse.json({ error: "Original CV not found" }, { status: 404 });
    }
    
    // Extract metadata from original CV
    const originalMetadata = originalCV.metadata ? JSON.parse(originalCV.metadata) : {};
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 1. Upload to storage (Dropbox or other configured storage)
    console.log("Uploading optimized CV to storage...");
    const userId = session.user.id;
    const storagePath = `/uploads/${userId}/${fileName}`;
    
    try {
      await uploadBufferToStorage(buffer, storagePath);
      console.log("Successfully uploaded to storage:", storagePath);
    } catch (storageError) {
      console.error("Error uploading to storage:", storageError);
      return NextResponse.json({ 
        error: `Failed to upload to storage: ${(storageError as Error).message}` 
      }, { status: 500 });
    }
    
    // 2. Save to Neon Database
    console.log("Saving optimized CV to database...");
    
    // Create a new CV record
    try {
      const [newCV] = await db.insert(cvs).values({
        userId: originalCV.userId, // Use the same user ID as the original CV
        fileName,
        filepath: storagePath,
        rawText: optimizedText || "",
        metadata: JSON.stringify({
          ...originalMetadata,
          isOptimizedVersion: true,
          originalFileName,
          optimizedAt: new Date().toISOString(),
          optimized: true,
          optimizedFrom: originalCV.id
        })
      }).returning();
      
      console.log("Successfully saved to database:", newCV.id);
      
      return NextResponse.json({ 
        success: true, 
        message: "Optimized CV saved successfully to storage and database",
        cv: newCV
      });
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
      return NextResponse.json({ 
        error: `Failed to save to database: ${(dbError as Error).message}` 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error saving optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to save optimized CV: ${error.message}` 
    }, { status: 500 });
  }
} 