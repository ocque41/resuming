import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";
import { getServerSession } from "next-auth";
import { extractTextFromPDF } from "@/lib/textExtraction";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    // Check for authentication using headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const originalFileName = formData.get("originalFileName") as string;
    
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
    
    // Extract text from the PDF
    const rawText = await extractTextFromPDF(new Uint8Array(bytes));
    
    // Create a new CV record
    const [newCV] = await db.insert(cvs).values({
      userId: originalCV.userId, // Use the same user ID as the original CV
      fileName,
      filepath: `/uploads/${originalCV.userId}/${fileName}`,
      rawText,
      metadata: JSON.stringify({
        ...originalMetadata,
        isOptimizedVersion: true,
        originalFileName,
        optimizedAt: new Date().toISOString()
      })
    }).returning();
    
    return NextResponse.json({ 
      success: true, 
      message: "Optimized CV saved successfully",
      cv: newCV
    });
  } catch (error: any) {
    console.error("Error saving optimized CV:", error);
    return NextResponse.json({ 
      error: `Failed to save optimized CV: ${error.message}` 
    }, { status: 500 });
  }
} 