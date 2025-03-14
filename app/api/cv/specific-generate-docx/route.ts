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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Error parsing request body:', parseError instanceof Error ? parseError.message : String(parseError));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON'
      }, { status: 400 });
    }

    const { cvId, optimizedText, docxBase64, filename, jobDescription, jobTitle } = body || {};

    // Handle the case where client is sending a pre-generated DOCX
    if (docxBase64) {
      logger.info('Client provided pre-generated DOCX, creating download URL');
      
      try {
        // Create a download URL for the pre-generated DOCX
        const downloadUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;
        
        return NextResponse.json({
          success: true,
          downloadUrl
        });
      } catch (error) {
        logger.error('Error creating download URL:', error instanceof Error ? error.message : String(error));
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create download URL',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    if (!cvId) {
      logger.error('Missing cvId parameter in specific-generate-docx request');
      return NextResponse.json({ success: false, error: 'CV ID is required' }, { status: 400 });
    }

    let cvText = optimizedText;

    // If optimized text wasn't provided, fetch it from the database
    if (!cvText) {
      try {
        logger.info(`Fetching CV data for ID: ${cvId}`);
        // Get all CVs for the user
        const cvs = await getCVsForUser(user.id);
        
        // Find the specific CV by ID
        const cvRecord = cvs.find(cv => cv.id === parseInt(cvId));

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
        logger.info(`Successfully retrieved CV text for ID: ${cvId}`);
      } catch (dbError) {
        logger.error('Database error:', dbError instanceof Error ? dbError.message : String(dbError));
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CV data' },
          { status: 500 }
        );
      }
    }

    // Generate the DOCX file with timeout protection
    let docxBuffer;
    try {
      logger.info(`Generating DOCX for CV ID: ${cvId}`);
      
      // Create a promise that will reject after a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Document generation timed out after 30 seconds')), 30000);
      });
      
      // Create a promise for the document generation
      const generatePromise = generateSpecificDocx(cvText, jobTitle, jobDescription);
      
      // Race the promises
      docxBuffer = await Promise.race([generatePromise, timeoutPromise]) as Buffer;
      
      logger.info(`DOCX generation successful for CV ID: ${cvId}`);
    } catch (genError) {
      logger.error('Error generating DOCX:', genError instanceof Error ? genError.message : String(genError));
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate DOCX document',
          details: genError instanceof Error ? genError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Convert buffer to base64 for response
    const base64Data = docxBuffer.toString('base64');
    
    // Create a download URL
    const downloadUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Data}`;

    // Return the base64 data and download URL
    return NextResponse.json({
      success: true,
      docxBase64: base64Data,
      downloadUrl
    });
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
async function generateSpecificDocx(
  cvText: string, 
  jobTitle?: string, 
  jobDescription?: string
): Promise<Buffer> {
  if (!cvText) {
    throw new Error('CV text is required');
  }

  try {
    logger.info('Starting document generation process');
    
    // Parse the CV text into sections
    const sections = parseOptimizedText(cvText);
    
    // Define section order for processing
    const sectionOrder = [
      'Header',
      'PROFILE', 
      'SUMMARY',
      'ACHIEVEMENTS',
      'GOALS', 
      'CAREER GOALS',
      'LANGUAGES',
      'SKILLS', 
      'TECHNICAL SKILLS', 
      'PROFESSIONAL SKILLS',
      'EDUCATION',
      'EXPERIENCE'
    ];
    
    // Create document
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
        children: [
          // Title with job title if available
          new Paragraph({
            text: jobTitle ? `Optimized CV for ${jobTitle}` : 'Optimized CV',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              after: 200
            },
            alignment: AlignmentType.CENTER,
          }),
          
          // Add a horizontal line after header
          new Paragraph({
            children: [
              new TextRun({
                text: '',
                size: 16
              })
            ],
            border: {
              bottom: {
                color: 'B4916C',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 8
              }
            },
            spacing: {
              after: 300
            }
          }),
          
          // Add each section in the specified order
          ...sectionOrder.flatMap(sectionName => {
            const content = sections[sectionName];
            if (!content || (Array.isArray(content) && content.length === 0)) {
              return [];
            }
            
            const paragraphs = [];
            
            // Add section header (except for Header section)
            if (sectionName !== 'Header') {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionName.toUpperCase(),
                      size: 28,
                      bold: true,
                      color: 'B4916C'
                    })
                  ],
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  border: {
                    bottom: {
                      color: 'B4916C',
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 6
                    }
                  }
                })
              );
            }
            
            // Add section content
            if (typeof content === 'string') {
              // Split by lines and add each line as a paragraph
              const lines = content.split('\n').filter(line => line.trim());
              
              for (const line of lines) {
                // Check if line is a bullet point
                if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '• ',
                          bold: true,
                          color: 'B4916C'
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
            } else if (Array.isArray(content)) {
              // Add each item as a bullet point
              for (const item of content) {
                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '• ',
                        bold: true,
                        color: 'B4916C'
                      }),
                      new TextRun({
                        text: item
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
              }
            }
            
            return paragraphs;
          }),
          
          // Add footer with date
          new Paragraph({
            children: [
              new TextRun({
                text: `Optimized CV | ${new Date().toLocaleDateString()}`,
                size: 20,
                color: '666666'
              })
            ],
            spacing: {
              before: 400
            },
            alignment: AlignmentType.CENTER,
            border: {
              top: {
                color: 'B4916C',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          })
        ]
      }]
    });

    // Generate buffer with a try-catch to handle any errors
    try {
      logger.info('Packing document to buffer');
      const buffer = await Packer.toBuffer(doc);
      logger.info('Document successfully packed to buffer');
      return buffer;
    } catch (packError) {
      logger.error('Error packing document to buffer:', packError instanceof Error ? packError.message : String(packError));
      throw new Error(`Failed to pack document to buffer: ${packError instanceof Error ? packError.message : 'Unknown error'}`);
    }
  } catch (error) {
    logger.error('Error generating specific DOCX:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to generate specific DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse optimized text into sections
 */
function parseOptimizedText(text: string): Record<string, string | string[]> {
  const sections: Record<string, string | string[]> = {};
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim());
  
  // Define section patterns
  const sectionPatterns = [
    /^(PROFILE|SUMMARY):/i,
    /^(ACHIEVEMENTS|ACCOMPLISHMENTS):/i,
    /^(GOALS|CAREER GOALS):/i,
    /^(LANGUAGES|LANGUAGE PROFICIENCY):/i,
    /^(SKILLS|TECHNICAL SKILLS|PROFESSIONAL SKILLS):/i,
    /^(EDUCATION|ACADEMIC BACKGROUND):/i,
    /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY):/i,
    /^(REFERENCES):/i
  ];
  
  let currentSection = '';
  let sectionContent: string[] = [];
  
  // Process each line
  for (const line of lines) {
    // Check if this line is a section header
    let isSectionHeader = false;
    for (const pattern of sectionPatterns) {
      if (pattern.test(line)) {
        // If we were already processing a section, save it
        if (currentSection) {
          sections[currentSection] = sectionContent.join('\n');
        }
        
        // Start a new section
        currentSection = line.replace(/:/g, '').trim();
        sectionContent = [];
        isSectionHeader = true;
        break;
      }
    }
    
    // If not a section header, add to current section
    if (!isSectionHeader && currentSection) {
      sectionContent.push(line);
    } else if (!isSectionHeader && !currentSection) {
      // If no section has been identified yet, this is likely header information
      if (!sections['Header']) {
        sections['Header'] = line;
      } else {
        sections['Header'] += '\n' + line;
      }
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
  }
  
  return sections;
} 