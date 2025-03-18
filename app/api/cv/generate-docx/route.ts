import { NextRequest, NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx/docxGenerator';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { DocumentGenerator } from '@/lib/utils/documentGenerator';
import { getServerSession } from 'next-auth';
import { auth } from '@/auth';

/**
 * Directly generates a DOCX file from optimized CV content
 * 
 * POST /api/cv/generate-docx
 */
export async function POST(request: Request) {
  try {
    // Validate user session
    const session = await getServerSession(auth);
    
    // Access user ID safely using optional chaining and type assertions
    // We know our auth setup has user.id but TypeScript might not recognize it
    // @ts-ignore - Suppress TypeScript error for session.user access
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Parse request body
    const data = await request.json();
    const { cvText, options = {}, metadata = {} } = data;
    
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      return NextResponse.json(
        { error: 'CV text is required' },
        { status: 400 }
      );
    }
    
    console.log(`Generating DOCX directly for user ${userId}, text length: ${cvText.length} characters`);
    console.log(`Using template: ${options.template || 'professional'}`);
    
    // Generate DOCX document with sanitized text and logging
    try {
      // Attempt to generate the document with input parameters
      const docBuffer = await DocumentGenerator.generateDocx(cvText, {
        ...metadata,
        title: metadata?.title || "Optimized CV",
        atsScore: metadata?.atsScore || 0,
        improvedAtsScore: metadata?.improvedAtsScore || 0,
        industry: metadata?.industry || "General",
        template: options?.template || "professional",
        experienceEntries: metadata?.experienceEntries || [],
        improvements: metadata?.improvements || []
      }, {
        templateStyle: options?.template || "professional",
        fontOptions: {
          preset: options?.fontPreset || "modern",
          headingFont: options?.headingFont,
          bodyFont: options?.bodyFont,
          nameFont: options?.nameFont
        },
        colorOptions: {
          primary: options?.primaryColor,
          accent: options?.accentColor
        }
      });
      
      // Verify document was generated successfully
      if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
        throw new Error("Failed to generate valid document buffer");
      }
      
      console.log(`Successfully generated DOCX with size: ${docBuffer.length} bytes`);
      
      // Convert buffer to base64 for response
      const base64Data = docBuffer.toString('base64');
      
      // Return the base64 data for client-side download
      return NextResponse.json({
        success: true,
        docxBase64: base64Data,
        fileName: `CV_${Date.now()}.docx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    } catch (docError) {
      console.error("Error generating document:", docError);
      return NextResponse.json(
        { 
          error: 'Failed to generate document',
          details: docError instanceof Error ? docError.message : 'Unknown error',
          canRetry: true
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

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
    
    // Extract metadata from CV record if available
    let metadata = null;
    if (cvRecord.metadata) {
      try {
        const parsedMetadata = JSON.parse(cvRecord.metadata);
        metadata = {
          atsScore: parsedMetadata.atsScore,
          improvedAtsScore: parsedMetadata.improvedAtsScore,
          improvements: parsedMetadata.improvements,
          experienceEntries: parsedMetadata.experienceEntries,
          industry: parsedMetadata.industry
        };
      } catch (error) {
        console.error('Failed to parse CV metadata:', error);
        // Continue without metadata
      }
    }

    // Generate the DOCX file with metadata if available
    const docxBuffer = await generateDocx(cvRecord.rawText, metadata || undefined);

    // Create a filename for the download
    const filename = cvRecord.fileName 
      ? `${cvRecord.fileName.replace(/\.[^/.]+$/, '')}-optimized.docx` 
      : 'optimized-cv.docx';

    // Return the DOCX file as a downloadable attachment
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
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