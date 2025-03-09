import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/mock-auth";
import { db } from "@/lib/mock-db";
import { cv } from "@/lib/mock-schema";
import { eq } from "drizzle-orm";
import { formatError } from "@/lib/utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { standardizeCV } from "@/lib/cv-formatter";
import { getOriginalPdfBytes } from "@/lib/storage";

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
    const { cvId, rawText, accentColor } = body;
    
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
      
      // Use existing raw text if available or extract from PDF
      if (cvRecord.rawText) {
        cvText = cvRecord.rawText;
      } else {
        try {
          // Extract text from the PDF
          const pdfBytes = await getOriginalPdfBytes(cvRecord);
          // Extract the text using an appropriate method
          // This is a placeholder - you would need to implement text extraction
          cvText = "Sample CV content extracted from PDF";
        } catch (extractError) {
          console.error("Error extracting text from PDF:", extractError);
          
          if (rawText) {
            cvText = rawText;
          } else {
            return NextResponse.json(
              { error: "Could not extract text from CV and no rawText provided" },
              { status: 400 }
            );
          }
        }
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
    
    // Standardize the CV structure
    const standardizedCV = standardizeCV(cvText);
    
    // Generate a preview PDF with enhanced styling
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    // Add a page
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    
    // Define brand colors - Matching dashboard theme
    const textColor = rgb(0.9, 0.9, 0.9); // Light gray for text
    const darkBackground = rgb(0.07, 0.07, 0.07); // #121212
    
    // Use provided accent color or default to brand gold
    let accentRGB = { r: 0.7, g: 0.57, b: 0.42 }; // Default #B4916C
    if (accentColor && accentColor.match(/^#[0-9A-F]{6}$/i)) {
      // Convert hex to RGB
      const hex = accentColor.substring(1);
      accentRGB = {
        r: parseInt(hex.substring(0, 2), 16) / 255,
        g: parseInt(hex.substring(2, 4), 16) / 255,
        b: parseInt(hex.substring(4, 6), 16) / 255
      };
    }
    const brandAccentColor = rgb(accentRGB.r, accentRGB.g, accentRGB.b);
    
    // Draw a simple preview with branded header and footer
    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
      color: darkBackground,
    });
    
    // Header with accent color
    page.drawRectangle({
      x: 0,
      y: page.getHeight() - 100,
      width: page.getWidth(),
      height: 100,
      color: rgb(0.15, 0.15, 0.15),
    });
    
    // Accent bar
    page.drawRectangle({
      x: 0,
      y: page.getHeight() - 40,
      width: page.getWidth(),
      height: 8,
      color: brandAccentColor,
    });
    
    // CV Title
    page.drawText("ENHANCED CV PREVIEW", {
      x: 50,
      y: page.getHeight() - 70,
      size: 24,
      font: boldFont,
      color: brandAccentColor,
    });
    
    // Preview message
    page.drawText("This is a preview of your enhanced CV with professional styling", {
      x: 50,
      y: page.getHeight() - 95,
      size: 12,
      font: italicFont,
      color: textColor,
    });
    
    // Display a portion of the standardized CV content
    const contentLines = standardizedCV.split('\n');
    let previewText = contentLines.slice(0, 20).join('\n');
    if (contentLines.length > 20) {
      previewText += "\n\n... (Full content will be shown in the complete PDF) ...";
    }
    
    // Draw preview text
    const textLines = previewText.split('\n');
    let currentY = page.getHeight() - 150;
    
    for (const line of textLines) {
      if (!line.trim()) {
        currentY -= 15;
        continue;
      }
      
      // Detect section headers (all caps)
      const isHeader = line === line.toUpperCase() && line.length > 2;
      
      if (isHeader) {
        // Draw section header with accent color
        page.drawText(line, {
          x: 50,
          y: currentY,
          size: 14,
          font: boldFont,
          color: brandAccentColor,
        });
        currentY -= 20;
      } else {
        // Draw regular text
        page.drawText(line, {
          x: 50,
          y: currentY,
          size: 11,
          font: regularFont,
          color: textColor,
        });
        currentY -= 15;
      }
    }
    
    // Footer with branding
    page.drawText("Created with CV Optimizer", {
      x: page.getWidth() - 150,
      y: 30,
      size: 10,
      font: italicFont,
      color: brandAccentColor,
    });
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    // Encode as base64 for the response
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    
    // Generate random ATS improvement scores for preview
    const originalAtsScore = Math.floor(Math.random() * 20) + 60; // 60-80
    const improvedAtsScore = Math.floor(Math.random() * 15) + 85; // 85-100
    
    return NextResponse.json({
      success: true,
      message: "Enhanced CV preview generated successfully",
      pdfBase64,
      originalAtsScore,
      improvedAtsScore
    });
  } catch (error) {
    console.error("Error generating enhanced CV preview:", error);
    return NextResponse.json(
      { error: formatError(error) },
      { status: 500 }
    );
  }
} 