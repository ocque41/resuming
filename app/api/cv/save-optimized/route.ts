import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getServerSession } from "next-auth";
import { uploadBufferToStorage } from "@/lib/storage";
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
    
    // 1. Upload to Dropbox storage
    console.log("Uploading optimized CV to Dropbox...");
    const dropboxPath = `/pdfs/${fileName}`; // Use the pdfs folder for consistency
    
    try {
      // Upload the file to Dropbox
      const storagePath = await uploadBufferToStorage(buffer, dropboxPath);
      console.log("Successfully uploaded to Dropbox:", storagePath);
      
      // 2. Save to Neon Database using Drizzle ORM
      console.log("Saving optimized CV to Neon database...");
      
      // Create a new CV record with enhanced metadata
      const newCVMetadata = {
        ...originalMetadata,
        isOptimizedVersion: true,
        originalFileName,
        originalCVId: originalCV.id,
        optimizedAt: new Date().toISOString(),
        optimized: true,
        optimizedFrom: originalCV.id,
        optimizedBy: session.user.email || session.user.id,
        template: originalMetadata.selectedTemplate || "professional"
      };
      
      // Insert the new CV record
      const newCVs = await db.insert(cvs).values({
        userId: originalCV.userId,
        fileName: fileName,
        filepath: storagePath,
        rawText: optimizedText || "",
        metadata: JSON.stringify(newCVMetadata)
      }).returning();
      
      const newCV = newCVs[0];
      console.log("Successfully saved to Neon database:", newCV.id);
      
      // 3. Update the original CV record to link to the optimized version
      try {
        const updatedMetadata = {
          ...originalMetadata,
          hasOptimizedVersion: true,
          optimizedVersionId: newCV.id,
          lastOptimizedAt: new Date().toISOString()
        };
        
        // Update the CV analysis with the new metadata
        await db.update(cvs)
          .set({ metadata: JSON.stringify(updatedMetadata) })
          .where(eq(cvs.id, originalCV.id));
          
        console.log("Updated original CV record with optimized version link");
      } catch (updateError) {
        console.error("Error updating original CV record:", updateError);
        // Continue despite this error
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Optimized CV saved successfully to Dropbox and Neon database",
        cv: newCV
      });
    } catch (storageError) {
      console.error("Error in storage or database operations:", storageError);
      return NextResponse.json({ 
        error: `Failed to save optimized CV: ${(storageError as Error).message}` 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error saving optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to save optimized CV: ${error.message}` 
    }, { status: 500 });
  }
} 