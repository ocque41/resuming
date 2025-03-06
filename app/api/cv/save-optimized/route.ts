import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { uploadBufferToStorage } from "@/lib/storage";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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
    // Authentication check
    const session = await getServerSession() as UserSession | null;
     
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Convert string ID to number for database operations
    const userId = parseInt(session.user.id, 10);
    
    if (isNaN(userId)) {
      console.error(`Invalid user ID: ${session.user.id}`);
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Parse JSON body
    const body = await request.json();
    
    // Validate required fields
    if (!body.originalCV || !body.optimizedText) {
      return NextResponse.json({ 
        error: "Missing required fields: originalCV and optimizedText are required" 
      }, { status: 400 });
    }
    
    // Get the original CV record
    const originalCV = await db.query.cvs.findFirst({
      where: eq(cvs.id, body.originalCV),
    });
    
    if (!originalCV) {
      return NextResponse.json({ 
        error: `Original CV not found: ${body.originalCV}` 
      }, { status: 404 });
    }
    
    // Verify the CV belongs to the authenticated user
    if (originalCV.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${originalCV.id} belonging to user ${originalCV.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }
    
    console.log(`Processing optimized CV for original CV: ${originalCV.id} (${originalCV.fileName})`);
    
    // Create a textual file from the optimized content
    const textBlob = Buffer.from(body.optimizedText);
    
    // Create a filename for the optimized version
    const fileNameParts = originalCV.fileName.split('.');
    const extension = fileNameParts.pop() || 'pdf';
    const baseName = fileNameParts.join('.');
    const optimizedFileName = `${baseName}-optimized.${extension}`;
    
    // Generate a timestamp for the filepath
    const timestamp = Date.now();
    const filepath = `${userId}/${timestamp}-${optimizedFileName}`;
    
    console.log(`Saving optimized CV as: ${filepath}`);
    
    // Upload the optimized CV to storage
    const uploadedFilePath = await uploadBufferToStorage(textBlob, filepath);
    
    if (!uploadedFilePath) {
      console.error(`Failed to upload optimized CV to storage`);
      return NextResponse.json({ 
        error: "Failed to upload optimized CV to storage" 
      }, { status: 500 });
    }
    
    console.log(`Successfully uploaded optimized CV to: ${uploadedFilePath}`);
    
    // Save the optimized CV to the database
    const result = await db.insert(cvs).values({
      userId: userId,
      fileName: optimizedFileName,
      filepath: uploadedFilePath, // Using the correct field name 'filepath', not 'filePath'
      rawText: body.optimizedText,
      metadata: JSON.stringify({
        optimizedAt: new Date().toISOString(),
        originalFileName: originalCV.fileName,
        originalId: originalCV.id,
        isOptimizedVersion: true,
      }),
    }).returning();
    
    if (!result || result.length === 0) {
      console.error("Failed to insert optimized CV record");
      return NextResponse.json({ 
        error: "Failed to save optimized CV record to database" 
      }, { status: 500 });
    }
    
    const newCVRecord = result[0];
    console.log(`Created new optimized CV record: ${newCVRecord.id}`);
    
    // Update the original CV to mark it as having an optimized version
    try {
      // Update metadata to include optimized version info
      const originalMetadata = originalCV.metadata ? JSON.parse(originalCV.metadata) : {};
      const updatedMetadata = {
        ...originalMetadata,
        hasOptimizedVersion: true,
        optimizedVersionId: newCVRecord.id,
        lastOptimizedAt: new Date().toISOString(),
      };
      
      const updateResult = await db.update(cvs)
        .set({
          metadata: JSON.stringify(updatedMetadata),
        })
        .where(eq(cvs.id, originalCV.id))
        .returning();
      
      if (!updateResult || updateResult.length === 0) {
        console.warn(`Failed to update original CV ${originalCV.id} with optimized version info`);
      } else {
        console.log(`Updated original CV ${originalCV.id} with optimized version info`);
      }
    } catch (updateError) {
      console.error(`Error updating original CV ${originalCV.id}:`, updateError);
      // Continue despite update error - the optimized CV is still saved
    }
    
    return NextResponse.json({
      success: true,
      message: "Optimized CV saved successfully",
      cv: {
        id: newCVRecord.id,
        fileName: optimizedFileName,
        filepath: uploadedFilePath,
        isOptimized: true,
        originalCV: {
          id: originalCV.id,
          fileName: originalCV.fileName,
        },
      }
    });
  } catch (error) {
    console.error("Error saving optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to save optimized CV: ${(error as Error).message}` 
    }, { status: 500 });
  }
} 