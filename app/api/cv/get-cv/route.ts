import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      console.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      console.error("Missing cvId parameter");
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    console.log(`Processing get-cv request for CV ID: ${cvId}`);

    // Fetch the CV record from the database
    let cvRecord;
    try {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId)),
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        error: "Database error while fetching CV" 
      }, { status: 500 });
    }
    
    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

    // Get the file path
    const filePath = cvRecord.filePath || cvRecord.filepath; // Support both casing versions
    
    if (!filePath) {
      console.error(`No file path found for CV ${cvId}`);
      return NextResponse.json({ error: "CV file path not found" }, { status: 404 });
    }
    
    // For demonstration purposes, create a sample PDF buffer
    // In a real implementation, you would read the file from storage
    const samplePdfBuffer = Buffer.from(
      '%PDF-1.5\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj\n<</Type/Page/Parent 2 0 R/Resources 4 0 R/MediaBox[0 0 612 792]/Contents 6 0 R>>\nendobj\n4 0 obj\n<</Font<</F1 5 0 R>>>>\nendobj\n5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n6 0 obj\n<</Length 44>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Optimized CV) Tj\nET\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\n0000000250 00000 n\n0000000317 00000 n\ntrailer\n<</Size 7/Root 1 0 R>>\nstartxref\n406\n%%EOF'
    );

    // Return the PDF file
    return new NextResponse(samplePdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="optimized_${cvRecord.fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error retrieving CV:", error);
    return NextResponse.json({ 
      error: `Failed to retrieve CV: ${errorMessage}` 
    }, { status: 500 });
  }
} 