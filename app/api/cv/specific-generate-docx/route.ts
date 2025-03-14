import { NextRequest, NextResponse } from 'next/server';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { logger } from '@/lib/logger';

/**
 * Specific API endpoint for generating DOCX files from optimized CV text
 * in the specific optimization workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to specific-generate-docx');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body with validation
    let body;
    try {
      body = await request.json();
      
      // Validate required fields
      if (!body.cvId) {
        logger.error('Missing cvId in request body');
        return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
      }
      
      // Validate cvId format
      if (typeof body.cvId !== 'string' && typeof body.cvId !== 'number') {
        logger.error('Invalid cvId format:', typeof body.cvId);
        return NextResponse.json({ success: false, error: 'Invalid CV ID format' }, { status: 400 });
      }
    } catch (parseError) {
      logger.error('Error parsing request body:', parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
      }, { status: 400 });
    }

    const { cvId, optimizedText } = body;

    let cvText = optimizedText;

    // If optimized text wasn't provided, fetch it from the database
    if (!cvText) {
      try {
        // Get all CVs for the user
        const cvs = await getCVsForUser(user.id);
        
        // Find the specific CV by ID
        const cvRecord = cvs.find(cv => cv.id === parseInt(String(cvId)));

        if (!cvRecord) {
          logger.error(`CV not found for ID: ${cvId}`);
          return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
        }

        // Use rawText since optimizedText doesn't exist in the schema
        if (!cvRecord.rawText) {
          logger.error(`No text available for CV ID: ${cvId}`);
          return NextResponse.json(
            { success: false, error: 'No text available for this CV' },
            { status: 400 }
          );
        }

        cvText = cvRecord.rawText;
      } catch (dbError) {
        logger.error('Database error:', dbError instanceof Error ? dbError.message : String(dbError));
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CV data' },
          { status: 500 }
        );
      }
    }

    // Validate CV text
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      logger.error('Invalid or empty CV text');
      return NextResponse.json(
        { success: false, error: 'Invalid or empty CV text' },
        { status: 400 }
      );
    }

    // Generate the DOCX file with retries
    let docxBuffer;
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Generating DOCX for CV ID: ${cvId} (Attempt ${attempt}/${maxRetries})`);
        docxBuffer = await generateSpecificDocx(cvText);
        logger.info(`DOCX generation successful for CV ID: ${cvId} on attempt ${attempt}`);
        break;
      } catch (genError) {
        lastError = genError;
        logger.warn(`DOCX generation attempt ${attempt} failed:`, genError instanceof Error ? genError.message : String(genError));
        
        if (attempt === maxRetries) {
          logger.error('All DOCX generation attempts failed');
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to generate DOCX document after multiple attempts',
              details: genError instanceof Error ? genError.message : 'Unknown error'
            },
            { status: 500 }
          );
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    if (!docxBuffer) {
      logger.error('DOCX generation failed to produce buffer');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate DOCX document',
          details: lastError instanceof Error ? lastError.message : 'No buffer produced'
        },
        { status: 500 }
      );
    }

    // Convert buffer to base64 with validation
    try {
      const base64Data = docxBuffer.toString('base64');
      
      if (!base64Data) {
        throw new Error('Failed to convert buffer to base64');
      }
      
      // Return the base64 data
      return NextResponse.json({
        success: true,
        docxBase64: base64Data,
      });
    } catch (base64Error) {
      logger.error('Error converting DOCX to base64:', base64Error instanceof Error ? base64Error.message : String(base64Error));
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to convert DOCX to base64',
          details: base64Error instanceof Error ? base64Error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in specific-generate-docx:', error instanceof Error ? error.message : String(error));
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
 * Generate a DOCX document from CV text specifically for the specific optimization workflow
 */
async function generateSpecificDocx(cvText: string): Promise<Buffer> {
  if (!cvText) {
    throw new Error('CV text is required');
  }

  try {
    // Parse the CV text into sections with validation
    const sections = parseOptimizedText(cvText);
    
    // Validate parsed sections
    if (!sections || Object.keys(sections).length === 0) {
      throw new Error('Failed to parse CV sections');
    }
    
    // Create document with error handling
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000
            }
          }
        },
        children: createDocumentContent(sections)
      }]
    });

    // Generate buffer with timeout
    const bufferPromise = Packer.toBuffer(doc);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Document generation timed out')), 30000)
    );
    
    const buffer = await Promise.race([bufferPromise, timeoutPromise]) as Buffer;
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated document is empty');
    }
    
    return buffer;
  } catch (error) {
    logger.error('Error generating specific DOCX:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate specific DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse optimized text into sections with validation
 */
function parseOptimizedText(text: string): Record<string, string> {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input text');
  }

  try {
    const sections: Record<string, string> = {};
    
    // Define section patterns with validation
    const sectionPatterns: Record<string, RegExp> = {
      profile: /(?:profile|summary|objective)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      experience: /(?:experience|work history|employment)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      education: /(?:education|academic|qualifications)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      skills: /(?:skills|expertise|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      languages: /(?:languages|language proficiency)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      achievements: /(?:achievements|accomplishments)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      references: /(?:references)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
    };
    
    // Find header section (everything before first section)
    const headerEndMatch = text.match(/\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:/);
    
    if (headerEndMatch && headerEndMatch.index) {
      sections.header = text.substring(0, headerEndMatch.index).trim();
    } else {
      // If no section headers found, extract first 5 lines as header
      const lines = text.split('\n');
      sections.header = lines.slice(0, Math.min(5, lines.length)).join('\n').trim();
    }
    
    // Extract each section with validation
    for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
      const sectionMatch = text.match(new RegExp(
        `\\b${pattern.source.replace(/\\b/g, '')}\\b.*?\\n(.*?)(?=\\n\\s*\\b(${
          Object.values(sectionPatterns)
            .map(p => p.source.replace(/\\b/g, ''))
            .join('|')
        })\\b|$)`,
        'is'
      ));
      
      if (sectionMatch && sectionMatch[1]) {
        const content = sectionMatch[1].trim();
        if (content) {
          sections[sectionName] = content;
        }
      }
    }
    
    // Validate that we have at least some sections
    if (Object.keys(sections).length === 0) {
      throw new Error('No sections found in CV text');
    }
    
    return sections;
  } catch (error) {
    logger.error('Error parsing CV sections:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create document content from sections
 */
function createDocumentContent(sections: Record<string, string>): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const brandColor = 'B4916C';
  
  try {
    // Process each section in a specific order
    const sectionOrder = [
      'header',
      'profile',
      'experience',
      'education',
      'skills',
      'languages',
      'achievements',
      'references'
    ];
    
    for (const sectionName of sectionOrder) {
      const content = sections[sectionName];
      if (!content) continue;
      
      // Add section header (except for header section)
      if (sectionName !== 'header') {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: sectionName.toUpperCase(),
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          })
        );
      }
      
      // Add section content
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Check if line is a bullet point
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '• ',
                  bold: true,
                  color: brandColor
                }),
                new TextRun({
                  text: line.replace(/^[•\-*]\s*/, '')
                })
              ],
              spacing: {
                before: 120,
                after: 120
              },
              indent: {
                left: 360
              }
            })
          );
        } else {
          paragraphs.push(
            new Paragraph({
              text: line,
              spacing: {
                before: 120,
                after: 120
              }
            })
          );
        }
      }
    }
    
    return paragraphs;
  } catch (error) {
    logger.error('Error creating document content:', error instanceof Error ? error.message : String(error));
    throw error;
  }
} 