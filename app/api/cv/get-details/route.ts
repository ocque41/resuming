import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    // Fetch the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    if (cvRecord.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error retrieving CV details:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 