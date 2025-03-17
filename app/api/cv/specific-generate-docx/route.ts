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
      'ACHIEVEMENTS',
      'GOALS', 
      'EXPECTATIONS',
      'EXPERIENCE',
      'LANGUAGES',
      'EDUCATION',
      'SKILLS', 
      'TECHNICAL SKILLS', 
      'PROFESSIONAL SKILLS',
      'REFERENCES'
  ];
  
  // Parse the CV text into sections
  const sections = parseOptimizedText(cvText);
  
  // Deduplicate skills sections
  if (sections['TECHNICAL SKILLS'] && sections['PROFESSIONAL SKILLS']) {
    // Convert both skill sections to arrays for easier processing
    const technicalSkills = typeof sections['TECHNICAL SKILLS'] === 'string' 
      ? sections['TECHNICAL SKILLS'].split('\n') 
      : sections['TECHNICAL SKILLS'];
    
    const professionalSkills = typeof sections['PROFESSIONAL SKILLS'] === 'string'
      ? sections['PROFESSIONAL SKILLS'].split('\n')
      : sections['PROFESSIONAL SKILLS'];
    
    // Create sets to identify duplicates (case-insensitive comparison)
    const technicalSkillsSet = new Set(technicalSkills.map(skill => skill.toLowerCase().trim()));
    
    // Filter professional skills to remove duplicates found in technical skills
    const uniqueProfessionalSkills = professionalSkills.filter(skill => {
      const skillLower = skill.toLowerCase().trim();
      return !technicalSkillsSet.has(skillLower);
    });
    
    // Update sections with deduplicated skills
    if (Array.isArray(sections['PROFESSIONAL SKILLS'])) {
      sections['PROFESSIONAL SKILLS'] = uniqueProfessionalSkills;
    } else {
      sections['PROFESSIONAL SKILLS'] = uniqueProfessionalSkills.join('\n');
    }
    
    logger.info(`Removed ${professionalSkills.length - uniqueProfessionalSkills.length} duplicate skills from PROFESSIONAL SKILLS`);
  }
  
  // Check for duplicate skills sections and merge if needed
  if (sections['SKILLS'] && (sections['TECHNICAL SKILLS'] || sections['PROFESSIONAL SKILLS'])) {
    // If we have both general skills and specific skills, only keep the specific ones
    if (sections['TECHNICAL SKILLS'] && sections['PROFESSIONAL SKILLS']) {
      delete sections['SKILLS']; // Remove the general skills as we have specific ones
      logger.info('Removed duplicate general SKILLS section as technical and professional skills exist');
    }
  }
  
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
    
    // If we already processed PROFILE and this is SUMMARY, skip it to avoid duplication
    if (section === 'SUMMARY' && sections['PROFILE']) {
      logger.info('Skipping SUMMARY section as PROFILE already exists');
      continue;
    }
    
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
        thematicBreak: true,
        border: {
          bottom: {
            color: 'B4916C', // Brand color for visual separation
            size: 1,
            space: 4,
            style: BorderStyle.SINGLE,
          },
        },
      });
      paragraphs.push(profileHeader);
      
      // Process profile content with enhanced formatting
      if (typeof content === 'string') {
        const contentLines = content.split('\n').filter(line => line.trim());
        
        // Remove any line that appears to be a header for "PROFILE" or "SUMMARY"
        const filteredLines = contentLines.filter(line => 
          !line.match(/^[\s*•\-\|\#]?PROFILE:?$/i) && 
          !line.match(/^[\s*•\-\|\#]?SUMMARY:?$/i) && 
          !line.match(/^[\s*•\-\|\#]?PROFESSIONAL\s+PROFILE:?$/i) &&
          !line.match(/^[\s*•\-\|\#]?PROFESSIONAL\s+SUMMARY:?$/i) &&
          !line.match(/^[\s*•\-\|\#]?ABOUT\s+ME:?$/i) &&
          !line.match(/^[\s*•\-\|\#]?PROFILE\s*:$/i) &&
          !line.match(/^SUMMARY\s*:$/i));
        
        // Clean the lines to remove any special formatting that might cause issues
        const cleanedLines = filteredLines.map(line => {
          // Remove colons at the end of a line if it appears to be just a label 
          return line.replace(/^(.{1,20}):$/, '$1')
                     // Clean up potential formatting characters
                     .replace(/^[\s*•\-\|\#]+\s*/, '')
                     // Remove any "PROFILE:" or "SUMMARY:" prefix that may be within a line
                     .replace(/^(?:PROFILE|SUMMARY|PROFESSIONAL\s+PROFILE|PROFESSIONAL\s+SUMMARY):\s*/i, '');
        });
        
        // Join all profile content into a single paragraph for better flow
        const profileText = cleanedLines.join(' ');
        
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
          // Remove border from paragraph to maintain consistent styling with other sections
        });
        paragraphs.push(profileParagraph);
        
        // Add job-specific context if job title is provided, but with better styling
        if (jobTitle) {
          const contextParagraph = new Paragraph({
            children: [
              new TextRun({
                text: `Seeking opportunities as a ${jobTitle}${companyName ? ` at ${companyName}` : ''} to leverage expertise and contribute to organizational success.`,
                italics: true,
                size: 22,
                color: '333333', // Match the main text color for consistency
              }),
            ],
            spacing: {
              before: 100,
              after: 200,
            },
            // No special alignment to match other content
          });
          paragraphs.push(contextParagraph);
        }
      }
    } 
    // Standard handling for other sections
    else {
      // Add section header (except for Header section)
      if (section !== 'Header') {
        // Fix section title formatting - convert to proper case for display
        let displaySectionTitle = section;
        
        // Handle special section name formatting
        if (section === 'ACHIEVEMENTS') displaySectionTitle = 'Achievements';
        else if (section === 'GOALS') displaySectionTitle = 'Goals';
        else if (section === 'EXPECTATIONS') displaySectionTitle = 'What to Expect from the Job';
        else if (section === 'EXPERIENCE') displaySectionTitle = 'Experience';
        else if (section === 'LANGUAGES') displaySectionTitle = 'Languages';
        else if (section === 'EDUCATION') displaySectionTitle = 'Education';
        else if (section === 'SKILLS') displaySectionTitle = 'Skills';
        else if (section === 'TECHNICAL SKILLS') displaySectionTitle = 'Technical Skills';
        else if (section === 'PROFESSIONAL SKILLS') displaySectionTitle = 'Professional Skills';
        else if (section === 'REFERENCES') displaySectionTitle = 'References';
        
        const sectionHeader = new Paragraph({
          text: displaySectionTitle,
          heading: HeadingLevel.HEADING_2,
          thematicBreak: true,
          spacing: {
            before: 400,
            after: 200,
          },
          border: {
            bottom: {
              color: 'B4916C', // Brand color for visual separation
              size: 1,
              space: 4,
              style: BorderStyle.SINGLE,
            },
          },
        });
        paragraphs.push(sectionHeader);
      }
      
      // Add content with improved formatting based on section type
      if (typeof content === 'string') {
        // Handle string content
        const contentLines = content.split('\n');
        
        // Clean content by removing section headers within the content
        const cleanedLines = contentLines
          .filter(line => line.trim()) // Remove empty lines
          .filter(line => {
            // Skip lines that appear to be just the section name (to avoid duplication)
            const sectionNamePattern = new RegExp(`^\\s*[\\*•\\-\\|\\#]?\\s*${section}\\s*:?$`, 'i');
            return !sectionNamePattern.test(line);
          })
          .map(line => {
            // Clean up formatting characters and section prefixes
            return line
              .replace(/^[\s*•\-\|\#]+\s*/, '') // Remove starting special characters
              .replace(new RegExp(`^${section}\\s*:\\s*`, 'i'), ''); // Remove section name prefix
          });
        
        for (const line of cleanedLines) {
          // Skip empty lines
          if (!line.trim()) continue;
          
          // Check if this line is a bullet point - expanded pattern matching
          const isBulletPoint = line.trim().startsWith('•') || 
                              line.trim().startsWith('-') ||
                              line.trim().startsWith('*') ||
                              line.trim().match(/^[\*•\-\|\#]\s/) !== null;
          
          // Extract the bullet content, properly handling the bullet character
          const bulletContent = isBulletPoint 
            ? line.trim().replace(/^[\*•\-\|\#]\s*/, '').trim() 
            : line;
          
          // Check if this is likely a job title or education institution
          const isLikelyTitle = line.length < 60 && 
                              /^[A-Z]/.test(line) && 
                              (section === 'EXPERIENCE' || section === 'EDUCATION') &&
                              !isBulletPoint;
          
          const paragraph = new Paragraph({
            children: [
              new TextRun({
                text: bulletContent,
                // Use bold for header content that might be a name or for section titles
                bold: section === 'Header' || isLikelyTitle ? true : undefined,
                // Use slightly larger size for header content and titles
                size: section === 'Header' ? 28 : 
                      isLikelyTitle ? 26 : undefined,
                // Use special formatting for language proficiencies
                italics: section === 'LANGUAGES' && !isLikelyTitle ? true : undefined,
                // Use specific color for achievements to make them stand out
                color: section === 'ACHIEVEMENTS' && isBulletPoint ? 'B4916C' : undefined,
              }),
            ],
            spacing: {
              before: section === 'Header' ? 0 : isLikelyTitle ? 200 : 100,
              after: section === 'Header' ? 0 : isLikelyTitle ? 100 : 100,
              line: 300,
            },
            alignment: section === 'Header' ? AlignmentType.CENTER : 
                      isLikelyTitle ? AlignmentType.LEFT : undefined,
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
        // Clean content by removing section headers within the content
        const cleanedItems = content
          .filter(item => item.trim()) // Remove empty items
          .filter(item => {
            // Skip items that appear to be just the section name (to avoid duplication)
            const sectionNamePattern = new RegExp(`^\\s*[\\*•\\-\\|\\#]?\\s*${section}\\s*:?$`, 'i');
            return !sectionNamePattern.test(item);
          })
          .map(item => {
            // Clean up formatting characters and section prefixes
            return item
              .replace(/^[\s*•\-\|\#]+\s*/, '') // Remove starting special characters
              .replace(new RegExp(`^${section}\\s*:\\s*`, 'i'), ''); // Remove section name prefix
          });
        
        for (const item of cleanedItems) {
          // Skip empty lines
          if (!item.trim()) continue;
          
          // Check if this item is a bullet point - expanded pattern matching
          const isBulletPoint = item.trim().startsWith('•') || 
                              item.trim().startsWith('-') ||
                              item.trim().startsWith('*') ||
                              item.trim().match(/^[\*•\-\|\#]\s/) !== null;
          
          // Extract the bullet content, properly handling the bullet character
          const bulletContent = isBulletPoint 
            ? item.trim().replace(/^[\*•\-\|\#]\s*/, '').trim() 
            : item;
          
          const paragraph = new Paragraph({
            children: [
              new TextRun({
                text: bulletContent,
                // Use special formatting for languages
                italics: section === 'LANGUAGES' ? true : undefined,
                // Use specific color for achievements to make them stand out
                color: section === 'ACHIEVEMENTS' && isBulletPoint ? 'B4916C' : undefined,
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
  
  // Define section patterns - improved to capture more variations and prioritize finding all important sections
  const sectionPatterns: { regex: RegExp, name: string, priority?: number, synonyms?: string[] }[] = [
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:PROFILE|SUMMARY|ABOUT(?:\s+ME)?|PROFESSIONAL(?:\s+SUMMARY)?|PERSONAL(?:\s+STATEMENT)?)[\s\*•:\-_\|\#]*$/i, 
      name: 'PROFILE', 
      priority: 10,
      synonyms: ['SUMMARY', 'ABOUT ME', 'PROFESSIONAL SUMMARY', 'PERSONAL STATEMENT']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY(?:\s+ACHIEVEMENTS)|HIGHLIGHTS)[\s\*•:\-_\|\#]*$/i, 
      name: 'ACHIEVEMENTS',
      priority: 8,
      synonyms: ['ACCOMPLISHMENTS', 'KEY ACHIEVEMENTS', 'HIGHLIGHTS'] 
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:GOALS|OBJECTIVES|CAREER(?:\s+GOALS)|ASPIRATIONS|CAREER(?:\s+OBJECTIVES))[\s\*•:\-_\|\#]*$/i, 
      name: 'GOALS',
      priority: 7,
      synonyms: ['OBJECTIVES', 'CAREER GOALS', 'ASPIRATIONS', 'CAREER OBJECTIVES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:LANGUAGES?|LANGUAGE(?:\s+PROFICIENCY)|LANGUAGE(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, 
      name: 'LANGUAGES',
      priority: 6,
      synonyms: ['LANGUAGE PROFICIENCY', 'LANGUAGE SKILLS']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:TECHNICAL(?:\s+SKILLS)|TECHNICAL(?:\s+EXPERTISE)|TECHNICAL(?:\s+PROFICIENCIES)|IT(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, 
      name: 'TECHNICAL SKILLS',
      priority: 5,
      synonyms: ['TECHNICAL EXPERTISE', 'TECHNICAL PROFICIENCIES', 'IT SKILLS'] 
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:PROFESSIONAL(?:\s+SKILLS)|SOFT(?:\s+SKILLS)|KEY(?:\s+SKILLS)|CORE(?:\s+COMPETENCIES))[\s\*•:\-_\|\#]*$/i, 
      name: 'PROFESSIONAL SKILLS',
      priority: 5,
      synonyms: ['SOFT SKILLS', 'KEY SKILLS', 'CORE COMPETENCIES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:SKILLS|CORE(?:\s+SKILLS)|EXPERTISE|COMPETENCIES|CAPABILITIES)[\s\*•:\-_\|\#]*$/i, 
      name: 'SKILLS',
      priority: 5,
      synonyms: ['CORE SKILLS', 'EXPERTISE', 'COMPETENCIES', 'CAPABILITIES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EDUCATION|ACADEMIC(?:\s+BACKGROUND)|EDUCATIONAL(?:\s+HISTORY)|QUALIFICATIONS|ACADEMIC(?:\s+QUALIFICATIONS))[\s\*•:\-_\|\#]*$/i, 
      name: 'EDUCATION',
      priority: 9,
      synonyms: ['ACADEMIC BACKGROUND', 'EDUCATIONAL HISTORY', 'QUALIFICATIONS', 'ACADEMIC QUALIFICATIONS']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EXPERIENCE|WORK(?:\s+EXPERIENCE)|EMPLOYMENT(?:\s+HISTORY)|PROFESSIONAL(?:\s+EXPERIENCE)|CAREER(?:\s+HISTORY)|JOB(?:\s+HISTORY))[\s\*•:\-_\|\#]*$/i, 
      name: 'EXPERIENCE',
      priority: 9,
      synonyms: ['WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'PROFESSIONAL EXPERIENCE', 'CAREER HISTORY', 'JOB HISTORY']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:REFERENCES|PROFESSIONAL(?:\s+REFERENCES)|RECOMMENDATIONS)[\s\*•:\-_\|\#]*$/i, 
      name: 'REFERENCES',
      priority: 3,
      synonyms: ['PROFESSIONAL REFERENCES', 'RECOMMENDATIONS']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EXPECTATIONS|WHAT(?:\s+TO)?(?:\s+EXPECT)|JOB(?:\s+EXPECTATIONS)|ROLE(?:\s+REQUIREMENTS))[\s\*•:\-_\|\#]*$/i, 
      name: 'EXPECTATIONS',
      priority: 4,
      synonyms: ['WHAT TO EXPECT', 'JOB EXPECTATIONS', 'ROLE REQUIREMENTS']
    }
  ];
  
  // Extract contact information (usually at the top)
  const headerEndIndex = Math.min(12, lines.length);
  const headerContent: string[] = [];
  
  // Look for typical header content including name and contact details
  for (let i = 0; i < headerEndIndex; i++) {
    const line = lines[i].trim();
    
    // Skip likely section headers
    if (line.match(/^[\s*•\-\|\#]?\s*[A-Z][A-Z\s]+:?/)) {
      continue;
    }
    
    // Check for typical contact information patterns
    if (line.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/i) || // Name pattern
        line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/) || // Email
        line.match(/\b(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/) || // Phone
        line.match(/linkedin\.com\/in\//) || // LinkedIn URL
        line.match(/github\.com\//) || // GitHub URL
        line.match(/^\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Za-z\s]+/) || // Address pattern
        (i < 3 && line.length > 0)) { // First few non-empty lines
      
      headerContent.push(line);
    }
  }
  
  // Store header content if found
  if (headerContent.length > 0) {
    sections['Header'] = headerContent.join('\n');
    logger.info(`Extracted header with ${headerContent.length} lines of contact information`);
  }
  
  let currentSection = '';
  let sectionContent: string[] = [];
  let foundFirstSection = false;
  
  // Special handling for profile - often the first substantive paragraph after contact info
  let potentialProfile = '';
  let inProfileParagraph = false;

  // Process each line with improved content extraction, focusing on actual profile content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Check if this line is a section header using our patterns
    let matchedSection = '';
    let matchPriority = 0;
    
    for (const pattern of sectionPatterns) {
      if (pattern.regex.test(line)) {
        matchedSection = pattern.name;
        matchPriority = pattern.priority || 0;
        logger.info(`Found section header: ${matchedSection} in line: "${line.substring(0, 50)}..." with priority ${matchPriority}`);
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
      // Skip section content lines that are just headers themselves (all caps and short)
      if (line.toUpperCase() === line && line.length < 15 && !line.match(/^[\d\.\-•]+/) && !line.includes(':')) {
        logger.info(`Skipping likely header within section: "${line}"`);
        continue;
      }
      
      // Add to current section
      sectionContent.push(line);
    } else if (!foundFirstSection && !inProfileParagraph && line.length > 20 && 
              !sections['PROFILE'] && 
              !line.includes('@') && !line.includes('http') && 
              !/^\+?[\d\s()-]{7,}$/.test(line) &&
              !/^[A-Z][A-Z\s]+$/.test(line)) { // Skip all-caps header lines
      // If we haven't found a section yet and this is a substantial non-contact-info line
      // treat it as the profile
      potentialProfile = line;
      inProfileParagraph = true;
      logger.info(`Found potential profile paragraph starting with: "${line.substring(0, 50)}..."`);
    } else if (inProfileParagraph) {
      // Continue adding to the profile paragraph
      if (line.trim().length > 0 && !line.match(/^[A-Z][A-Z\s]+$/) && line.length > 5) {
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
  
  // If we still don't have a profile, attempt to extract it from the text more comprehensively
  if (!sections['PROFILE']) {
    logger.info('No profile section found, attempting to extract one from CV content');
    
    // First try to extract a substantive paragraph from the beginning of the CV
    let bestProfileCandidate = '';
    let bestCandidateScore = 0;
    
    // Look through first 20% of the document for potential profile paragraphs
    const searchDepth = Math.min(30, Math.ceil(lines.length * 0.2));
    
    // Skip header lines and look for a substantive paragraph
    for (let i = headerContent.length; i < searchDepth; i++) {
      const line = lines[i].trim();
      
      // Skip section headers, short lines, and bullet points
      if (line.match(/^[A-Z][A-Z\s]+:?$/) || 
          line.length < 40 || 
          line.startsWith('•') || 
          line.startsWith('-') ||
          line.match(/^\d+\./)) {
        continue;
      }
      
      // Calculate a "profile likelihood score" based on content
      let score = line.length / 15; // Longer text gets higher score
      
      // Boost score for lines with profile-related keywords
      const profileKeywords = [
        'professional', 'experienced', 'skilled', 'background', 
        'expertise', 'years of experience', 'career', 
        'passionate', 'dedicated', 'seeking', 'opportunity',
        'summary', 'profile', 'about me', 'qualified', 'specialist',
        'knowledge', 'capabilities', 'strengths', 'track record'
      ];
      
      profileKeywords.forEach(keyword => {
        if (line.toLowerCase().includes(keyword)) {
          score += 2;
        }
      });
      
      // Extra boost for first-person language which is common in profiles
      if (line.match(/\b(I am|I have|I possess|My|I'm)\b/i)) {
        score += 3;
      }
      
      // Position boost - paragraphs closer to the top are more likely to be profiles
      score += (searchDepth - i) / 5;
      
      // Penalize lines that look like job titles or company names
      if (line.includes(' at ') || line.includes(' - ') || line.match(/\b(inc|ltd|llc|corp)\b/i)) {
        score -= 3;
      }
      
      // Update best candidate if this one is better
      if (score > bestCandidateScore) {
        bestProfileCandidate = line;
        bestCandidateScore = score;
        
        // Check if this is part of a paragraph and include adjacent lines
        let j = i + 1;
        while (j < lines.length && 
               lines[j].trim().length > 20 && 
               !lines[j].match(/^[A-Z][A-Z\s]+:?$/) && 
               !lines[j].startsWith('•') && 
               !lines[j].startsWith('-') &&
               !lines[j].match(/^\d+\./)) {
          bestProfileCandidate += '\n' + lines[j].trim();
          j++;
        }
      }
    }
    
    // If we found a good candidate, use it
    if (bestProfileCandidate && bestCandidateScore > 5) {
      sections['PROFILE'] = bestProfileCandidate;
      logger.info(`Extracted profile from CV with score ${bestCandidateScore}`);
    } else if (potentialProfile && potentialProfile.length > 50) {
      // Use our potential profile if it's substantial
      sections['PROFILE'] = potentialProfile;
      logger.info('Using previously identified potential profile paragraph');
    } else {
      // Use first 1-2 paragraphs if no good candidate was found
      const firstParas = lines.filter(line => 
        line.trim().length > 40 && 
        !line.match(/^[A-Z][A-Z\s]+:?$/) && 
        !line.startsWith('•') && 
        !line.startsWith('-') &&
        !line.match(/^\d+\./)
      ).slice(0, 2).join('\n');
      
      if (firstParas.length > 50) {
        sections['PROFILE'] = firstParas;
        logger.info('Using first substantial paragraphs as profile');
      } else {
        // Last resort: create a generic profile using name if available
        const nameMatch = headerContent.length > 0 ? 
                         headerContent[0].match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) : 
                         text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/);
        
        const name = nameMatch ? nameMatch[1] : "Professional";
        sections['PROFILE'] = `${name} is a professional with relevant experience and skills.`;
        logger.info('Created minimal PROFILE section using name from CV');
      }
    }
  }
  
  // Ensure ACHIEVEMENTS section exists
  if (!sections['ACHIEVEMENTS']) {
    logger.info('Looking for possible ACHIEVEMENTS content');
    
    // Look for achievements content by searching for paragraphs with achievement indicators
    const achievementIndicators = [
      /accomplished/i, /achieved/i, /improved/i, /increased/i, /decreased/i, 
      /reduced/i, /delivered/i, /launched/i, /created/i, /developed/i,
      /implemented/i, /managed/i, /led/i, /awarded/i, /recognized/i,
      /\d+%/i, /success/i, /award/i, /certification/i, /honor/i
    ];
    
    // Find content that looks like achievements
    const achievementContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for bullet points or numbered lists (common for achievements)
      const isBulletOrNumbered = line.trim().startsWith('•') || 
                                 line.trim().startsWith('-') || 
                                 line.match(/^\d+\./);
      
      // Check for achievement indicators
      const hasIndicator = achievementIndicators.some(regex => regex.test(line));
      
      // Check for quantifiable results
      const hasQuantifiableResults = /\d+%|\$\d+|\d+ million|\d+ thousand|\d+ projects/i.test(line);
      
      return (isBulletOrNumbered && (hasIndicator || hasQuantifiableResults)) || 
             (hasIndicator && hasQuantifiableResults);
    });
    
    if (achievementContent.length > 0) {
      sections['ACHIEVEMENTS'] = achievementContent.join('\n');
      logger.info(`Created ACHIEVEMENTS section with ${achievementContent.length} lines of content`);
    }
  }

  // Ensure GOALS section exists
  if (!sections['GOALS']) {
    logger.info('Looking for possible GOALS content');
    
    // Look for goals content by searching for paragraphs with goals/objectives indicators
    const goalIndicators = [
      /seeking/i, /goal/i, /objective/i, /aspire/i, /aspiration/i, 
      /aim/i, /target/i, /hope/i, /plan/i, /intention/i,
      /looking to/i, /interested in/i, /desire to/i, /wish to/i
    ];
    
    // Find content that looks like goals/objectives
    const goalContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for goal indicators
      const hasIndicator = goalIndicators.some(regex => regex.test(line));
      
      // Check for future-oriented language
      const hasFutureOrientation = /to become|to advance|to develop|to grow|to achieve|to acquire|to obtain|to establish/i.test(line);
      
      return hasIndicator || hasFutureOrientation;
    });
    
    if (goalContent.length > 0) {
      sections['GOALS'] = goalContent.join('\n');
      logger.info(`Created GOALS section with ${goalContent.length} lines of content`);
    }
  }

  // Ensure EXPECTATIONS section exists
  if (!sections['EXPECTATIONS']) {
    logger.info('Looking for possible EXPECTATIONS content');
    
    // Look for expectations content by searching for relevant indicators
    const expectationIndicators = [
      /expect/i, /anticipate/i, /looking for/i, /seeking/i, /desire/i, 
      /work environment/i, /company culture/i, /team dynamics/i, /work-life balance/i,
      /opportunity for/i, /chance to/i, /hope to/i, /would like to/i,
      /ideal role/i, /ideal position/i, /ideal job/i, /perfect job/i
    ];
    
    // Find content that looks like expectations
    const expectationContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for expectation indicators
      const hasIndicator = expectationIndicators.some(regex => regex.test(line));
      
      // Check for phrases about the workplace or job
      const hasWorkplacePhrase = /workplace|company|organization|team|culture|environment|position|role|job|career|growth|development|advancement/i.test(line);
      
      return hasIndicator && hasWorkplacePhrase;
    });
    
    if (expectationContent.length > 0) {
      sections['EXPECTATIONS'] = expectationContent.join('\n');
      logger.info(`Created EXPECTATIONS section with ${expectationContent.length} lines of content`);
    }
  }

  // Ensure LANGUAGES section exists
  if (!sections['LANGUAGES']) {
    logger.info('Looking for possible LANGUAGES content');
    
    // Common language patterns
    const languagePatterns = [
      /english|spanish|french|german|italian|chinese|japanese|russian|arabic|portuguese|dutch|swedish|norwegian|finnish|danish|korean|hindi|urdu|bengali|punjabi|tamil|telugu|marathi|gujarati|kannada|malayalam|polish|turkish|vietnamese|thai|indonesian|malay|filipino|czech|slovak|hungarian|romanian|bulgarian|greek|hebrew|farsi|swahili/i
    ];
    
    // Find content that mentions languages
    const languageContent = lines.filter(line => {
      if (line.length > 80) return false; // Language listings tend to be short
      
      // Check for language names
      const hasLanguage = languagePatterns.some(regex => regex.test(line));
      
      // Check for proficiency indicators
      const hasProficiencyIndicator = /native|fluent|proficient|intermediate|beginner|basic|advanced|business|professional|working|knowledge/i.test(line);
      
      return hasLanguage && (hasProficiencyIndicator || line.includes(':') || line.includes('-'));
    });
    
    if (languageContent.length > 0) {
      sections['LANGUAGES'] = languageContent.join('\n');
      logger.info(`Created LANGUAGES section with ${languageContent.length} lines of content`);
    }
  }

  // Enhance EXPERIENCE detection
  if (!sections['EXPERIENCE']) {
    logger.info('Looking for work experience content with improved detection');
    
    // Improved detection for work experience entries
    const experienceIndicators = [
      // Date patterns
      /\b\d{4}\s*(-|–|—|to)\s*(\d{4}|present|current)/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4}\s*(-|–|—|to)/i,
      
      // Job title patterns
      /\b(senior|junior|lead|chief|head|principal|director|manager|supervisor|coordinator|specialist|analyst|engineer|developer|consultant|associate|assistant)\b/i,
      
      // Company indicators
      /\bat\b|\bfor\b|\bcompany\b|\binc\b|\bltd\b|\bcorp\b|\bcorporation\b/i
    ];
    
    // Find groups of adjacent lines that look like work experience entries
    let experienceBlocks: string[][] = [];
    let currentBlock: string[] = [];
    let inExperienceBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inExperienceBlock && currentBlock.length > 0) {
          experienceBlocks.push(currentBlock);
          currentBlock = [];
          inExperienceBlock = false;
        }
        continue;
      }
      
      // Check if this line has experience indicators
      const hasExperienceIndicator = experienceIndicators.some(regex => regex.test(line));
      
      // If we find a line that looks like a job title or contains dates
      if (hasExperienceIndicator) {
        if (!inExperienceBlock) {
          inExperienceBlock = true;
          currentBlock = [line];
        } else {
          // If already in block and found a new entry, save current and start new
          if (line.length < 60 && (line.match(/\b\d{4}\b/) || /^[A-Z]/.test(line))) {
            experienceBlocks.push(currentBlock);
            currentBlock = [line];
          } else {
            currentBlock.push(line);
          }
        }
      } 
      // If we're already collecting an experience block, keep adding lines
      else if (inExperienceBlock) {
        currentBlock.push(line);
      }
    }
    
    // Add the last block if there is one
    if (inExperienceBlock && currentBlock.length > 0) {
      experienceBlocks.push(currentBlock);
    }
    
    // If we found experience blocks, join them with appropriate spacing
    if (experienceBlocks.length > 0) {
      const experienceContent = experienceBlocks
        .map(block => block.join('\n'))
        .join('\n\n');
      
      sections['EXPERIENCE'] = experienceContent;
      logger.info(`Created EXPERIENCE section with ${experienceBlocks.length} entries`);
    }
  }

  // Enhance EDUCATION detection
  if (!sections['EDUCATION']) {
    logger.info('Looking for education content with improved detection');
    
    // Education indicators
    const educationIndicators = [
      /\b(university|college|institute|school|academy|bachelor|master|ph\.?d|diploma|degree|certification|certificate)\b/i,
      /\b(bsc|ba|bs|ms|msc|ma|mba|phd|doctorate|postgraduate|undergraduate)\b/i,
      /\b\d{4}\s*(-|–|—|to)\s*(\d{4}|present)/i, // Date ranges
      /\beducation\b/i
    ];
    
    // Find content that looks like education entries
    const educationContent: string[] = [];
    let inEducationBlock = false;
    let currentEducationEntry: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inEducationBlock && currentEducationEntry.length > 0) {
          educationContent.push(currentEducationEntry.join('\n'));
          currentEducationEntry = [];
          inEducationBlock = false;
        }
        continue;
      }
      
      // Check if this line has education indicators
      const hasEducationIndicator = educationIndicators.some(regex => regex.test(line));
      
      if (hasEducationIndicator) {
        if (!inEducationBlock) {
          inEducationBlock = true;
          currentEducationEntry = [line];
        } else {
          // If line seems like a new entry (starts with date or capital letter and is short)
          if (line.length < 60 && (line.match(/\b\d{4}\b/) || /^[A-Z]/.test(line))) {
            educationContent.push(currentEducationEntry.join('\n'));
            currentEducationEntry = [line];
          } else {
            currentEducationEntry.push(line);
          }
        }
      } 
      // If we're already collecting an education block, keep adding lines
      else if (inEducationBlock) {
        currentEducationEntry.push(line);
      }
    }
    
    // Add the last entry if there is one
    if (inEducationBlock && currentEducationEntry.length > 0) {
      educationContent.push(currentEducationEntry.join('\n'));
    }
    
    // If we found education entries, join them with appropriate spacing
    if (educationContent.length > 0) {
      sections['EDUCATION'] = educationContent.join('\n\n');
      logger.info(`Created EDUCATION section with ${educationContent.length} entries`);
    }
  }
  
  logger.info(`Parsed ${Object.keys(sections).length} sections from optimized text`);
  return sections;
} 