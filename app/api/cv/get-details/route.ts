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

    console.log(`Getting CV details for CV ID: ${cvId}`);

    // Fetch the CV record from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    if (!cvRecord) {
      console.log(`CV record not found for ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    console.log(`Found CV record: ${cvRecord.id}, ${cvRecord.fileName}`);

    // Check if the CV belongs to the authenticated user
    if (cvRecord.userId !== parseInt(session.user.id)) {
      console.log(`Unauthorized access: CV user ID ${cvRecord.userId} doesn't match session user ID ${session.user.id}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

    // Parse the metadata if it exists
    let metadata = {};
    
    if (cvRecord.metadata) {
      console.log(`Processing metadata of type: ${typeof cvRecord.metadata}`);
      
      try {
        // Check if metadata is a string and needs parsing
        if (typeof cvRecord.metadata === 'string') {
          try {
            // Try to parse as JSON
            metadata = JSON.parse(cvRecord.metadata);
            console.log("Successfully parsed metadata JSON string");
          } catch (parseError) {
            console.error("Failed to parse metadata as JSON:", parseError);
            // Store the raw string if we can't parse it
            metadata = { 
              raw: cvRecord.metadata.substring(0, 100) + "...", // Truncate for response
              error: "Invalid JSON format" 
            };
          }
        } 
        // Check if metadata is already an object
        else if (typeof cvRecord.metadata === 'object' && cvRecord.metadata !== null) {
          console.log("Metadata is already an object, using directly");
          metadata = cvRecord.metadata;
        } 
        // Handle other types (unlikely but being safe)
        else {
          console.log(`Unexpected metadata type: ${typeof cvRecord.metadata}`);
          metadata = { 
            type: typeof cvRecord.metadata, 
            error: "Unexpected metadata format" 
          };
        }
      } catch (error) {
        console.error("Error processing metadata:", error);
        metadata = { error: "Error processing metadata" };
      }
    } else {
      console.log("No metadata available for this CV");
    }

    // Create a response with the CV details and metadata
    const response = {
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      createdAt: cvRecord.createdAt,
      filePath: cvRecord.filepath || null,
      rawText: cvRecord.rawText || null,
      metadata
    };

    console.log("Returning CV details successfully");
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error retrieving CV details:", error);
    return NextResponse.json({ 
      error: "Server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 