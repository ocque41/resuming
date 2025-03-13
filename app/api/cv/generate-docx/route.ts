import { NextRequest, NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx/docxGenerator';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCachedDocument } from "@/lib/cache/documentCache";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { cvId, optimizedText } = body;

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    let cvText = optimizedText;

    // If optimized text wasn't provided, fetch it from the database
    if (!cvText) {
      try {
        // Get all CVs for the user
        const cvs = await getCVsForUser(user.id);
        
        // Find the specific CV by ID
        const cvRecord = cvs.find(cv => cv.id === parseInt(cvId));

        if (!cvRecord) {
          return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
        }

        // Use rawText since optimizedText doesn't exist in the schema
        if (!cvRecord.rawText) {
          return NextResponse.json(
            { success: false, error: 'No text available for this CV' },
            { status: 400 }
          );
        }

        cvText = cvRecord.rawText;
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CV data' },
          { status: 500 }
        );
      }
    }

    // Generate the DOCX file
    const docxBuffer = await generateDocx(cvText);

    // Convert buffer to base64 for response
    const base64Data = docxBuffer.toString('base64');

    // Return the base64 data
    return NextResponse.json({
      success: true,
      docxBase64: base64Data,
    });
  } catch (error) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const cvId = searchParams.get("cvId");
    const type = searchParams.get("type") || "general"; // "general" or "specific"

    if (!cvId) {
      return NextResponse.json({ error: "CV ID is required" }, { status: 400 });
    }

    // Get CV from database
    const cv = await prisma.cV.findUnique({
      where: {
        id: cvId,
        userId: session.user.id,
      },
    });

    if (!cv) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Get cached document if available
    const cachedDoc = await getCachedDocument(cvId, type);
    if (!cachedDoc) {
      return NextResponse.json({ error: "CV content not found in cache" }, { status: 404 });
    }

    // Generate DOCX
    const docxBuffer = await generateDocx(cachedDoc.content, {
      title: cv.name,
      author: session.user.name || "CV Owner",
      description: `Optimized CV - ${type === "specific" ? "Job-Specific" : "General"} Version`,
    });

    // Set response headers
    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", `attachment; filename="${cv.name.replace(/[^a-zA-Z0-9]/g, "_")}_${type}_optimized.docx"`);

    // Return the DOCX file
    return new NextResponse(docxBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error("Error generating DOCX:", error);
    return NextResponse.json(
      { error: "Failed to generate DOCX" },
      { status: 500 }
    );
  }
} 