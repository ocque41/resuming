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
      // Validate and sanitize metadata to prevent file corruption
      const safeMetadata = sanitizeMetadata(metadata || {});
      
      // Generate the DOCX file with the sanitized metadata
      console.log(`Generating DOCX with ${cvText.length} characters of text`);
      docxBuffer = await generateDocx(cvText, safeMetadata);
      
      // Verify that the buffer is valid
      if (!Buffer.isBuffer(docxBuffer) || docxBuffer.length === 0) {
        throw new Error('Generated an empty DOCX buffer');
      }
      
      console.log(`Successfully generated DOCX buffer of ${docxBuffer.length} bytes`);
    } catch (genError) {
      console.error('Error generating DOCX:', genError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate document', details: genError instanceof Error ? genError.message : String(genError) },
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

/**
 * Sanitizes metadata object to prevent issues with DOCX generation
 */
function sanitizeMetadata(metadata: any): any {
  // Create a new sanitized object
  const sanitized: Record<string, any> = {};
  
  // Add only the properties we know are safe and expected
  if (metadata.atsScore !== undefined) {
    sanitized.atsScore = typeof metadata.atsScore === 'number' ? metadata.atsScore : parseInt(metadata.atsScore);
    if (isNaN(sanitized.atsScore)) sanitized.atsScore = 0;
  }
  
  if (metadata.improvedAtsScore !== undefined) {
    sanitized.improvedAtsScore = typeof metadata.improvedAtsScore === 'number' ? metadata.improvedAtsScore : parseInt(metadata.improvedAtsScore);
    if (isNaN(sanitized.improvedAtsScore)) sanitized.improvedAtsScore = 0;
  }
  
  if (metadata.industry) {
    sanitized.industry = String(metadata.industry).substring(0, 100); // Limit length
  }
  
  // Handle improvements array
  if (metadata.improvements && Array.isArray(metadata.improvements)) {
    sanitized.improvements = metadata.improvements
      .filter((item: unknown) => typeof item === 'string')
      .map((item: string) => String(item).substring(0, 500)) // Limit length
      .slice(0, 10); // Limit number
  } else {
    sanitized.improvements = [];
  }
  
  // Handle experience entries carefully
  if (metadata.experienceEntries && Array.isArray(metadata.experienceEntries)) {
    sanitized.experienceEntries = metadata.experienceEntries
      .filter((entry: unknown) => entry && typeof entry === 'object')
      .map((entry: Record<string, any>) => ({
        jobTitle: entry.jobTitle ? String(entry.jobTitle).substring(0, 100) : 'Position',
        company: entry.company ? String(entry.company).substring(0, 100) : 'Company',
        dateRange: entry.dateRange ? String(entry.dateRange).substring(0, 50) : '',
        location: entry.location ? String(entry.location).substring(0, 100) : undefined,
        responsibilities: Array.isArray(entry.responsibilities) 
          ? entry.responsibilities
              .filter((resp: unknown) => typeof resp === 'string')
              .map((resp: string) => String(resp).substring(0, 300))
              .slice(0, 15)
          : []
      }))
      .slice(0, 20); // Limit number of entries
  } else {
    sanitized.experienceEntries = [];
  }
  
  // Add document metadata
  sanitized.title = metadata.title || 'Optimized CV';
  sanitized.author = metadata.author || 'CV Optimizer';
  sanitized.description = 'ATS-optimized CV document';
  
  return sanitized;
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
    let docxBuffer: Buffer;
    try {
      // Apply metadata sanitization
      const safeMetadata = sanitizeMetadata(metadata || {});
      
      // Generate DOCX with clear logging
      console.log(`Generating DOCX for download: ${cvRecord.fileName}, text length: ${cvRecord.rawText.length}`);
      docxBuffer = await generateDocx(cvRecord.rawText, safeMetadata);
      
      if (!Buffer.isBuffer(docxBuffer) || docxBuffer.length === 0) {
        throw new Error('Generated an empty document buffer');
      }
      
      console.log(`Successfully generated DOCX for download with size: ${docxBuffer.length} bytes`);
    } catch (genError) {
      console.error('Error generating DOCX for download:', genError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate DOCX document', 
          details: genError instanceof Error ? genError.message : 'Document generation error'
        },
        { status: 500 }
      );
    }

    // Create a filename for the download - ensure it's sanitized
    const baseFilename = cvRecord.fileName 
      ? cvRecord.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')
      : 'cv';
    const downloadFilename = `${baseFilename}-optimized.docx`;

    // Set headers for proper file download
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    headers.set('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    headers.set('Content-Length', docxBuffer.length.toString());
    headers.set('Cache-Control', 'no-cache');

    // Return the DOCX file as a downloadable attachment with proper headers
    return new NextResponse(docxBuffer, { headers });
  } catch (error) {
    console.error('Error generating DOCX for download:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 