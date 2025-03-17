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

    // Log the request details for debugging
    logger.info(`Processing document generation request: CV ID: ${cvId}, Job Title: ${jobTitle || 'Not provided'}`);
    logger.info(`Optimized text length: ${optimizedText ? optimizedText.length : 0} characters`);
    
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

    // Extract company name from job description if available
    let companyName = '';
    if (jobDescription) {
      // Look for company name in the job description
      const companyRegex = /(?:at|for|with|from|by)\s+([\w\s&\-',]+?)(?:\.|,|\sin\s|\spos\s|$)/i;
      const companyMatch = jobDescription.match(companyRegex);
      if (companyMatch && companyMatch[1]) {
        companyName = companyMatch[1].trim();
        // Remove common words that might be incorrectly captured
        companyName = companyName.replace(/\b(the|a|an|our|their|company|organization|position|role|opportunity)\b/gi, '').trim();
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
      const generatePromise = generateSpecificDocx(cvText, jobTitle, companyName, jobDescription);
      
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
 * Generate a specific DOCX file for optimized CV
 */
async function generateSpecificDocx(
  cvText: string,
  jobTitle?: string,
  companyName?: string,
  jobDescription?: string
): Promise<Buffer> {
  logger.info('Starting document generation process');
  
  // Order of sections to process
  const sectionOrder = [
    'Header',
    'PROFILE',
    'EXPERIENCE',
    'EDUCATION',
    'SKILLS',
    'TECHNICAL SKILLS',
    'PROFESSIONAL SKILLS',
    'LANGUAGES',
    'ACHIEVEMENTS',
    'GOALS',
    'REFERENCES'
  ];
  
  // Parse the CV text into sections
  const sections = parseOptimizedText(cvText);
  
  // Create all paragraphs that will be added to the document
  const paragraphs = [];
  
  // Create title with job title if available
  const pageTitle = new Paragraph({
    text: jobTitle 
      ? `Curriculum Vitae - ${jobTitle}${companyName ? ` at ${companyName}` : ''}`
      : 'Curriculum Vitae',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
  });
  paragraphs.push(pageTitle);
  
  // Add horizontal line
  const horizontalLine = new Paragraph({
    children: [
      new TextRun({
        text: '_______________________________________________________________',
        color: '999999',
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: {
      after: 400,
    },
  });
  paragraphs.push(horizontalLine);

  // Process sections in order with enhanced Profile section handling
  for (const sectionName of sectionOrder) {
    // Force check for Profile section as fallback
    let content = sections[sectionName];
    
    // Special handling for Profile section if it's missing
    if (sectionName === 'PROFILE' && !content) {
      // Check for similar sections
      content = sections['SUMMARY'] || sections['ABOUT ME'] || sections['PROFESSIONAL SUMMARY'] || sections['PERSONAL STATEMENT'];
      
      // If still not found, try to extract from the first part of text
      if (!content) {
        // Look for first substantial paragraph after header
        const lines = cvText.split('\n').filter(line => line.trim());
        let contactInfoEnded = false;
        
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i];
          
          // Skip contact info
          if (line.includes('@') || /^\+?[\d\s()-]{7,}$/.test(line) || line.includes('linkedin.com')) {
            continue;
          }
          
          contactInfoEnded = true;
          
          // Look for a substantial line
          if (line.length > 50 && !line.match(/^[A-Z\s]+:$/)) {
            content = line;
            break;
          }
        }
      }
    }
    
    // Skip if section doesn't exist after all attempts
    if (!content) continue;
    
    // Skip adding a header for "Header" section
    if (sectionName !== 'Header') {
      // Add section heading
      const sectionHeading = new Paragraph({
        text: sectionName,
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
          after: 200,
        },
        border: {
          bottom: {
            color: "999999",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      });
      paragraphs.push(sectionHeading);
    }
    
    // Special handling for profile section with enhanced formatting
    if (sectionName === 'PROFILE') {
      const profileContent = typeof content === 'string' ? content : content.join('\n');
      
      // Apply a professional style to the profile text
      const profileParagraph = new Paragraph({
        children: [
          new TextRun({
            text: profileContent,
            size: 24, // Slightly larger text
            font: {
              name: "Calibri",
            },
            color: '333333', // Darker text color for better readability
          }),
        ],
        spacing: {
          before: 200,
          after: 400, // Extra space after profile
          line: 360, // Increased line spacing
        },
        indent: {
          left: 0,
        },
        border: {
          bottom: {
            color: 'B4916C', // Brand color for subtle emphasis
            space: 1,
            style: BorderStyle.SINGLE,
            size: 3,
          },
        },
      });
      paragraphs.push(profileParagraph);
      
      // Add job-specific context if available
      if (jobTitle) {
        const contextParagraph = new Paragraph({
          children: [
            new TextRun({
              text: `Targeting: ${jobTitle}${companyName ? ` at ${companyName}` : ''}`,
              size: 20,
              italics: true,
              color: 'B4916C', // Brand color
            }),
          ],
          spacing: {
            before: 200,
            after: 400,
          },
          alignment: AlignmentType.RIGHT,
        });
        paragraphs.push(contextParagraph);
      }
      
      continue; // Skip the rest of the loop for profile
    }
    
    // Handle content (could be string or array)
    if (typeof content === 'string') {
      // Split by lines to check for bullet points
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Check if this line is a bullet point
        const isBulletPoint = line.trim().startsWith('•') || 
                             line.trim().startsWith('-') ||
                             line.trim().startsWith('*');
        
        // Create appropriate paragraph
        const paragraph = new Paragraph({
          children: [
            new TextRun({
              text: isBulletPoint ? line.trim().substring(1).trim() : line,
            }),
          ],
          spacing: {
            before: 100,
            after: 100,
            line: 300,
          },
          bullet: isBulletPoint ? {
            level: 0,
          } : undefined,
          indent: isBulletPoint ? {
            left: 720,
            hanging: 360,
          } : {
            left: 0,
          },
        });
        paragraphs.push(paragraph);
      }
    } else if (Array.isArray(content)) {
      // Handle array content
      for (const item of content) {
        // Check if this item is a bullet point
        const isBulletPoint = item.trim().startsWith('•') || 
                             item.trim().startsWith('-') ||
                             item.trim().startsWith('*');
        
        const paragraph = new Paragraph({
          children: [
            new TextRun({
              text: isBulletPoint ? item.trim().substring(1).trim() : item,
            }),
          ],
          spacing: {
            before: 100,
            after: 100,
            line: 300,
          },
          bullet: isBulletPoint ? {
            level: 0,
          } : undefined,
          indent: isBulletPoint ? {
            left: 720,
            hanging: 360,
          } : {
            left: 0,
          },
        });
        paragraphs.push(paragraph);
      }
    }
  }
  
  // Add footer with date
  const footer = new Paragraph({
    children: [
      new TextRun({
        text: `Generated on ${new Date().toLocaleDateString()}`,
        size: 20,
        color: '666666',
      }),
    ],
    spacing: {
      before: 400,
    },
    alignment: AlignmentType.CENTER,
    border: {
      top: {
        color: '999999',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
  });
  paragraphs.push(footer);
  
  // Create new document by directly providing all paragraphs to the section
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: paragraphs,
      },
    ],
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
}

/**
 * Parse optimized text into sections
 */
function parseOptimizedText(text: string): Record<string, string | string[]> {
  const sections: Record<string, string | string[]> = {};
  
  // Return empty sections if no text provided
  if (!text || typeof text !== 'string') {
    logger.warn('No valid text provided for parsing');
    return sections;
  }
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim());
  
  // First try to check if the text is in JSON format
  try {
    const parsedJson = JSON.parse(text);
    if (typeof parsedJson === 'object' && parsedJson !== null) {
      logger.info('Successfully parsed text as JSON');
      return parsedJson;
    }
  } catch (e) {
    // Not valid JSON, continue with regular parsing
    logger.info('Text is not in JSON format, using standard parsing');
  }
  
  // Define section patterns - prioritizing case-insensitive matches
  const sectionPatterns: { regex: RegExp, name: string }[] = [
    { regex: /^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|PERSONAL STATEMENT)(:|\s-|\n)/i, name: 'PROFILE' },
    { regex: /^(ACHIEVEMENTS|ACCOMPLISHMENTS)(:|\s-|\n)/i, name: 'ACHIEVEMENTS' },
    { regex: /^(GOALS|CAREER GOALS|OBJECTIVES)(:|\s-|\n)/i, name: 'GOALS' },
    { regex: /^(LANGUAGES|LANGUAGE PROFICIENCY)(:|\s-|\n)/i, name: 'LANGUAGES' },
    { regex: /^(TECHNICAL SKILLS)(:|\s-|\n)/i, name: 'TECHNICAL SKILLS' },
    { regex: /^(PROFESSIONAL SKILLS|SOFT SKILLS)(:|\s-|\n)/i, name: 'PROFESSIONAL SKILLS' },
    { regex: /^(SKILLS|CORE COMPETENCIES|KEY SKILLS)(:|\s-|\n)/i, name: 'SKILLS' },
    { regex: /^(EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS)(:|\s-|\n)/i, name: 'EDUCATION' },
    { regex: /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)(:|\s-|\n)/i, name: 'EXPERIENCE' },
    { regex: /^(REFERENCES)(:|\s-|\n)/i, name: 'REFERENCES' }
  ];
  
  // Extract contact information (usually at the top)
  const headerEndIndex = Math.min(10, lines.length);
  const headerContent: string[] = [];
  for (let i = 0; i < headerEndIndex; i++) {
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(lines[i].trim()) || // Email
        /^\+?[\d\s()-]{7,}$/.test(lines[i].trim()) || // Phone
        /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?$/.test(lines[i].trim())) { // LinkedIn
      headerContent.push(lines[i]);
    }
  }
  if (headerContent.length > 0) {
    sections['Header'] = headerContent.join('\n');
  }
  
  let currentSection = '';
  let sectionContent: string[] = [];
  let foundFirstSection = false;
  
  // Special handling for profile - often the first substantive paragraph after contact info
  let potentialProfile = '';
  let inProfileParagraph = false;

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line is a section header
    let matchedSection = '';
    for (const pattern of sectionPatterns) {
      if (pattern.regex.test(line)) {
        matchedSection = pattern.name;
        break;
      }
    }
    
    if (matchedSection) {
      // Save previous section content if any
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n');
      }
      
      // Start a new section
      currentSection = matchedSection;
      sectionContent = [];
      foundFirstSection = true;
      
      // Extract content from the section header line (after the colon or dash)
      const headerContentMatch = line.match(/(?::|-)(.+)$/);
      if (headerContentMatch && headerContentMatch[1].trim()) {
        sectionContent.push(headerContentMatch[1].trim());
      }
    } else if (currentSection) {
      // Add to current section
      sectionContent.push(line);
    } else if (!foundFirstSection && !inProfileParagraph && line.length > 20 && !sections['PROFILE']) {
      // If we haven't found a section yet and this is a substantial line, treat it as the profile
      potentialProfile = line;
      inProfileParagraph = true;
    } else if (inProfileParagraph) {
      // Continue adding to the profile paragraph
      if (line.trim().length > 0) {
        potentialProfile += '\n' + line;
      } else {
        // End of paragraph
        inProfileParagraph = false;
      }
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
  }
  
  // If we found a potential profile paragraph but no PROFILE section
  if (potentialProfile && !sections['PROFILE']) {
    sections['PROFILE'] = potentialProfile;
  }
  
  // Ensure key sections exist
  if (!sections['PROFILE'] && !sections['SUMMARY']) {
    // Look through the first 15 lines for a substantial paragraph
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      if (lines[i].length > 50 && !lines[i].includes('@') && !lines[i].includes('http')) {
        sections['PROFILE'] = lines[i];
        break;
      }
    }
  }
  
  logger.info(`Parsed ${Object.keys(sections).length} sections from optimized text`);
  return sections;
} 