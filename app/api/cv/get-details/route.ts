import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    console.log(`Fetching CV details for ID: ${cvId}`);

    // Fetch the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      console.log(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // For analysis purposes, we don't need to verify ownership
    // This endpoint is specifically for retrieving document content for analysis

    // Parse the metadata if it exists
    let metadata = {};
    if (cvRecord.metadata) {
      try {
        metadata = typeof cvRecord.metadata === 'string' 
          ? JSON.parse(cvRecord.metadata) 
          : cvRecord.metadata;
      } catch (error) {
        console.error("Error parsing metadata:", error);
        metadata = { error: "Invalid metadata format" };
      }
    }

    // Create a response with the CV details and metadata
    const response = {
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      createdAt: cvRecord.createdAt,
      filePath: cvRecord.filepath,
      rawText: cvRecord.rawText || null,
      metadata
    };

    console.log(`Successfully retrieved CV details for ID: ${cvId}, filename: ${cvRecord.fileName}`);
    console.log(`Text content length: ${cvRecord.rawText ? cvRecord.rawText.length : 0} characters`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error retrieving CV details:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 