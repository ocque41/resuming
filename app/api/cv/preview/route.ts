import { NextRequest, NextResponse } from "next/server";
// Import from our mock implementations
import { auth, currentUser } from "@/lib/mock-auth";
import { db } from "@/lib/mock-db";
import { cv } from "@/lib/mock-schema";
import { eq } from "drizzle-orm";
import { formatError } from "@/lib/utils";
import { generateDocx } from "@/lib/docx";
import { convertDocxToPdf } from "@/lib/pdf";
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
      
      // Use existing raw text if available
      if (cvRecord.rawText) {
        cvText = cvRecord.rawText;
      } else if (rawText) {
        cvText = rawText;
      } else {
        return NextResponse.json(
          { error: "No CV text available for preview" },
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
    
    // Generate random ATS improvement scores for preview
    // In a real implementation, these would be calculated based on actual analysis
    const originalAtsScore = Math.floor(Math.random() * 20) + 60; // 60-80
    const improvedAtsScore = Math.floor(Math.random() * 15) + 85; // 85-100
    
    // Standardize the CV structure
    const standardizedCV = standardizeCV(cvText);
    
    // Generate DOCX from the standardized CV
    const docxBuffer = await generateDocx(standardizedCV);
    
    // Convert DOCX to PDF
    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    
    // Encode as base64 for the response
    const docxBase64 = docxBuffer.toString('base64');
    const pdfBase64 = pdfBuffer.toString('base64');
    
    return NextResponse.json({
      success: true,
      originalAtsScore,
      improvedAtsScore,
      docxBase64,
      pdfBase64
    });
  } catch (error) {
    console.error("Error generating CV preview:", error);
    return NextResponse.json(
      { error: formatError(error) },
      { status: 500 }
    );
  }
} 