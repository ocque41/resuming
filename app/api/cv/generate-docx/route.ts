import { NextRequest, NextResponse } from 'next/server';
import { generateDocx } from '@/lib/docx/docxGenerator';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { cvId, optimizedText, metadata } = body;

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

    // Generate the DOCX file with metadata if available
    let docxBuffer: Buffer;
    try {
      // Sanitize and prepare metadata
      const safeMetadata = {
        title: `CV_${new Date().toISOString().split('T')[0]}`,
        author: user.name || 'CV Optimizer User',
        description: 'Optimized CV document',
        // Include only safe properties from metadata
        ...(metadata && typeof metadata === 'object' ? {
          atsScore: typeof metadata.atsScore === 'number' ? metadata.atsScore : undefined,
          improvedAtsScore: typeof metadata.improvedAtsScore === 'number' ? metadata.improvedAtsScore : undefined,
          industry: typeof metadata.industry === 'string' ? metadata.industry : undefined,
          experienceEntries: Array.isArray(metadata.experienceEntries) ? metadata.experienceEntries : undefined,
          improvements: Array.isArray(metadata.improvements) ? metadata.improvements : undefined
        } : {})
      };
      
      console.log(`Generating DOCX with ${cvText.length} characters of text`);
      docxBuffer = await generateDocx(cvText, safeMetadata);
      
      if (!Buffer.isBuffer(docxBuffer) || docxBuffer.length === 0) {
        throw new Error('Generated an empty document buffer');
      }
      
      console.log(`Successfully generated DOCX buffer of ${docxBuffer.length} bytes`);
    } catch (docError) {
      console.error('Error generating DOCX:', docError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate DOCX document',
          details: docError instanceof Error ? docError.message : 'Unknown error during document generation'
        },
        { status: 500 }
      );
    }

    // Convert buffer to base64 for response
    const base64Data = docxBuffer.toString('base64');

    // Return the base64 data
    return NextResponse.json({
      success: true,
      docxBase64: base64Data,
    });
  } catch (error) {
    console.error('Error handling DOCX generation request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
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