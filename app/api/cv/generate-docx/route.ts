import { NextRequest, NextResponse } from "next/server";
// Import from our mock implementations
import { auth, currentUser } from "@/lib/mock-auth";
import { db } from "@/lib/mock-db";
import { cv } from "@/lib/mock-schema";
import { eq } from "drizzle-orm";
import { formatError } from "@/lib/utils";
import { generateDocx } from "@/lib/docx";
import { standardizeCV } from "@/lib/cv-formatter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId, rawText } = body;
    
    let cvText = '';
    let cvRecord = null;
    
    if (cvId) {
      // Fetch CV from database
      cvRecord = await db.query.cv.findFirst({
        where: eq(cv.id, cvId),
      });
      
      if (!cvRecord) {
        return NextResponse.json(
          { error: "CV not found" },
          { status: 404 }
        );
      }
      
      if (cvRecord.userId !== userId) {
        return NextResponse.json(
          { error: "Unauthorized: CV does not belong to this user" },
          { status: 403 }
        );
      }
      
      // Use optimized text if available (for accepted optimizations),
      // otherwise use original text
      if (cvRecord.optimizedText && cvRecord.isOptimizationAccepted) {
        cvText = cvRecord.optimizedText;
      } else if (cvRecord.rawText) {
        cvText = cvRecord.rawText;
      } else {
        return NextResponse.json(
          { error: "No CV text available for DOCX generation" },
          { status: 400 }
        );
      }
    } else if (rawText) {
      // Use provided raw text
      cvText = rawText;
    } else {
      return NextResponse.json(
        { error: "Either cvId or rawText must be provided" },
        { status: 400 }
      );
    }
    
    // Standardize the CV structure if needed (for raw text)
    let standardizedText = cvText;
    if (!cvRecord?.optimizedText || !cvRecord?.isOptimizationAccepted) {
      standardizedText = standardizeCV(cvText);
    }
    
    // Generate DOCX from the standardized CV
    const docxBuffer = await generateDocx(standardizedText);
    
    // Encode as base64 for the response
    const docxBase64 = docxBuffer.toString('base64');
    
    return NextResponse.json({
      success: true,
      docxBase64
    });
  } catch (error) {
    console.error("Error generating CV DOCX:", error);
    return NextResponse.json(
      { error: formatError(error) },
      { status: 500 }
    );
  }
} 