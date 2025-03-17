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
  
  // Order of sections to process with a focus on most important sections first
  const sectionOrder = [
    'Header',
    'PROFILE',             // Profile is critical - comes right after contact info
    'SUMMARY',             // Alternative to profile
    'EXPERIENCE',          // Experience is very important for employers
    'EDUCATION',           // Education typically follows experience
    'SKILLS',              // General skills section
    'TECHNICAL SKILLS',    // Technical skills are typically separate
    'PROFESSIONAL SKILLS', // Professional/soft skills section
    'LANGUAGES',           // Language proficiencies
    'ACHIEVEMENTS',        // Key achievements
    'GOALS',               // Career goals/objectives
    'REFERENCES',          // References typically come last
    'ABOUT ME',            // Alternative profile section
    'PROFESSIONAL SUMMARY', // Another alternative profile
    'PERSONAL STATEMENT',  // Another alternative profile
    'CORE COMPETENCIES',   // Alternative skills section
    'KEY SKILLS',          // Alternative skills section
    'WORK EXPERIENCE',     // Alternative experience section
    'EMPLOYMENT HISTORY',  // Alternative experience section
    'QUALIFICATIONS',      // Alternative education section
    'ACADEMIC BACKGROUND', // Alternative education section
  ];
  
  // Parse the CV text into sections
  const sections = parseOptimizedText(cvText);
  
  // Log found sections for debugging
  logger.info(`Found sections: ${Object.keys(sections).join(', ')}`);
  
  // Quick check for PROFILE section - if missing, try to extract it directly
  if (!sections['PROFILE']) {
    logger.warn('PROFILE section missing, attempting to extract directly');
    
    // Look for a profile paragraph at the beginning of the CV
    const lines = cvText.split('\n').filter(line => line.trim());
    
    // Skip past header (emails, phones, etc.)
    let i = 0;
    while (i < Math.min(10, lines.length) && 
          (lines[i].includes('@') || 
           /^\+?[\d\s()-]{7,}$/.test(lines[i]) || 
           lines[i].includes('linkedin.com') ||
           lines[i].length < 30)) {
      i++;
    }
    
    // Try to find a substantial paragraph that might be a profile
    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      if (lines[j].length > 50 && !lines[j].includes('@') && !lines[j].match(/^[A-Z\s]+:$/)) {
        sections['PROFILE'] = lines[j];
        logger.info('Extracted potential profile paragraph directly from text');
        break;
      }
    }
    
    // If still no profile, create a default one
    if (!sections['PROFILE']) {
      sections['PROFILE'] = 'Professional with extensive experience seeking new opportunities.';
      logger.info('Created default profile content as none was found');
    }
  }
  
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
  logger.info(`Starting to process sections. Available: ${Object.keys(sections).join(', ')}`);
  const processedSections: string[] = [];
  
  for (const sectionName of sectionOrder) {
    // Force check for Profile section as fallback
    let content = sections[sectionName];
    
    // Skip if section doesn't exist
    if (!content) {
      logger.debug(`Section "${sectionName}" not found, skipping`);
      continue;
    }
    
    logger.info(`Processing section: ${sectionName} (${typeof content === 'string' ? 'string' : 'array'}, length: ${typeof content === 'string' ? content.length : (content as string[]).length} characters)`);
    processedSections.push(sectionName);

    // Skip adding a header for "Header" section
    if (sectionName !== 'Header') {
      // Add section heading
      logger.debug(`Adding heading for section: ${sectionName}`);
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

    // If section is PROFILE, apply special formatting
    if (sectionName === 'PROFILE') {
      logger.info(`Processing PROFILE section with ${typeof content === 'string' ? content.length : 'array'} chars`);
      
      // Ensure valid content
      let profileText = '';
      if (typeof content === 'string') {
        profileText = content.trim();
      } else if (Array.isArray(content)) {
        profileText = content.join('\n').trim();
      }
      
      // Enhance profile if it's too short
      if (profileText.length < 100) {
        logger.warn('Profile content is very short, enhancing it');
        const jobContext = jobTitle ? ` seeking to excel as a ${jobTitle}` : '';
        profileText = `Experienced professional with a strong background in relevant skills${jobContext}. ${profileText}`;
      }
      
      // Add job-specific context if a job title is provided
      if (jobTitle && !profileText.toLowerCase().includes(jobTitle.toLowerCase())) {
        logger.info('Adding job context to profile');
        if (!profileText.endsWith('.')) profileText += '.';
        profileText += ` Looking to leverage skills and experience as a ${jobTitle}.`;
      }
      
      // Format profile text with special formatting for better visual appearance
      const profileParagraph = new Paragraph({
        children: [
          new TextRun({
            text: profileText,
            size: 26, // Slightly larger than normal text
            color: '333333', // Dark color for visibility - using brand color
          }),
        ],
        spacing: { 
          after: 400,
          line: 360 // Better line spacing
        },
        style: 'bodyText',
        border: {
          bottom: {
            color: 'EEEEEE',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 1
          }
        }
      });
      
      paragraphs.push(profileParagraph);
      
      // If job title is provided, add a context paragraph in italics
      if (jobTitle) {
        const contextParagraph = new Paragraph({
          children: [
            new TextRun({
              text: `CV Optimized for ${jobTitle} position`,
              size: 20,
              color: 'B4916C', // Brand color for subtle emphasis
              italics: true,
            }),
          ],
          spacing: { 
            after: 300,
            before: 100
          }
        });
        paragraphs.push(contextParagraph);
      }
      
      continue;
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
  
  // Log summary of what was processed
  logger.info(`Document generation complete. Processed ${processedSections.length} sections: ${processedSections.join(', ')}`);

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
  
  logger.info(`Parsing optimized text (length: ${text?.length || 0})`);
  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided to parseOptimizedText');
    return sections;
  }

  const lines = text.split('\n');
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(text);
    logger.info(`Successfully parsed JSON with sections: ${Object.keys(parsed).join(', ')}`);
    return parsed;
  } catch (error) {
    // If not JSON, continue with standard parsing
    logger.info('Not JSON format, proceeding with standard parsing');
  }

  // Define patterns for section headers with more variations
  const sectionPatterns = {
    'PROFILE': /^(?:\*\*)?(?:PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|PERSONAL STATEMENT|CAREER OBJECTIVE|OBJECTIVE)(?:\*\*)?:?$/i,
    'EXPERIENCE': /^(?:\*\*)?(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE|CAREER HISTORY)(?:\*\*)?:?$/i,
    'EDUCATION': /^(?:\*\*)?(?:EDUCATION|QUALIFICATIONS|ACADEMIC BACKGROUND|ACADEMIC QUALIFICATIONS|EDUCATIONAL BACKGROUND)(?:\*\*)?:?$/i,
    'SKILLS': /^(?:\*\*)?(?:SKILLS)(?:\*\*)?:?$/i,
    'TECHNICAL SKILLS': /^(?:\*\*)?(?:TECHNICAL SKILLS|TECHNICAL EXPERTISE|TECHNICAL PROFICIENCIES)(?:\*\*)?:?$/i,
    'PROFESSIONAL SKILLS': /^(?:\*\*)?(?:PROFESSIONAL SKILLS|SOFT SKILLS|CORE COMPETENCIES|KEY SKILLS|COMPETENCIES)(?:\*\*)?:?$/i,
    'LANGUAGES': /^(?:\*\*)?(?:LANGUAGES|LANGUAGE PROFICIENCIES|LANGUAGE SKILLS)(?:\*\*)?:?$/i,
    'ACHIEVEMENTS': /^(?:\*\*)?(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY ACHIEVEMENTS|HONORS|AWARDS)(?:\*\*)?:?$/i,
    'GOALS': /^(?:\*\*)?(?:GOALS|OBJECTIVES|CAREER GOALS|PROFESSIONAL GOALS)(?:\*\*)?:?$/i,
    'REFERENCES': /^(?:\*\*)?(?:REFERENCES|PROFESSIONAL REFERENCES)(?:\*\*)?:?$/i
  };

  let currentSection = '';
  let sectionContent: string[] = [];

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines at the beginning
    if (!currentSection && line === '') continue;

    // Check if line is a section header
    let foundMatch = false;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line)) {
        // If we were processing a section, add it to sections
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n');
        }
        
        currentSection = section;
        sectionContent = [];
        foundMatch = true;
        logger.debug(`Found section header: ${section}`);
        break;
      }
    }

    // If line is not a section header, add to current section
    if (!foundMatch && currentSection) {
      sectionContent.push(line);
    }
  }

  // Add the last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
  }

  // Log what sections were found
  logger.info(`Found ${Object.keys(sections).length} sections: ${Object.keys(sections).join(', ')}`);
  
  // If no profile section was found, try to extract one from the first substantial paragraph
  if (!sections['PROFILE'] && lines.length > 0) {
    logger.warn('No PROFILE section found, attempting to extract one');
    
    // Try to extract a profile from the first substantial paragraph
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      // Skip headers, contact info, and short lines
      if (line.length > 50 && 
          !line.includes('@') && 
          !line.includes('http') && 
          !/^\+?[\d\s()-]{7,}$/.test(line) &&
          !Object.values(sectionPatterns).some(pattern => pattern.test(line))) {
        
        // Found a substantial paragraph that's likely a profile
        sections['PROFILE'] = line;
        logger.info('Extracted fallback profile from text');
        break;
      }
    }
  }
  
  return sections;
} 