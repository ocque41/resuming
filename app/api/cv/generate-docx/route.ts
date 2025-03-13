import { NextRequest, NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx/docxGenerator';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCachedDocument } from "@/lib/cache/documentCache";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { cvId, optimizedText, type = 'general' } = body;

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    let cvText = optimizedText;

    // If optimized text wasn't provided, fetch it from the cache
    if (!cvText) {
      try {
        // Get cached document
        const cachedDoc = await getCachedDocument(cvId, type);
        
        if (!cachedDoc) {
          // Fallback to getting from database
          const cv = await prisma.cv.findUnique({
            where: { id: cvId }
          });

          if (!cv) {
            return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
          }

          cvText = cv.content;
        } else {
          cvText = cachedDoc.content;
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CV data' },
          { status: 500 }
        );
      }
    }

    // Generate the DOCX file
    const docxBuffer = await generateDocx(cvText, {
      title: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'}`,
      author: user.name || "CV Owner",
      description: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'} Version`,
    });

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
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const cvId = searchParams.get("cvId");
    const type = searchParams.get("type") || "general"; // "general" or "specific"

    if (!cvId) {
      return NextResponse.json({ error: "CV ID is required" }, { status: 400 });
    }

    // Get cached document if available
    const cachedDoc = await getCachedDocument(cvId, type as 'general' | 'specific');
    if (!cachedDoc) {
      // Fallback to getting from database
      const cv = await prisma.cv.findUnique({
        where: { id: cvId }
      });

      if (!cv) {
        return NextResponse.json({ error: "CV not found" }, { status: 404 });
      }

      // Generate DOCX from raw text
      const docxBuffer = await generateDocx(cv.content, {
        title: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'}`,
        author: user.name || "CV Owner",
        description: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'} Version`,
      });

      // Set response headers
      const headers = new Headers();
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      headers.set("Content-Disposition", `attachment; filename="cv_${type}_optimized.docx"`);

      // Return the DOCX file
      return new NextResponse(docxBuffer, {
        status: 200,
        headers,
      });
    }

    // Generate DOCX from cached content
    const docxBuffer = await generateDocx(cachedDoc.content, {
      title: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'}`,
      author: user.name || "CV Owner",
      description: `Optimized CV - ${type === 'specific' ? 'Job-Specific' : 'General'} Version`,
    });

    // Set response headers
    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", `attachment; filename="cv_${type}_optimized.docx"`);

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