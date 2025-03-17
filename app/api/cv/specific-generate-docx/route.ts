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
  
  // More detailed logging for debugging section parsing
  const sectionSummary = Object.entries(sections).map(([key, value]) => {
    const contentLength = typeof value === 'string' 
      ? value.length 
      : Array.isArray(value) ? value.join(' ').length : 0;
    return `${key}: ${contentLength} chars`;
  }).join(', ');
  
  logger.info(`Parsed sections: ${sectionSummary}`);
  
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

  // Process each section in order with enhanced Profile formatting
  for (const section of sectionOrder) {
    // Skip if section doesn't exist
    if (!sections[section]) continue;
    
    // Get content for this section
    const content = sections[section];
    
    // Special handling for Profile section with enhanced formatting
    if (section === 'PROFILE') {
      // Add profile header with special formatting
      const profileHeader = new Paragraph({
        text: 'Professional Profile',
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
          after: 200,
        },
        alignment: AlignmentType.CENTER,
      });
      paragraphs.push(profileHeader);
      
      // Process profile content with enhanced formatting
      if (typeof content === 'string') {
        const contentLines = content.split('\n').filter(line => line.trim());
        
        // Join all profile content into a single paragraph for better flow
        const profileText = contentLines.join(' ');
        
        // Add profile content with enhanced formatting
        const profileParagraph = new Paragraph({
          children: [
            new TextRun({
              text: profileText,
              size: 24, // Larger text for better visibility
              font: "Calibri",
              color: '333333', // Darker text for better readability
            }),
          ],
          spacing: {
            before: 200,
            after: 300,
            line: 360, // Increased line spacing
          },
          border: {
            bottom: {
              color: 'B4916C', // Brand color for subtle emphasis
              size: 6,
              space: 8,
              style: BorderStyle.SINGLE,
            },
          },
        });
        paragraphs.push(profileParagraph);
        
        // Add job-specific context if job title is provided
        if (jobTitle) {
          const contextParagraph = new Paragraph({
            children: [
              new TextRun({
                text: `Seeking opportunities as a ${jobTitle} to leverage expertise and contribute to organizational success.`,
                italics: true,
                color: 'B4916C', // Brand color
                size: 22,
              }),
            ],
            spacing: {
              before: 200,
              after: 400,
            },
            alignment: AlignmentType.CENTER,
          });
          paragraphs.push(contextParagraph);
        }
      }
    } 
    // Standard handling for other sections
    else if (section !== 'Header') {
      const sectionHeader = new Paragraph({
        text: section,
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      });
      paragraphs.push(sectionHeader);
      
      // Add content
      if (typeof content === 'string') {
        // Handle string content
        const contentLines = content.split('\n');
        
        for (const line of contentLines) {
          // Skip empty lines
          if (!line.trim()) continue;
          
          // Check if this line is a bullet point
          const isBulletPoint = line.trim().startsWith('•') || 
                               line.trim().startsWith('-') ||
                               line.trim().startsWith('*');
          
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
  
  // Define section patterns - improved to capture more variations
  const sectionPatterns: { regex: RegExp, name: string }[] = [
    { regex: /^\s*[\*•\-\|\#]?\s*(?:PROFILE|SUMMARY|ABOUT(?:\s+ME)?|PROFESSIONAL(?:\s+SUMMARY)?|PERSONAL(?:\s+STATEMENT)?)[\s\*•:\-_\|\#]*$/i, name: 'PROFILE' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY(?:\s+ACHIEVEMENTS))[\s\*•:\-_\|\#]*$/i, name: 'ACHIEVEMENTS' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:GOALS|OBJECTIVES|CAREER(?:\s+GOALS))[\s\*•:\-_\|\#]*$/i, name: 'GOALS' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:LANGUAGES?|LANGUAGE(?:\s+PROFICIENCY)|LANGUAGE(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, name: 'LANGUAGES' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:TECHNICAL(?:\s+SKILLS)|TECHNICAL(?:\s+EXPERTISE)|TECHNICAL(?:\s+PROFICIENCIES))[\s\*•:\-_\|\#]*$/i, name: 'TECHNICAL SKILLS' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:PROFESSIONAL(?:\s+SKILLS)|SOFT(?:\s+SKILLS)|KEY(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, name: 'PROFESSIONAL SKILLS' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:SKILLS|CORE(?:\s+SKILLS)|EXPERTISE|COMPETENCIES|CAPABILITIES)[\s\*•:\-_\|\#]*$/i, name: 'SKILLS' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:EDUCATION|ACADEMIC(?:\s+BACKGROUND)|EDUCATIONAL(?:\s+HISTORY)|QUALIFICATIONS)[\s\*•:\-_\|\#]*$/i, name: 'EDUCATION' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:EXPERIENCE|WORK(?:\s+EXPERIENCE)|EMPLOYMENT(?:\s+HISTORY)|PROFESSIONAL(?:\s+EXPERIENCE)|CAREER(?:\s+HISTORY))[\s\*•:\-_\|\#]*$/i, name: 'EXPERIENCE' },
    { regex: /^\s*[\*•\-\|\#]?\s*(?:REFERENCES|PROFESSIONAL(?:\s+REFERENCES)|RECOMMENDATIONS)[\s\*•:\-_\|\#]*$/i, name: 'REFERENCES' }
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

  // Process each line with improved content extraction
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Check if this line is a section header using our patterns
    let matchedSection = '';
    for (const pattern of sectionPatterns) {
      if (pattern.regex.test(line)) {
        matchedSection = pattern.name;
        logger.info(`Found section header: ${matchedSection} in line: "${line.substring(0, 50)}..."`);
        break;
      }
    }
    
    if (matchedSection) {
      // Save previous section content if any
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n');
        logger.info(`Saved section ${currentSection} with ${sectionContent.length} lines of content`);
      }
      
      // Start a new section
      currentSection = matchedSection;
      sectionContent = [];
      foundFirstSection = true;
      
      // Extract content from the section header line (after the colon or dash)
      const headerContentMatch = line.match(/(?:[:|-])(.+)$/);
      if (headerContentMatch && headerContentMatch[1].trim()) {
        sectionContent.push(headerContentMatch[1].trim());
      }
    } else if (currentSection) {
      // Add to current section
      sectionContent.push(line);
      
      // Check for possible missed section headers (all caps, short line)
      if (line.toUpperCase() === line && line.length < 30 && line.length > 3 && !line.includes(':')) {
        logger.info(`Possible missed section header: "${line}" - treating as content for ${currentSection}`);
      }
    } else if (!foundFirstSection && !inProfileParagraph && line.length > 20 && 
              !sections['PROFILE'] && 
              !line.includes('@') && !line.includes('http') && 
              !/^\+?[\d\s()-]{7,}$/.test(line)) {
      // If we haven't found a section yet and this is a substantial non-contact-info line
      // treat it as the profile
      potentialProfile = line;
      inProfileParagraph = true;
      logger.info(`Found potential profile paragraph starting with: "${line.substring(0, 50)}..."`);
    } else if (inProfileParagraph) {
      // Continue adding to the profile paragraph
      if (line.trim().length > 0) {
        potentialProfile += '\n' + line;
      } else {
        // End of paragraph
        inProfileParagraph = false;
        logger.info(`Completed potential profile paragraph, length: ${potentialProfile.length} characters`);
      }
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
    logger.info(`Saved final section ${currentSection} with ${sectionContent.length} lines of content`);
  }
  
  // If we found a potential profile paragraph but no PROFILE section
  if (potentialProfile && !sections['PROFILE']) {
    sections['PROFILE'] = potentialProfile;
    logger.info(`Added potential profile paragraph as PROFILE section, length: ${potentialProfile.length} characters`);
  }
  
  // Special case for EXPERIENCE if not found but common patterns exist
  if (!sections['EXPERIENCE']) {
    // Look for patterns like "2020-2023: <Company>" or "Job Title - Company (2020-2023)"
    const experienceLines = lines.filter(line => 
      /\d{4}[—–-]\d{4}|[(]\d{4}[—–-]\d{4}[)]/.test(line) || // Date ranges
      /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s+(?:to|–|—|-)\s+(?:present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line) // Month ranges
    );
    
    if (experienceLines.length > 0) {
      sections['EXPERIENCE'] = experienceLines.join('\n');
      logger.info(`Created EXPERIENCE section from ${experienceLines.length} date-containing lines`);
    }
  }
  
  // Ensure key sections exist - especially PROFILE
  if (!sections['PROFILE'] && !sections['SUMMARY']) {
    // First try to find lines with "professional" or "experienced" near the beginning
    const professionalLines = lines.filter(line => 
      line.length > 50 && 
      /^.{0,50}(?:professional|experienced|expert|specialist|background in)/i.test(line) &&
      !line.includes('@') && 
      !line.includes('http')
    );
    
    if (professionalLines.length > 0) {
      sections['PROFILE'] = professionalLines[0];
      logger.info(`Created PROFILE section from line containing professional keywords: "${professionalLines[0].substring(0, 50)}..."`);
    } else {
      // Look through the first 15 lines for a substantial paragraph
      for (let i = 0; i < Math.min(15, lines.length); i++) {
        if (lines[i].length > 50 && !lines[i].includes('@') && !lines[i].includes('http')) {
          sections['PROFILE'] = lines[i];
          logger.info(`Created PROFILE section from substantial paragraph: "${lines[i].substring(0, 50)}..."`);
          break;
        }
      }
    }
  }
  
  // If we still don't have a profile, create a simple one
  if (!sections['PROFILE']) {
    // Extract a name if possible
    const nameMatch = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/);
    const name = nameMatch ? nameMatch[1] : "Professional";
    
    sections['PROFILE'] = `${name} with experience and skills seeking new opportunities to leverage expertise and contribute to organizational success.`;
    logger.info('Created default PROFILE section');
  }
  
  // Additional check: If we have a SUMMARY but no PROFILE, use SUMMARY as PROFILE
  if (!sections['PROFILE'] && sections['SUMMARY']) {
    sections['PROFILE'] = sections['SUMMARY'];
    logger.info('Using SUMMARY section as PROFILE');
  }
  
  // Final check: Make sure PROFILE is substantial
  if (sections['PROFILE'] && typeof sections['PROFILE'] === 'string' && sections['PROFILE'].length < 50) {
    // If profile is too short, try to enhance it
    const name = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/)?.[1] || "Professional";
    sections['PROFILE'] = `${sections['PROFILE']} ${name} is an experienced professional seeking opportunities to apply skills and expertise in a new role.`;
    logger.info('Enhanced short PROFILE section');
  }
  
  logger.info(`Parsed ${Object.keys(sections).length} sections from optimized text`);
  return sections;
}