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
    
    // Log received parameters for debugging
    logger.info(`Received request with parameters: cvId=${cvId}, jobTitle=${jobTitle || 'not provided'}, optimizedText length=${optimizedText ? optimizedText.length : 'not provided'}, docxBase64=${docxBase64 ? 'provided' : 'not provided'}`);

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

    if (!cvId && !optimizedText) {
      logger.error('Missing required parameters in specific-generate-docx request');
      return NextResponse.json({ success: false, error: 'Either CV ID or optimized text is required' }, { status: 400 });
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
        logger.info(`Successfully retrieved CV text for ID: ${cvId}, text length: ${cvText.length}`);
      } catch (dbError) {
        logger.error('Database error:', dbError instanceof Error ? dbError.message : String(dbError), dbError);
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CV data' },
          { status: 500 }
        );
      }
    }

    // Validate CV text
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      logger.error('Invalid or empty CV text provided');
      return NextResponse.json(
        { success: false, error: 'Invalid or empty CV text provided' },
        { status: 400 }
      );
    }

    // Generate the DOCX file with timeout protection
    let docxBuffer;
    try {
      logger.info(`Generating DOCX for CV ID: ${cvId}, text length: ${cvText.length}`);
      
      // Create a promise that will reject after a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Document generation timed out after 60 seconds')), 60000); // Increased timeout to 60 seconds
      });
      
      // Create a promise for the document generation
      const generatePromise = generateSpecificDocx(cvText, jobTitle, jobDescription);
      
      // Race the promises
      docxBuffer = await Promise.race([generatePromise, timeoutPromise]) as Buffer;
      
      if (!docxBuffer || !(docxBuffer instanceof Buffer)) {
        throw new Error('Document generation failed: Invalid buffer returned');
      }
      
      logger.info(`DOCX generation successful for CV ID: ${cvId}, buffer size: ${docxBuffer.length} bytes`);
    } catch (genError) {
      logger.error('Error generating DOCX:', genError instanceof Error ? genError.message : String(genError), genError);
      
      // Create a simple fallback document
      try {
        logger.info('Attempting to create fallback document');
        docxBuffer = await createFallbackDocument(cvText, jobTitle);
        logger.info('Fallback document created successfully');
      } catch (fallbackError) {
        logger.error('Fallback document creation failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to generate DOCX document',
            details: `Original error: ${genError instanceof Error ? genError.message : 'Unknown error'}. Fallback error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          },
          { status: 500 }
        );
      }
    }

    // Convert buffer to base64 for response
    try {
      const base64Data = docxBuffer.toString('base64');
      
      // Create a download URL
      const downloadUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Data}`;
      
      logger.info(`Successfully created download URL for DOCX, base64 length: ${base64Data.length}`);

      // Return the base64 data and download URL
      return NextResponse.json({
        success: true,
        docxBase64: base64Data,
        downloadUrl
      });
    } catch (encodeError) {
      logger.error('Error encoding document to base64:', encodeError instanceof Error ? encodeError.message : String(encodeError));
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to encode document',
          details: encodeError instanceof Error ? encodeError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in specific-generate-docx:', error instanceof Error ? error.message : String(error), error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Create a simple fallback document when the main generation fails
 */
async function createFallbackDocument(cvText: string, jobTitle?: string): Promise<Buffer> {
  try {
    // Create a simple document
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
          // Title
          new Paragraph({
            text: jobTitle ? `Optimized CV for ${jobTitle}` : 'Optimized CV',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400
            }
          }),
          
          // Explanation
          new Paragraph({
            text: 'There was an issue with the advanced formatting. Here is your optimized content:',
            spacing: {
              before: 200,
              after: 400
            }
          }),
          
          // Split the CV text into paragraphs for better readability
          ...cvText.split('\n\n').filter(p => p.trim()).map(paragraph => 
            new Paragraph({
              text: paragraph,
              spacing: {
                before: 200,
                after: 200
              }
            })
          ),
          
          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                size: 20,
                color: '666666'
              })
            ],
            spacing: {
              before: 400
            },
            alignment: AlignmentType.CENTER
          })
        ]
      }]
    });
    
    // Generate buffer
    return await Packer.toBuffer(doc);
  } catch (error) {
    logger.error('Error creating fallback document:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to create fallback document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    // Check if we have any sections
    if (Object.keys(sections).length === 0) {
      logger.error('No sections found in CV text');
      throw new Error('Failed to parse CV text into sections');
    }
    
    logger.info(`Parsed ${Object.keys(sections).length} sections from CV text`);
    
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
    
    // Create document with error handling
    try {
      logger.info('Creating document structure');
      
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
              try {
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
                    try {
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
                    } catch (lineError) {
                      logger.warn(`Error processing line in section ${sectionName}:`, lineError instanceof Error ? lineError.message : String(lineError));
                      // Add a simple paragraph as fallback
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
                    try {
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
                    } catch (itemError) {
                      logger.warn(`Error processing item in section ${sectionName}:`, itemError instanceof Error ? itemError.message : String(itemError));
                      // Add a simple paragraph as fallback
                      paragraphs.push(
                        new Paragraph({
                          text: String(item),
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
              } catch (sectionError) {
                logger.error(`Error processing section ${sectionName}:`, sectionError instanceof Error ? sectionError.message : String(sectionError));
                // Return an empty array to skip this section
                return [];
              }
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
        logger.info(`Document successfully packed to buffer: ${buffer.length} bytes`);
        return buffer;
      } catch (packError) {
        logger.error('Error packing document to buffer:', packError instanceof Error ? packError.message : String(packError));
        throw new Error(`Failed to pack document to buffer: ${packError instanceof Error ? packError.message : 'Unknown error'}`);
      }
    } catch (docError) {
      logger.error('Error creating document structure:', docError instanceof Error ? docError.message : String(docError));
      throw new Error(`Failed to create document structure: ${docError instanceof Error ? docError.message : 'Unknown error'}`);
    }
  } catch (error) {
    logger.error('Error generating specific DOCX:', error instanceof Error ? error.message : String(error));
    
    // Create a simple fallback document if the main generation fails
    try {
      logger.info('Attempting to create fallback document');
      
      const fallbackDoc = new Document({
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
            new Paragraph({
              text: 'Optimized CV',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'There was an issue formatting the CV properly. Here is the raw content:',
              spacing: {
                before: 400,
                after: 400
              }
            }),
            new Paragraph({
              text: cvText,
              spacing: {
                before: 200
              }
            })
          ]
        }]
      });
      
      logger.info('Packing fallback document to buffer');
      const fallbackBuffer = await Packer.toBuffer(fallbackDoc);
      logger.info('Fallback document created successfully');
      return fallbackBuffer;
    } catch (fallbackError) {
      logger.error('Fallback document creation failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Parse optimized text into sections
 */
function parseOptimizedText(text: string): Record<string, string | string[]> {
  const sections: Record<string, string | string[]> = {};
  
  if (!text || typeof text !== 'string') {
    logger.error('Invalid text provided to parseOptimizedText');
    return sections;
  }
  
  logger.info(`Parsing optimized text of length: ${text.length}`);
  
  try {
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      logger.warn('No content found in optimized text');
      return sections;
    }
    
    // Define section patterns with more variations
    const sectionPatterns = [
      { regex: /^(PROFILE|SUMMARY|ABOUT|ABOUT ME|PROFESSIONAL SUMMARY)[:.\-]?/i, name: 'PROFILE' },
      { regex: /^(ACHIEVEMENTS|ACCOMPLISHMENTS|KEY ACHIEVEMENTS)[:.\-]?/i, name: 'ACHIEVEMENTS' },
      { regex: /^(GOALS|CAREER GOALS|OBJECTIVES|CAREER OBJECTIVES)[:.\-]?/i, name: 'GOALS' },
      { regex: /^(LANGUAGES|LANGUAGE PROFICIENCY|LANGUAGE SKILLS)[:.\-]?/i, name: 'LANGUAGES' },
      { regex: /^(SKILLS|TECHNICAL SKILLS|PROFESSIONAL SKILLS|KEY SKILLS|CORE SKILLS|COMPETENCIES)[:.\-]?/i, name: 'SKILLS' },
      { regex: /^(EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS|ACADEMIC QUALIFICATIONS)[:.\-]?/i, name: 'EDUCATION' },
      { regex: /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE|CAREER HISTORY)[:.\-]?/i, name: 'EXPERIENCE' },
      { regex: /^(REFERENCES|REFEREES)[:.\-]?/i, name: 'REFERENCES' }
    ];
    
    let currentSection = '';
    let sectionContent: string[] = [];
    
    // Process each line
    for (const line of lines) {
      // Check if this line is a section header
      let isSectionHeader = false;
      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(line)) {
          // If we were already processing a section, save it
          if (currentSection) {
            if (sectionContent.length > 0) {
              sections[currentSection] = sectionContent.join('\n');
            }
          }
          
          // Start a new section
          currentSection = pattern.name;
          sectionContent = [];
          isSectionHeader = true;
          
          // Check if there's content after the section header on the same line
          const contentAfterHeader = line.replace(pattern.regex, '').trim();
          if (contentAfterHeader) {
            sectionContent.push(contentAfterHeader);
          }
          
          break;
        }
      }
      
      // If not a section header, add to current section
      if (!isSectionHeader) {
        if (currentSection) {
          sectionContent.push(line);
        } else {
          // If no section has been identified yet, this is likely header information
          if (!sections['Header']) {
            sections['Header'] = line;
          } else if (typeof sections['Header'] === 'string') {
            sections['Header'] += '\n' + line;
          }
        }
      }
    }
    
    // Save the last section
    if (currentSection && sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join('\n');
    }
    
    // If no sections were found, try to intelligently parse the content
    if (Object.keys(sections).length <= 1 && sections['Header']) {
      logger.warn('No standard sections found, attempting intelligent parsing');
      return intelligentParsing(text);
    }
    
    logger.info(`Successfully parsed ${Object.keys(sections).length} sections from optimized text`);
    return sections;
  } catch (error) {
    logger.error('Error parsing optimized text:', error instanceof Error ? error.message : String(error));
    return sections;
  }
}

/**
 * Attempt to intelligently parse CV text when standard section headers aren't found
 */
function intelligentParsing(text: string): Record<string, string | string[]> {
  const sections: Record<string, string | string[]> = {};
  
  try {
    // Split text into paragraphs (blocks separated by multiple newlines)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    if (paragraphs.length === 0) {
      return sections;
    }
    
    // First paragraph is likely the header/contact info
    sections['Header'] = paragraphs[0];
    
    // Second paragraph is often the profile/summary
    if (paragraphs.length > 1) {
      sections['PROFILE'] = paragraphs[1];
    }
    
    // Look for experience indicators
    const experienceParagraphs = paragraphs.filter(p => 
      /experience|work|career|job|position|employment/i.test(p) && 
      /20\d\d|19\d\d|january|february|march|april|may|june|july|august|september|october|november|december/i.test(p)
    );
    
    if (experienceParagraphs.length > 0) {
      sections['EXPERIENCE'] = experienceParagraphs.join('\n\n');
    }
    
    // Look for education indicators
    const educationParagraphs = paragraphs.filter(p => 
      /education|degree|university|college|school|bachelor|master|phd|diploma/i.test(p) && 
      !/work|experience/i.test(p.split('\n')[0])
    );
    
    if (educationParagraphs.length > 0) {
      sections['EDUCATION'] = educationParagraphs.join('\n\n');
    }
    
    // Look for skills indicators
    const skillsParagraphs = paragraphs.filter(p => 
      /skills|proficient|proficiency|competent|competency|expertise|expert in/i.test(p) && 
      p.split('\n').length < 10 && // Skills sections are usually shorter
      !/work|experience|education/i.test(p.split('\n')[0])
    );
    
    if (skillsParagraphs.length > 0) {
      sections['SKILLS'] = skillsParagraphs.join('\n\n');
    }
    
    logger.info(`Intelligent parsing found ${Object.keys(sections).length} sections`);
    return sections;
  } catch (error) {
    logger.error('Error in intelligent parsing:', error instanceof Error ? error.message : String(error));
    return sections;
  }
} 