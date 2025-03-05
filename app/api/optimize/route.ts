import { NextRequest, NextResponse } from "next/server";
import { optimizeCV } from "@/lib/optimizeCV";
import { getTemplateLayout } from "@/lib/templateMatching";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { cvText, templateId } = body;
    
    // Validate input
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      return NextResponse.json(
        { error: "CV text is required" },
        { status: 400 }
      );
    }
    
    console.log(`Processing CV optimization request with template ID: ${templateId || 'none'}`);
    
    // Get the template if a templateId was provided
    let template = undefined;
    if (templateId) {
      template = getTemplateById(templateId);
      if (!template) {
        console.warn(`Template with ID ${templateId} not found, using default`);
      } else {
        console.log(`Using template: ${template.name}`);
      }
    }
    
    // Optimize the CV text
    const { optimizedText, error } = await optimizeCV(cvText, template);
    
    // If there was an error during optimization, log it but continue with the original text
    if (error) {
      console.error("Error during CV optimization:", error);
    }
    
    // Generate the PDF with the optimized content
    let pdfBytes;
    try {
      console.log("Generating PDF with optimized content");
      pdfBytes = await modifyPDFWithOptimizedContent(optimizedText, cvText, template);
    } catch (pdfError: any) {
      console.error("Error generating PDF:", pdfError.message);
      return NextResponse.json(
        { error: `Failed to generate PDF: ${pdfError.message}` },
        { status: 500 }
      );
    }
    
    // Return the optimized text and PDF as base64
    return NextResponse.json({
      optimizedText,
      pdfBase64: Buffer.from(pdfBytes).toString('base64')
    });
  } catch (error: any) {
    console.error("Error in CV optimization API route:", error.message);
    return NextResponse.json(
      { error: `CV optimization failed: ${error.message}` },
      { status: 500 }
    );
  }
} 