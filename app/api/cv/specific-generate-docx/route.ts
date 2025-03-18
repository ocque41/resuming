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
  const sections = await parseOptimizedText(cvText);
  
  // Log all detected sections to help with debugging
  logger.info(`Detected sections: ${Object.keys(sections).join(', ')}`);
  
  // Check for sections that might have been detected with slightly different names
  // and normalize them to our expected section names
  const normalizedSections: Record<string, string | string[]> = { ...sections };
  
  // Section name normalization map
  const sectionNormalizationMap: Record<string, string> = {
    'SUMMARY': 'PROFILE',
    'PROFESSIONAL SUMMARY': 'PROFILE',
    'EXECUTIVE SUMMARY': 'PROFILE',
    'ABOUT ME': 'PROFILE',
    'WORK EXPERIENCE': 'EXPERIENCE',
    'EMPLOYMENT HISTORY': 'EXPERIENCE',
    'PROFESSIONAL EXPERIENCE': 'EXPERIENCE',
    'WORK HISTORY': 'EXPERIENCE',
    'TECHNICAL EXPERTISE': 'TECHNICAL SKILLS',
    'TECH SKILLS': 'TECHNICAL SKILLS',
    'CORE SKILLS': 'SKILLS',
    'KEY SKILLS': 'SKILLS',
    'SOFT SKILLS': 'PROFESSIONAL SKILLS',
    'INTERPERSONAL SKILLS': 'PROFESSIONAL SKILLS',
    'LANGUAGE PROFICIENCY': 'LANGUAGES',
    'LANGUAGE SKILLS': 'LANGUAGES',
    'LANGUAGE KNOWLEDGE': 'LANGUAGES',
    'LANGUAGE PROFICIENCIES': 'LANGUAGES',
    'ACCOMPLISHMENTS': 'ACHIEVEMENTS',
    'KEY ACHIEVEMENTS': 'ACHIEVEMENTS',
    'CERTIFICATIONS': 'CERTIFICATES',
    'QUALIFICATIONS': 'EDUCATION'
  };
  
  // Normalize section names
  Object.keys(sections).forEach(sectionName => {
    const normalizedName = sectionNormalizationMap[sectionName];
    if (normalizedName && !normalizedSections[normalizedName]) {
      logger.info(`Normalizing section name from "${sectionName}" to "${normalizedName}"`);
      normalizedSections[normalizedName] = sections[sectionName];
      // Keep the original section too for now
    }
  });
  
  // Merge PROFILE and SUMMARY sections to avoid duplication
  if (normalizedSections['PROFILE'] || normalizedSections['SUMMARY']) {
    // Get content from both sections
    const profileContent = typeof normalizedSections['PROFILE'] === 'string' 
      ? normalizedSections['PROFILE'] 
      : Array.isArray(normalizedSections['PROFILE']) ? normalizedSections['PROFILE'].join('\n') : '';
    
    const summaryContent = typeof normalizedSections['SUMMARY'] === 'string' 
      ? normalizedSections['SUMMARY'] 
      : Array.isArray(normalizedSections['SUMMARY']) ? normalizedSections['SUMMARY'].join('\n') : '';
    
    // Create a combined profile
    let combinedProfile = '';
    
    // If both exist, merge them intelligently
    if (profileContent && summaryContent) {
      // Check for substantial overlap (80% or more similarity)
      const profileWords = new Set(profileContent.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const summaryWords = summaryContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      let matchCount = 0;
      for (const word of summaryWords) {
        if (profileWords.has(word)) matchCount++;
      }
      
      const similarityRatio = summaryWords.length > 0 ? matchCount / summaryWords.length : 0;
      
      if (similarityRatio > 0.8) {
        // If very similar, just use the longer one
        combinedProfile = profileContent.length >= summaryContent.length ? profileContent : summaryContent;
        logger.info(`PROFILE and SUMMARY are ${Math.round(similarityRatio * 100)}% similar, using longer content`);
      } else {
        // If sufficiently different, combine them
        combinedProfile = profileContent + (profileContent && summaryContent ? '\n\n' : '') + summaryContent;
        logger.info('Combined different PROFILE and SUMMARY sections');
      }
    } else {
      // Use whichever one exists
      combinedProfile = profileContent || summaryContent;
    }
    
    // Store the combined profile back to PROFILE
    normalizedSections['PROFILE'] = combinedProfile;
    
    // Remove SUMMARY to avoid duplication
    if (normalizedSections['SUMMARY']) {
      delete normalizedSections['SUMMARY'];
    }
  }
  
  // Enhanced skills section deduplication logic
  // Step 1: Handle all skills-related sections together 
  const skillSectionNames = ['SKILLS', 'TECHNICAL SKILLS', 'PROFESSIONAL SKILLS'];
  const presentSkillSections = skillSectionNames.filter(name => normalizedSections[name]);
  
  if (presentSkillSections.length > 1) {
    logger.info(`Multiple skill sections detected: ${presentSkillSections.join(', ')}`);
    
    // Process each skills section into a standardized format (array of skills)
    const processedSkills: Record<string, string[]> = {};
    const skillWords = new Set<string>(); // Tracks unique skill words for better deduplication
    
    for (const sectionName of presentSkillSections) {
      // Get content and convert to array
      let skillsContent = normalizedSections[sectionName];
      let skillsArray = Array.isArray(skillsContent) ? [...skillsContent] : [skillsContent];
      
      // Process into individual skills
      skillsArray = skillsArray
        .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
        .map(skill => typeof skill === 'string' ? skill.trim() : skill)
        .filter(skill => {
          if (typeof skill !== 'string' || skill.length === 0) {
            return false;
          }
          
          // Remove section headers, social media mentions, and fragments that don't look like skills
          const isSkillLike = (
            // Exclude section headers
            !skill.toUpperCase().includes(sectionName) &&
            !skill.toUpperCase().includes('TECHNICAL') &&
            !skill.toUpperCase().includes('PROFESSIONAL') &&
            !skill.toUpperCase().includes('SKILL') &&
            
            // Exclude social media references
            !skill.match(/\b(facebook|twitter|instagram|linkedin|tiktok|threads|youtube)\b/i) &&
            
            // Exclude generic fragments
            !skill.match(/\b(for yourself|including|or organizations|etc\.?|brands)\b/i) &&
            
            // Exclude long phrases that are likely job description fragments
            skill.split(' ').length <= 6 &&
            
            // Skill should start with a letter or bullet point, not symbols or punctuation
            skill.match(/^[•\-\*\s]*[a-z0-9]/i) &&
            
            // Should have at least 2 characters to be meaningful
            skill.replace(/[•\-\*\s]/g, '').length >= 2
          );
          
          return isSkillLike;
        });
      
      // Further clean skill items - remove leading bullets if we'll add our own
      skillsArray = skillsArray.map(skill => {
        if (typeof skill === 'string') {
          return skill.replace(/^[•\-\*\s]+/, '');
        }
        return skill;
      });
      
      // Store processed array
      processedSkills[sectionName] = skillsArray as string[];
      
      // Add to skill words for comparison
      for (const skill of skillsArray) {
        if (typeof skill === 'string') {
          const words = skill.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
          for (const word of words) {
            skillWords.add(word);
          }
        }
      }
    }
    
    // Prioritizing specific skill sections over generic ones
    if (processedSkills['TECHNICAL SKILLS'] || processedSkills['PROFESSIONAL SKILLS']) {
      // If we have specific skill sections, remove the generic SKILLS section
      if (normalizedSections['SKILLS']) {
        logger.info('Deleting generic SKILLS section since we have specific skill sections');
        delete normalizedSections['SKILLS'];
      }
    }
    
    // Deduplicate between TECHNICAL SKILLS and PROFESSIONAL SKILLS
    if (processedSkills['TECHNICAL SKILLS'] && processedSkills['PROFESSIONAL SKILLS']) {
      const techSkills = processedSkills['TECHNICAL SKILLS'];
      const techSkillsLower = techSkills.map((s: string) => typeof s === 'string' ? s.toLowerCase() : '');
      
      // Remove duplicates from professional skills
      processedSkills['PROFESSIONAL SKILLS'] = processedSkills['PROFESSIONAL SKILLS'].filter((skill: string) => {
        if (typeof skill !== 'string') return false;
        
        // Check for exact matches
        if (techSkillsLower.includes(skill.toLowerCase())) return false;
        
        // Check for high similarity in words
        const skillWords = skill.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        if (skillWords.length === 0) return true;
        
        // For each tech skill, check if it contains most of the words in this professional skill
        for (const techSkill of techSkillsLower) {
          const techWords = techSkill.split(/\s+/).filter((w: string) => w.length > 3);
          let matchCount = 0;
          for (const word of skillWords) {
            if (techWords.includes(word)) matchCount++;
          }
          
          // If 80% or more words match, consider it a duplicate
          if (skillWords.length > 0 && matchCount / skillWords.length > 0.8) {
            return false;
          }
        }
        
        return true;
      });
      
      // Update sections with deduplicated content
      normalizedSections['TECHNICAL SKILLS'] = processedSkills['TECHNICAL SKILLS'];
      normalizedSections['PROFESSIONAL SKILLS'] = processedSkills['PROFESSIONAL SKILLS'];
      
      logger.info(`After deduplication: TECHNICAL SKILLS has ${processedSkills['TECHNICAL SKILLS'].length} items, PROFESSIONAL SKILLS has ${processedSkills['PROFESSIONAL SKILLS'].length} items`);
      
      // If either section is now empty, remove it
      if (processedSkills['PROFESSIONAL SKILLS'].length === 0) {
        logger.info('Removed PROFESSIONAL SKILLS section as all items were duplicates of TECHNICAL SKILLS');
        delete normalizedSections['PROFESSIONAL SKILLS'];
      }
      
      if (processedSkills['TECHNICAL SKILLS'].length === 0) {
        logger.info('Removed TECHNICAL SKILLS section as all items were duplicates');
        delete normalizedSections['TECHNICAL SKILLS'];
      }
    }
  }
  
  // Rename 'SKILLS' to 'OTHER SKILLS' if we have both technical/professional and general skills
  // to better distinguish between them in the final document
  if (normalizedSections['SKILLS'] && (normalizedSections['TECHNICAL SKILLS'] || normalizedSections['PROFESSIONAL SKILLS'])) {
    normalizedSections['OTHER SKILLS'] = normalizedSections['SKILLS'];
    delete normalizedSections['SKILLS'];
    // Update section order to include OTHER SKILLS
    const otherSkillsIndex = sectionOrder.indexOf('SKILLS');
    if (otherSkillsIndex !== -1) {
      sectionOrder[otherSkillsIndex] = 'OTHER SKILLS';
    }
    logger.info('Renamed generic SKILLS section to OTHER SKILLS for clarity');
  }
  
  // Apply job-specific tailoring if job description is provided
  // Using 80/20 approach: 80% original CV content, 20% job-specific enhancements
  logger.info('Applying job-specific tailoring to CV sections using 80/20 preservation approach');
  const tailoredSections = jobDescription 
    ? await tailorCVContentForJob(sections, jobDescription, jobTitle, companyName)
    : sections;
  
  // More detailed logging for debugging section parsing
  const sectionSummary = Object.entries(tailoredSections).map(([key, value]) => {
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
    text: 'Curriculum Vitae', // Always use simple title without including job info
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
  const processedSections = new Set(); // Track sections we've already processed
  
  for (const section of sectionOrder) {
    // Skip if section doesn't exist
    if (!tailoredSections[section]) {
      logger.info(`Skipping ${section} section as it doesn't exist`);
      continue;
    }
    
    // Skip if we've already processed an equivalent section
    if (processedSections.has(section)) {
      logger.info(`Skipping ${section} section as it was already processed`);
      continue;
    }
    
    // Skip if this is SUMMARY and we already processed PROFILE
    if (section === 'SUMMARY' && processedSections.has('PROFILE')) {
      logger.info('Skipping SUMMARY section as PROFILE was already processed');
      continue;
    }
    
    // Skip SKILLS section if we have specific skills sections
    if (section === 'SKILLS' && (tailoredSections['TECHNICAL SKILLS'] || tailoredSections['PROFESSIONAL SKILLS'])) {
      logger.info('Skipping generic SKILLS section as specific skills sections exist');
      continue;
    }
    
    // Get content for this section
    const content = tailoredSections[section];
    
    // Mark this section as processed
    processedSections.add(section);
    
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
    // Special handling for Experience section with enhanced formatting
    else if (section === 'EXPERIENCE') {
      // Add experience header with special formatting
      const experienceHeader = new Paragraph({
        text: 'Experience',
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
      paragraphs.push(experienceHeader);
      
      // Process experience content with enhanced formatting
      if (typeof content === 'string') {
        const contentLines = content.split('\n').filter(line => line.trim());
        
        let currentJobTitle = '';
        let currentCompanyDates = '';
        let inJobBlock = false;
        
        for (const line of contentLines) {
          if (!line.trim()) continue;
          
          // Check if this is a likely job title or company+date line
          const isLikelyTitleOrCompany = line.length < 60 && 
                                      /^[A-Z]/.test(line) && 
                                      !line.startsWith('•') && 
                                      !line.startsWith('-') && 
                                      !line.startsWith('*');
          
          // Check if this line contains a date (for experience entries)
          const containsDate = line.match(/\b(19|20)\d{2}\b/) || 
                              line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i) ||
                              line.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i) ||
                              line.match(/\bpresent\b/i) ||
                              line.match(/\bcurrent\b/i);
          
          // Check if this is a bullet point or responsibility
          const isBulletPoint = line.trim().match(/^[•\-\*]/) || line.match(/^[\s]{2,}/);
          
          if (isLikelyTitleOrCompany && containsDate) {
            // This is likely a job title with dates or company with dates
            if (inJobBlock) {
              // Add some space between job entries
              paragraphs.push(new Paragraph({ spacing: { before: 200, after: 0 } }));
            }
            
            // Create bold paragraph for the job title/company line
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.trim(),
                    bold: true,
                    size: 26,
                  }),
                ],
                spacing: {
                  before: 240,
                  after: 120,
                },
              })
            );
            
            inJobBlock = true;
            currentJobTitle = line.trim();
          } 
          else if (isLikelyTitleOrCompany && inJobBlock && currentJobTitle && !currentCompanyDates) {
            // This might be a company name that follows the job title
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.trim(),
                    bold: true,
                    italics: true,
                    size: 24,
                  }),
                ],
                spacing: {
                  before: 60,
                  after: 120,
                },
              })
            );
            
            currentCompanyDates = line.trim();
          }
          else if (isBulletPoint || (!isLikelyTitleOrCompany && inJobBlock)) {
            // This is likely a responsibility or achievement under the job
            // Clean up bullet points
            const cleanContent = line.trim().replace(/^[•\-\*\s]+/, '').trim();
            
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: cleanContent,
                    size: 24,
                  }),
                ],
                bullet: isBulletPoint ? { level: 0 } : undefined,
                spacing: {
                  before: 60,
                  after: 60,
                },
                indent: {
                  left: isBulletPoint ? 720 : 360,
                  hanging: isBulletPoint ? 360 : 0,
                },
              })
            );
          }
          else {
            // Regular text - could be a standalone line
            paragraphs.push(
              new Paragraph({
                text: line.trim(),
                spacing: {
                  before: 120,
                  after: 120,
                },
              })
            );
          }
        }
      } else if (Array.isArray(content)) {
        // Handle array content for experience
        for (const item of content) {
          if (!item.trim()) continue;
          
          // Similar logic as above but for array items
          const isLikelyTitleOrCompany = item.length < 60 && 
                                       /^[A-Z]/.test(item) && 
                                       !item.startsWith('•') && 
                                       !item.startsWith('-') && 
                                       !item.startsWith('*');
                                       
          const containsDate = item.match(/\b(19|20)\d{2}\b/) || 
                              item.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i) ||
                              item.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i) ||
                              item.match(/\bpresent\b/i) ||
                              item.match(/\bcurrent\b/i);
                              
          const isBulletPoint = item.trim().match(/^[•\-\*]/) || item.match(/^[\s]{2,}/);
          
          if (isLikelyTitleOrCompany && containsDate) {
            // Job title with dates
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.trim(),
                    bold: true,
                    size: 26,
                  }),
                ],
                spacing: {
                  before: 240,
                  after: 120,
                },
              })
            );
          } else if (isBulletPoint) {
            // Bullet point responsibility
            const cleanContent = item.trim().replace(/^[•\-\*\s]+/, '').trim();
            
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: cleanContent,
                    size: 24,
                  }),
                ],
                bullet: { level: 0 },
                spacing: {
                  before: 60,
                  after: 60,
                },
                indent: {
                  left: 720,
                  hanging: 360,
                },
              })
            );
          } else {
            // Regular content
            paragraphs.push(
              new Paragraph({
                text: item.trim(),
                spacing: {
                  before: 120,
                  after: 120,
                },
              })
            );
          }
        }
      }
      
      continue; // Skip the generic content handling
    }
    // Special handling for Languages
    else if (section === 'LANGUAGES') {
      logger.info(`Processing languages section with content: ${typeof content === 'string' ? content.substring(0, 50) + '...' : 'array'}`);
      
      paragraphs.push(
        new Paragraph({
          text: 'Languages',
          heading: HeadingLevel.HEADING_2,
          thematicBreak: true,
          spacing: {
            before: 200,
            after: 120,
          },
        })
      );
      
      // Normalize the content into an array
      let languageItems: string[] = [];
      
      if (typeof content === 'string') {
        // Split by common delimiters
        languageItems = content
          .split(/[,;\n]/)
          .map(lang => lang.trim())
          .filter(lang => lang.length > 0 && 
                 !/^languages|language skills|language proficiency|fluent in/i.test(lang));
      } else if (Array.isArray(content)) {
        languageItems = content
          .filter(item => item.trim().length > 0 && 
                 !/^languages|language skills|language proficiency|fluent in/i.test(item));
      }
      
      // Log the number of language items found
      logger.info(`Found ${languageItems.length} language items to process`);
      
      // Process each language
      const processedLanguages = new Map<string, string>(); // Map of language name to proficiency
      
      // Common proficiency levels for normalization
      const proficiencyLevels = [
        'Native', 'Fluent', 'Proficient', 'Advanced', 'Intermediate', 'Basic', 'Beginner'
      ];
      
      // Extract language name and proficiency from each item
      for (const item of languageItems) {
        // Check for common separators
        const hasSeparator = item.includes(':') || item.includes('-') || item.includes('–') || 
                            item.includes('(') || item.includes(',');
        
        let languageName = item.trim();
        let proficiencyLevel = '';
        
        // Parse based on separator type
        if (hasSeparator) {
          if (item.includes(':')) {
            const [name, level] = item.split(':', 2);
            languageName = name.trim();
            proficiencyLevel = level.trim();
          } else if (item.includes('-') || item.includes('–')) {
            const parts = item.split(/[-–]/);
            if (parts.length >= 2) {
              languageName = parts[0].trim();
              proficiencyLevel = parts.slice(1).join(' - ').trim();
            }
          } else if (item.includes('(')) {
            const match = item.match(/^(.*?)\s*\((.*?)\)$/);
            if (match) {
              languageName = match[1].trim();
              proficiencyLevel = match[2].trim();
            }
          } else if (item.includes(',')) {
            const parts = item.split(',');
            if (parts.length >= 2) {
              languageName = parts[0].trim();
              proficiencyLevel = parts.slice(1).join(', ').trim();
            }
          }
        } else {
          // Check if the item contains any known proficiency level
          for (const level of proficiencyLevels) {
            if (item.toLowerCase().includes(level.toLowerCase())) {
              const levelIndex = item.toLowerCase().indexOf(level.toLowerCase());
              languageName = item.substring(0, levelIndex).trim();
              proficiencyLevel = item.substring(levelIndex).trim();
              break;
            }
          }
        }
        
        // If we have a recognized language, add or update it
        if (languageName && languageName.length > 1) {
          // Normalize the language name (capitalize first letter)
          languageName = languageName.charAt(0).toUpperCase() + languageName.slice(1).toLowerCase();
          
          // Only add proficiency if it's not already in the language name
          if (proficiencyLevel && !languageName.toLowerCase().includes(proficiencyLevel.toLowerCase())) {
            processedLanguages.set(languageName, proficiencyLevel);
          } else {
            processedLanguages.set(languageName, '');
          }
        }
      }
      
      // Add the processed languages to the document
      for (const [language, proficiency] of processedLanguages.entries()) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: language,
                bold: true,
                size: 24,
              }),
              ...(proficiency ? [
                new TextRun({
                  text: ` - ${proficiency}`,
                  italics: true,
                  size: 24,
                }),
              ] : []),
            ],
            spacing: {
              before: 120,
              after: 120,
            },
          })
        );
      }
      
      continue; // Skip the generic content handling
    }
    // Special formatting for Skills sections
    else if (section === 'TECHNICAL SKILLS' || section === 'PROFESSIONAL SKILLS' || section === 'SKILLS' || section === 'OTHER SKILLS') {
      // Determine section title based on section key
      let sectionTitle;
      if (section === 'TECHNICAL SKILLS') sectionTitle = 'Technical Skills';
      else if (section === 'PROFESSIONAL SKILLS') sectionTitle = 'Professional Skills';
      else if (section === 'OTHER SKILLS') sectionTitle = 'Other Skills';
      else sectionTitle = 'Skills';
      
      // Enhanced formatting for skills sections
      const skillsHeader = new Paragraph({
        text: sectionTitle,
        heading: HeadingLevel.HEADING_2,
        spacing: {
          before: 400,
          after: 200,
        },
        thematicBreak: true,
        border: {
          bottom: {
            color: 'B4916C',
            size: 1, 
            space: 4,
            style: BorderStyle.SINGLE,
          },
        },
      });
      paragraphs.push(skillsHeader);
      
      // Handle content based on type (array or string)
      let skillItems = Array.isArray(content) ? [...content] : content.split('\n');
      
      // Specifically exclude problematic strings that look like filter artifacts or job description fragments
      const blacklistPhrases = [
        'for yourself', 'including', 'or organizations', 'etc', 'brands', 
        'currently pursuing', 'recently completed', 'undergraduate', 'graduate degree',
        'passionate', 'join our team', 'initiatives', 'requirements'
      ];
      
      // Enhanced skill filtering - only keep real skills
      skillItems = skillItems
        .map(skill => typeof skill === 'string' ? skill.trim() : '')
        .filter(skill => {
          // Skip empty skills
          if (!skill || skill.length < 2) return false;
          
          // Skip common section headers
          if (/^(SKILLS?|TECHNICAL|PROFESSIONAL|COMPETENC(Y|IES)|QUALIFICATIONS?)$/i.test(skill)) {
            return false;
          }
          
          // Skip skills containing blacklisted phrases
          for (const phrase of blacklistPhrases) {
            if (skill.toLowerCase().includes(phrase.toLowerCase())) {
              return false;
            }
          }
          
          // Keep only items that look like actual skills
          const looksLikeSkill = (
            // Not too long (real skills are typically concise)
            skill.length < 50 &&
            
            // Not a URL
            !skill.includes('http') &&
            !skill.includes('www.') &&
            
            // Not a complete sentence (too long with spaces and ending punctuation)
            !(skill.split(' ').length > 5 && skill.match(/[.!?]$/)) &&
            
            // Not a job description fragment
            !skill.includes('required') &&
            !skill.includes('preferred') &&
            !skill.includes('seeking') &&
            !skill.includes('looking for') &&
            !skill.includes('join our') &&
            !skill.includes('ideal candidate')
          );
          
          return looksLikeSkill;
        });
      
      // If we have too few skills, add more from common skills or extract from job description
      if (skillItems.length < 5 && jobDescription) {
        logger.info(`Too few skills found (${skillItems.length}), extracting from job description`);
        const extractedSkills = extractSkillsFromJobDescription(jobDescription);
        
        // Only add skills that aren't already in the list
        for (const skill of extractedSkills) {
          if (!skillItems.some(existingSkill => 
              existingSkill.toLowerCase().includes(skill.toLowerCase()) || 
              skill.toLowerCase().includes(existingSkill.toLowerCase()))) {
            skillItems.push(skill);
          }
          
          // Stop once we have a reasonable number of skills
          if (skillItems.length >= 10) break;
        }
      }
      
      // Add parenthetical context to skills without it, to make them more specific
      skillItems = skillItems.map(skill => {
        // Skip skills that already have context
        if (skill.includes('(') || skill.includes(' - ')) {
          return skill;
        }
        
        // Add context to plain skills if they're short enough
        if (skill.length < 25) {
          // Possible skill contexts based on the skill section type
          const contexts = {
            'TECHNICAL SKILLS': ['(Advanced)', '(Proficient)', '(Expert)', '(Intermediate)'],
            'PROFESSIONAL SKILLS': ['(Highly Developed)', '(Strong)', '(Expert)', '(Advanced)'],
            'SKILLS': ['(Proficient)', '(Advanced)', '(Experienced)', '(Expert)'],
            'OTHER SKILLS': ['(Proficient)', '(Working Knowledge)', '(Competent)', '(Skilled)']
          };
          
          // Get random context for the current section type
          const sectionContexts = contexts[section] || contexts['SKILLS'];
          const randomContext = sectionContexts[Math.floor(Math.random() * sectionContexts.length)];
          
          return `${skill} ${randomContext}`;
        }
        
        return skill;
      });
      
      // Clean up skill formatting - remove any remaining bullet points since we'll add our own
      skillItems = skillItems.map(skill => skill.replace(/^[•\-\*\s]+/, ''));
      
      // If we still have no skills after all processing, try to extract some from job description
      if (skillItems.length === 0 && jobDescription) {
        logger.info('No skills found after filtering, extracting from job description');
        skillItems = extractSkillsFromJobDescription(jobDescription);
      }
      
      // Further clean skill items - remove leading bullets if we'll add our own
      skillItems = skillItems.map(skill => {
        if (typeof skill === 'string') {
          return skill.replace(/^[•\-\*\s]+/, '');
        }
        return skill;
      });
      
      // Create bullet points for each skill
      for (const skill of skillItems) {
        if (typeof skill === 'string' && skill.trim()) {
          const cleanedSkill = skill.trim().replace(/^[•\-\*]+\s*/, '');
          paragraphs.push(
            new Paragraph({
              text: cleanedSkill,
              bullet: {
                level: 0
              },
              spacing: {
                before: 100,
                after: 100,
              }
            })
          );
        }
      }
      
      continue; // Skip the generic content handling for skills
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
          
          // Check if this line contains a date (for experience or education)
          const containsDate = line.includes('2023') || line.includes('2022') || 
                              line.includes('2021') || line.includes('2020') ||
                              line.includes('2019') || line.includes('2018');
          
          // Check if this is specifically education or experience content
          const isEducationOrExperience = section === 'EXPERIENCE' || section === 'EDUCATION';
          
          // Check if this is a responsibility or achievement under a job
          const isResponsibility = (section === 'EXPERIENCE' && isBulletPoint) || 
                                  (section === 'EXPERIENCE' && line.trim().length > 10 && 
                                   !isLikelyTitle && !containsDate);
          
          // Check if this is a certification or achievement under education
          const isEducationDetail = (section === 'EDUCATION' && isBulletPoint) || 
                                   (section === 'EDUCATION' && line.trim().length > 10 && 
                                    !isLikelyTitle && !containsDate);
          
          // Check if this is an ACHIEVEMENTS entry that should be highlighted
          const isAchievement = section === 'ACHIEVEMENTS' && 
                              (isBulletPoint || !!line.match(/\d+%|\$\d+|\d+ million|\d+ thousand/i));
          
          const paragraph = new Paragraph({
                      children: [
                        new TextRun({
                text: bulletContent,
                // Use bold for headers, titles, and company names
                bold: section === 'Header' || isLikelyTitle || 
                      (isEducationOrExperience && containsDate),
                // Use slightly larger size for different content types
                size: section === 'Header' ? 28 : 
                      isLikelyTitle ? 26 : 
                      (isEducationOrExperience && containsDate) ? 24 : 
                      undefined,
                // Use italics for language proficiencies, dates, and expectations
                italics: (section === 'LANGUAGES' && (line.includes(':') || line.includes('-'))) || 
                         (isEducationOrExperience && containsDate) || 
                         section === 'EXPECTATIONS',
                // Use specific color for achievements and goals to make them stand out
                color: section === 'ACHIEVEMENTS' && isBulletPoint ? 'B4916C' : 
                      (section === 'GOALS' || section === 'EXPECTATIONS') && line.length > 30 ? '555555' : 
                      undefined,
              }),
                      ],
                      spacing: {
              before: section === 'Header' ? 0 : 
                      isLikelyTitle ? 240 : 
                      (isEducationOrExperience && containsDate) ? 180 : 
                      100,
              after: section === 'Header' ? 0 : 
                     isLikelyTitle ? 100 : 
                     (isEducationOrExperience && containsDate) ? 120 : 
                     100,
              line: 300,
            },
            alignment: section === 'Header' ? AlignmentType.CENTER : 
                      isLikelyTitle ? AlignmentType.LEFT : 
                      undefined,
            bullet: isBulletPoint ? {
              level: 0,
            } : undefined,
            indent: isBulletPoint ? {
              left: 720,
              hanging: 360,
            } : isResponsibility || isEducationDetail ? {
              left: 360,
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
          
          // Add footer with company or job position information
  const footer = new Paragraph({
            children: [
              new TextRun({
        text: companyName 
            ? `For ${companyName}` 
            : jobTitle 
              ? `For ${jobTitle} Position`
              : 'Curriculum Vitae',
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
  
  // We're using the tailored sections defined earlier in the function
  
  // Create a new document
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
async function parseOptimizedText(text: string): Promise<Record<string, string | string[]>> {
  const sections: Record<string, string | string[]> = {};
  
  // Return empty sections if no text provided
  if (!text) {
    return sections;
  }
  
  // Split the text into lines for processing
  const lines = text.split('\n');
  
  // Extract a header section (usually contains contact info at the top of CV)
  const headerContent: string[] = [];
  
  // Process the first few lines to extract contact information
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip blank lines
    if (!line) continue;
    
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

  // Define section detection patterns
  const sectionPatterns = [
    { name: 'SUMMARY', regex: /^[\s*•\-\|]*(?:SUMMARY|PROFESSIONAL\s+SUMMARY|EXECUTIVE\s+SUMMARY|PROFILE\s+SUMMARY)[\s:]*$/i, priority: 5 },
    { name: 'PROFILE', regex: /^[\s*•\-\|]*(?:PROFILE|PROFESSIONAL\s+PROFILE|ABOUT(?:\s+ME)?|PERSONAL\s+STATEMENT)[\s:]*$/i, priority: 5 },
    { name: 'EXPERIENCE', regex: /^[\s*•\-\|]*(?:EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|PROFESSIONAL\s+EXPERIENCE|CAREER|WORK\s+HISTORY|PROFESSIONAL\s+BACKGROUND)[\s:]*$/i, priority: 4 },
    { name: 'EDUCATION', regex: /^[\s*•\-\|]*(?:EDUCATION|ACADEMIC\s+BACKGROUND|ACADEMIC\s+HISTORY|QUALIFICATIONS|EDUCATIONAL\s+BACKGROUND|ACADEMIC\s+QUALIFICATIONS)[\s:]*$/i, priority: 4 },
    { name: 'SKILLS', regex: /^[\s*•\-\|]*(?:SKILLS|CORE\s+SKILLS|KEY\s+SKILLS|SKILL\s+SET|COMPETENCIES|AREAS\s+OF\s+EXPERTISE)[\s:]*$/i, priority: 3 },
    { name: 'TECHNICAL SKILLS', regex: /^[\s*•\-\|]*(?:TECHNICAL\s+SKILLS|TECHNICAL\s+EXPERTISE|TECH\s+SKILLS|TECHNICAL\s+PROFICIENCIES|HARD\s+SKILLS|TECHNICAL\s+COMPETENCIES|IT\s+SKILLS)[\s:]*$/i, priority: 4 },
    { name: 'PROFESSIONAL SKILLS', regex: /^[\s*•\-\|]*(?:PROFESSIONAL\s+SKILLS|SOFT\s+SKILLS|INTERPERSONAL\s+SKILLS|CORE\s+COMPETENCIES|TRANSFERABLE\s+SKILLS|PERSONAL\s+SKILLS)[\s:]*$/i, priority: 4 },
    { name: 'LANGUAGES', regex: /^[\s*•\-\|]*(?:LANGUAGES?|LANGUAGE\s+SKILLS|LANGUAGE\s+PROFICIENCIES|LANGUAGE\s+KNOWLEDGE|FOREIGN\s+LANGUAGES|LANGUAGE\s+COMPETENCIES|LINGUISTIC\s+SKILLS)[\s:]*$/i, priority: 3 },
    { name: 'ACHIEVEMENTS', regex: /^[\s*•\-\|]*(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY\s+ACHIEVEMENTS|MAJOR\s+ACCOMPLISHMENTS|NOTABLE\s+ACHIEVEMENTS|KEY\s+ACCOMPLISHMENTS)[\s:]*$/i, priority: 3 },
    { name: 'CERTIFICATIONS', regex: /^[\s*•\-\|]*(?:CERTIFICATIONS?|CERTIFICATES?|PROFESSIONAL\s+CERTIFICATIONS?|CREDENTIALS|ACCREDITATIONS|LICENSES|PROFESSIONAL\s+QUALIFICATIONS)[\s:]*$/i, priority: 3 },
    { name: 'PROJECTS', regex: /^[\s*•\-\|]*(?:PROJECTS?|KEY\s+PROJECTS?|MAJOR\s+PROJECTS?|PROJECT\s+EXPERIENCE|SIGNIFICANT\s+PROJECTS?)[\s:]*$/i, priority: 3 },
    { name: 'PUBLICATIONS', regex: /^[\s*•\-\|]*(?:PUBLICATIONS?|PUBLISHED\s+WORKS?|PAPERS|RESEARCH\s+PUBLICATIONS?|ARTICLES|JOURNALS)[\s:]*$/i, priority: 2 },
    { name: 'REFERENCES', regex: /^[\s*•\-\|]*(?:REFERENCES?|PROFESSIONAL\s+REFERENCES?|RECOMMENDATION|REFEREES)[\s:]*$/i, priority: 1 },
    { name: 'VOLUNTEER', regex: /^[\s*•\-\|]*(?:VOLUNTEER(?:\s+EXPERIENCE)?|COMMUNITY\s+SERVICE|COMMUNITY\s+INVOLVEMENT|VOLUNTEERING|VOLUNTARY\s+WORK)[\s:]*$/i, priority: 2 },
    { name: 'INTERESTS', regex: /^[\s*•\-\|]*(?:INTERESTS?|HOBBIES|ACTIVITIES|PERSONAL\s+INTERESTS?|PASTIMES|LEISURE\s+ACTIVITIES)[\s:]*$/i, priority: 1 },
    { name: 'GOALS', regex: /^[\s*•\-\|]*(?:GOALS|CAREER\s+GOALS|OBJECTIVES?|CAREER\s+OBJECTIVES?|PROFESSIONAL\s+GOALS|ASPIRATIONS)[\s:]*$/i, priority: 3 },
    { name: 'EXPECTATIONS', regex: /^[\s*•\-\|]*(?:EXPECTATIONS|SALARY\s+EXPECTATIONS|COMPENSATION\s+REQUIREMENTS|SALARY\s+REQUIREMENTS|DESIRED\s+COMPENSATION)[\s:]*$/i, priority: 2 }
  ];

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
  
  // Enhanced EXPERIENCE section detection
  if (!sections['EXPERIENCE']) {
    logger.info('Looking for experience content with aggressive detection methods');
    
    // Improved detection for work experience entries - more patterns
    const datePatterns = [
      /\b\d{4}[\s-–—]+(?:\d{4}|present|current|now|ongoing)\b/i,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\.\s]+\d{4}[\s-–—]+(?:present|current|now|ongoing|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec[\.\s]+\d{4})\b/i,
      /\b\d{1,2}\/\d{4}[\s-–—]+(?:present|current|now|\d{1,2}\/\d{4})\b/i,
      /\(\d{4}[\s-–—]+(?:\d{4}|present|current|now|ongoing)\)/i,
      /\b(?:20\d{2}|19\d{2})[\s\-–—]+(?:20\d{2}|19\d{2}|present|current|now|ongoing)\b/i,
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)[\s,]+\d{4}[\s\-–—]+(?:present|current|now|january|february|march|april|may|june|july|august|september|october|november|december[\s,]+\d{4})\b/i
    ];
    
    const titlePatterns = [
      /^([A-Z][A-Za-z\s&,]+?)(?:,|\sat\s|\sfor\s|\swith\s|\s-|\s\(|\n|$)/i,
      /(?:as|position|role|title)(?:\s+of)?(?:\s+a)?\s+([A-Z][A-Za-z\s&,]+?)(?:[,\.]\s|\s-|\s\(|\n|$)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,
      /\b(?:senior|junior|lead|principal|chief|head|director|manager|supervisor|associate|assistant|coordinator|specialist|analyst|consultant|engineer|developer|designer|architect|officer|executive|administrator|representative)\b/i
    ];
    
    const experienceBlocks: string[][] = [];
    let currentBlock: string[] = [];
    let inExperienceBlock = false;
    let blockStartIndex = -1;
    
    // First pass: identify potential job title/date lines
    const potentialExperienceLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check for date patterns
      let hasDate = false;
      for (const pattern of datePatterns) {
        if (pattern.test(line)) {
          hasDate = true;
          break;
        }
      }
      
      // Check for job title patterns
      let hasTitle = false;
      for (const pattern of titlePatterns) {
        if (pattern.test(line)) {
          hasTitle = true;
          break;
        }
      }
      
      // Mark lines with both date and title patterns or just date patterns
      if ((hasDate && hasTitle) || hasDate) {
        potentialExperienceLines.push(i);
      }
    }
    
    // Second pass: extract experience blocks
    for (let i = 0; i < potentialExperienceLines.length; i++) {
      const startIdx = potentialExperienceLines[i];
      const endIdx = i < potentialExperienceLines.length - 1 
        ? potentialExperienceLines[i + 1] - 1 
        : lines.length - 1;
      
      // Extract lines for this potential experience entry
      const block = [];
      for (let j = startIdx; j <= endIdx; j++) {
        const line = lines[j].trim();
        if (line) block.push(line);
      }
      
      if (block.length > 0) {
        experienceBlocks.push(block);
      }
    }
    
    // Alternative detection if first method didn't work
    if (experienceBlocks.length === 0) {
      logger.info('Trying alternative experience detection method');
      
      // Look for lines with job titles and company names
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          if (inExperienceBlock && currentBlock.length > 0) {
            experienceBlocks.push([...currentBlock]);
            currentBlock = [];
            inExperienceBlock = false;
          }
          continue;
        }
        
        // Check if line looks like a job title line
        const hasJobTitle = titlePatterns.some(pattern => pattern.test(line));
        const hasDate = datePatterns.some(pattern => pattern.test(line));
        const hasCompanyIndicator = /\b(?:at|with|for)\s+[A-Z]/i.test(line);
        
        // If this line appears to start a new experience entry
        if ((hasJobTitle && (hasDate || hasCompanyIndicator)) || 
            (line.length < 60 && hasDate && line.match(/[A-Z][a-z]+/))) {
          
          // If we were already in an experience block, save it
          if (inExperienceBlock && currentBlock.length > 0) {
            experienceBlocks.push([...currentBlock]);
            currentBlock = [];
          }
          
          // Start a new experience block
          inExperienceBlock = true;
          currentBlock = [line];
          blockStartIndex = i;
        }
        // If we're in a block and this line continues the current experience entry
        else if (inExperienceBlock) {
          // Add to the current block if:
          // 1. It's a bullet point or indented line
          // 2. It's within a reasonable distance from the start of the block
          // 3. It doesn't look like the start of a new section
          const isBulletPoint = /^[\s*•\-\|]+/.test(line);
          const isCloseToBlockStart = i - blockStartIndex < 15;
          const isNotSectionHeader = !line.match(/^[A-Z][A-Z\s]+$/);
          
          if ((isBulletPoint || isCloseToBlockStart) && isNotSectionHeader) {
            currentBlock.push(line);
          } else {
            // This line might be the start of a new section or unrelated content
            // End the current experience block
            experienceBlocks.push([...currentBlock]);
            currentBlock = [];
            inExperienceBlock = false;
          }
        }
      }
      
      // Add the last block if there is one
      if (inExperienceBlock && currentBlock.length > 0) {
        experienceBlocks.push([...currentBlock]);
      }
    }
    
    // If we found experience blocks, create the EXPERIENCE section
    if (experienceBlocks.length > 0) {
      // Join blocks with appropriate spacing
      const experienceContent = experienceBlocks
        .map(block => block.join('\n'))
        .join('\n\n');
      
      sections['EXPERIENCE'] = experienceContent;
      logger.info(`Created EXPERIENCE section with ${experienceBlocks.length} entries`);
    } else {
      // Try a very aggressive method - find any lines with dates in them and look for keywords
      const experienceKeywords = /\b(?:work|job|position|role|career|employment|responsible|duties|tasks|led|managed|developed|created|built|implemented|design|collaborate|team|client|project)\b/i;
      
      const dateAndKeywordLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Check for date patterns
        const hasDate = datePatterns.some(pattern => pattern.test(line));
        // Check for experience keywords
        const hasExperienceKeyword = experienceKeywords.test(line);
        
        if (hasDate && hasExperienceKeyword) {
          // Add this line and a few following lines
          dateAndKeywordLines.push(line);
          
          // Add next 3 non-empty lines as they might be part of this experience item
          let addedLines = 0;
          for (let j = i + 1; j < lines.length && addedLines < 3; j++) {
            const nextLine = lines[j].trim();
            if (nextLine) {
              dateAndKeywordLines.push(nextLine);
              addedLines++;
            }
          }
        }
      }
      
      if (dateAndKeywordLines.length > 0) {
        sections['EXPERIENCE'] = dateAndKeywordLines.join('\n');
        logger.info(`Created minimal EXPERIENCE section with ${dateAndKeywordLines.length} lines (fallback method)`);
      }
    }
  }

  // Enhance LANGUAGES section detection
  if (!sections['LANGUAGES']) {
    logger.info('Looking for language content with enhanced detection methods');
    
    // Common language names and proficiency levels with expanded patterns
    const languageNames = /\b(?:English|Spanish|French|German|Italian|Portuguese|Chinese|Japanese|Korean|Russian|Arabic|Hindi|Bengali|Dutch|Swedish|Norwegian|Finnish|Danish|Polish|Greek|Turkish|Thai|Vietnamese|Ukrainian|Hebrew|Czech|Slovak|Hungarian|Romanian|Bulgarian|Serbian|Croatian|Slovenian|Macedonian|Albanian|Lithuanian|Latvian|Estonian|Maltese|Icelandic|Irish|Welsh|Scottish|Gaelic|Basque|Catalan|Galician|Luxembourgish|Indonesian|Malay|Tagalog|Filipino|Javanese|Swahili|Afrikaans|Zulu|Xhosa|Yoruba|Igbo|Amharic|Somali|Persian|Urdu|Pashto|Kurdish|Armenian|Georgian|Azerbaijani|Uzbek|Kazakh|Kyrgyz|Tajik|Turkmen|Mongolian|Nepali|Bengali|Sinhala|Burmese|Khmer|Lao|Hmong)\b/i;
    
    const proficiencyLevels = /\b(?:native|fluent|proficient|intermediate|beginner|basic|conversational|business|professional|advanced|elementary|pre-intermediate|upper-intermediate|bilingual|mother\s+tongue|working\s+knowledge|limited\s+working\s+proficiency|full\s+working\s+proficiency|native\s+or\s+bilingual\s+proficiency|A1|A2|B1|B2|C1|C2)\b/i;
    
    // Language section indicators
    const languageSectionIndicators = /\b(?:speak|spoken|written|verbal|oral|communication|proficiency|level|certified|certification|test|score|TOEFL|IELTS|Cambridge|DELF|DALF|CEFR|HSK|JLPT|DELE|Goethe|TestDaF)\b/i;
    
    // Language content collection
    const languageLines: string[] = [];
    
    // Find paragraphs with language content
    let potentialLanguageParagraph: string[] = [];
    let inLanguageParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inLanguageParagraph && potentialLanguageParagraph.length > 0) {
          // Check if this paragraph has language content
          const paragraphText = potentialLanguageParagraph.join(' ');
          const hasLanguageName = languageNames.test(paragraphText);
          const hasProficiencyLevel = proficiencyLevels.test(paragraphText);
          
          if (hasLanguageName && hasProficiencyLevel) {
            languageLines.push(...potentialLanguageParagraph);
          }
          
          // Reset for next paragraph
          potentialLanguageParagraph = [];
          inLanguageParagraph = false;
        }
        continue;
      }
      
      // Check if this line has language indicators
      const hasLanguageName = languageNames.test(line);
      const hasProficiencyLevel = proficiencyLevels.test(line);
      const hasLanguageIndicator = languageSectionIndicators.test(line);
      
      // If this line has strong language indicators
      if (hasLanguageName && (hasProficiencyLevel || hasLanguageIndicator)) {
        // This is definitely a language line
        languageLines.push(line);
      }
      // If this line has just a language name and is short (likely a list item)
      else if (hasLanguageName && line.length < 40) {
        languageLines.push(line);
      }
      // Start or continue a potential language paragraph
      else if (hasLanguageName || hasProficiencyLevel || hasLanguageIndicator) {
        inLanguageParagraph = true;
        potentialLanguageParagraph.push(line);
      }
      // If we're in a potential language paragraph, continue collecting
      else if (inLanguageParagraph) {
        potentialLanguageParagraph.push(line);
        
        // If this paragraph is getting too long, it's probably not about languages
        if (potentialLanguageParagraph.length > 5) {
          inLanguageParagraph = false;
          potentialLanguageParagraph = [];
        }
      }
    }
    
    // Process the last paragraph if needed
    if (inLanguageParagraph && potentialLanguageParagraph.length > 0) {
      const paragraphText = potentialLanguageParagraph.join(' ');
      const hasLanguageName = languageNames.test(paragraphText);
      const hasProficiencyLevel = proficiencyLevels.test(paragraphText);
      
      if (hasLanguageName && hasProficiencyLevel) {
        languageLines.push(...potentialLanguageParagraph);
      }
    }
    
    // If no language lines found yet, try a more aggressive approach
    if (languageLines.length === 0) {
      // Try to find any lines just mentioning languages, even without proficiency
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (languageNames.test(line) && line.length < 50) {
          languageLines.push(line);
        }
      }
    }
    
    // If we found language content, create the LANGUAGES section
    if (languageLines.length > 0) {
      sections['LANGUAGES'] = languageLines.join('\n');
      logger.info(`Created LANGUAGES section with ${languageLines.length} lines`);
    }
    // Create a default language section if none found
    else if (!sections['EXPERIENCE'] || sections['EXPERIENCE'].toString().toLowerCase().includes('english')) {
      // If there are clues about English in the experience section
      sections['LANGUAGES'] = 'English - Proficient';
      logger.info('Created default LANGUAGES section (English only)');
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
    
    sections['PROFILE'] = `${name} with a strong background in the field. Experienced in delivering results and working with teams.`;
    logger.info('Created default PROFILE section as none was found');
  }
  
  // Ensure we have ACHIEVEMENTS if possible
  if (!sections['ACHIEVEMENTS']) {
    logger.info('Looking for achievement statements to create ACHIEVEMENTS section');
    
    // Look for lines that contain achievement indicators and quantifiable results
    const achievementContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for bullet points or numbering
      const isBulletOrNumbered = /^[\s*•\-\d\.]+/.test(line);
      
      // Check for achievement indicators
      const hasIndicator = /achieved|improve|increased|reduced|saved|delivered|launched|developed|created|led|managed|won|award|recognized|success/i.test(line);
      
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

  // Ensure GOALS section exists (career objectives)
  if (!sections['GOALS']) {
    logger.info('Looking for possible GOALS/OBJECTIVES content');
    
    // Look for goals/objectives indicators
    const goalIndicators = [
      /seeking|aspire|objective|aim|goal|looking for|desire|ambition|career|advancement|growth|develop|transition/i,
      /next step|future|progress|promote|advance|expand|learn|improve|opportunity|challenge/i
    ];
    
    // Find content that looks like goals/objectives
    const goalContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for goal indicators
      let hasGoalIndicator = false;
      for (const regex of goalIndicators) {
        if (regex.test(line)) {
          hasGoalIndicator = true;
          break;
        }
      }
      
      return hasGoalIndicator;
    });
    
    if (goalContent.length > 0) {
      sections['GOALS'] = goalContent.join('\n');
      logger.info(`Created GOALS section with ${goalContent.length} lines of content`);
    }
  }

  // Ensure EXPECTATIONS section exists (what to expect from the job)
  if (!sections['EXPECTATIONS']) {
    logger.info('Looking for possible EXPECTATIONS content');
    
    // Look for expectations content by searching for relevant indicators
    const expectationIndicators = [
      /salary|compensation|package|benefit|remuneration|looking for|expect|requirement/i,
      /\$\d+k|\$\d+,\d+|per annum|annually|yearly|hourly rate|contract rate|day rate/i
    ];
    
    // Find content that looks like expectations
    const expectationContent = lines.filter(line => {
      if (line.length < 20) return false;
      
      // Check for expectation indicators
      let hasExpectationIndicator = false;
      for (const regex of expectationIndicators) {
        if (regex.test(line)) {
          hasExpectationIndicator = true;
          break;
        }
      }
      
      return hasExpectationIndicator;
    });
    
    if (expectationContent.length > 0) {
      sections['EXPECTATIONS'] = expectationContent.join('\n');
      logger.info(`Created EXPECTATIONS section with ${expectationContent.length} lines of content`);
    }
  }
  
  // Return the parsed sections
  return sections;
} // End of parseOptimizedText function

/**
 * Tailor CV content based on job description
 * This function enhances various sections of the CV to match job requirements
 */
async function tailorCVContentForJob(
  sections: Record<string, string | string[]>,
  jobDescription?: string,
  jobTitle?: string,
  companyName?: string
): Promise<Record<string, string | string[]>> {
  logger.info('Starting CV content tailoring for job match with 80/20 preservation ratio');
  const tailoredSections = { ...sections };
  
  try {
    // If no job description provided, return sections as is
    if (!jobDescription) {
      logger.info('No job description provided, skipping content tailoring');
      return sections;
    }
    
    // Extract key terms from job description
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    logger.info(`Extracted ${keyTerms.length} key terms from job description`);
    
    // Get industry/field from job description
    const industry = extractIndustryFromJobDescription(jobDescription);
    logger.info(`Detected industry: ${industry || 'Unknown'}`);
    
    // Extract goals and expectations from job description (NEW)
    const extractedGoals = extractGoalsFromJobDescription(jobDescription);
    const extractedExpectations = extractExpectationsFromJobDescription(jobDescription);
    
    // Extract technical skills from job description to ensure we have them
    const technicalSkills = extractSkillsFromJobDescription(jobDescription);
    logger.info(`Extracted ${technicalSkills.length} technical skills from job description`);
    
    // Fix any problematic sections before tailoring
    cleanupSections(tailoredSections);
    
    // Add goals section if it doesn't exist or enhance existing (NEW)
    if (extractedGoals.length > 0) {
      if (!tailoredSections['GOALS']) {
        logger.info('Adding GOALS section from job description');
        tailoredSections['GOALS'] = extractedGoals;
      } else {
        // Enhance existing goals but preserve most of them
        logger.info('Enhancing existing GOALS section');
        tailoredSections['GOALS'] = await enhanceGoalsWithJobDescription(
          tailoredSections['GOALS'],
          extractedGoals
        );
      }
    }
    
    // Add expectations section if it doesn't exist or enhance existing (NEW)
    if (extractedExpectations.length > 0) {
      if (!tailoredSections['EXPECTATIONS']) {
        logger.info('Adding EXPECTATIONS section from job description');
        tailoredSections['EXPECTATIONS'] = extractedExpectations;
      } else {
        // Enhance existing expectations but preserve most of them
        logger.info('Enhancing existing EXPECTATIONS section');
        tailoredSections['EXPECTATIONS'] = await enhanceExpectationsWithJobDescription(
          tailoredSections['EXPECTATIONS'],
          extractedExpectations
        );
      }
    }
    
    // Tailor profile section - this is the most important section to optimize
    if (tailoredSections['PROFILE']) {
      logger.info('Tailoring PROFILE section for job match');
      tailoredSections['PROFILE'] = await optimizeProfileForJob(
        tailoredSections['PROFILE'],
        jobDescription,
        keyTerms,
        jobTitle,
        companyName
      );
    }
    
    // Tailor experience section - reorder and enhance most relevant experience
    if (tailoredSections['EXPERIENCE']) {
      logger.info('Tailoring EXPERIENCE section for job match');
      
      // Ensure experience content is properly cleaned
      let experienceContent = tailoredSections['EXPERIENCE'];
      
      // Check if experience content contains job description fragments
      if (typeof experienceContent === 'string' && 
          (experienceContent.includes('join our team') || 
           experienceContent.includes('currently pursuing') ||
           experienceContent.includes('intern to join'))) {
        logger.warn('Experience section contains job description fragments - cleaning up');
        // Clean it up and replace with extracted experience
        experienceContent = 'Professional experience in ' + keyTerms.slice(0, 5).join(', ');
      }
      
      // Now optimize the cleaned experience
      tailoredSections['EXPERIENCE'] = await optimizeExperienceForJob(
        experienceContent,
        jobDescription,
        keyTerms
      );
    }
    
    // Tailor skills sections - reorder and enhance skills based on relevance
    const skillSections = ['SKILLS', 'TECHNICAL SKILLS', 'PROFESSIONAL SKILLS'];
    
    for (const section of skillSections) {
      if (tailoredSections[section]) {
        logger.info(`Tailoring ${section} section for job match`);
        
        // Check if skills content contains only job description fragments
        let skillsContent = tailoredSections[section];
        
        // Clean up problematic skills content
        if (typeof skillsContent === 'string' && 
            (skillsContent.includes('for yourself') || 
             skillsContent.includes('including') ||
             skillsContent.includes('etc') ||
             skillsContent.includes('brands'))) {
          logger.warn(`${section} section contains problematic content - replacing with extracted skills`);
          skillsContent = technicalSkills;
        } else if (Array.isArray(skillsContent)) {
          // Filter out problematic items
          skillsContent = skillsContent.filter(skill => 
            typeof skill === 'string' && 
            !skill.includes('for yourself') && 
            !skill.includes('including') &&
            !skill.includes('etc') &&
            !skill.includes('brands') &&
            skill.length < 50
          );
          
          // If we filtered too much, use extracted skills
          if (skillsContent.length < 3) {
            logger.warn(`${section} array has too few valid items - replacing with extracted skills`);
            skillsContent = technicalSkills;
          }
        }
        
        // Now optimize the cleaned skills
        tailoredSections[section] = await optimizeSkillsForJob(
          skillsContent,
          jobDescription,
          keyTerms
        );
      }
    }
    
    // Ensure we have at least one skills section
    if (!tailoredSections['TECHNICAL SKILLS'] && !tailoredSections['SKILLS'] && !tailoredSections['PROFESSIONAL SKILLS']) {
      logger.info('No skills sections found - adding TECHNICAL SKILLS from job description');
      tailoredSections['TECHNICAL SKILLS'] = technicalSkills;
    }
    
    // Tailor achievements section - reorder and enhance most relevant achievements
    if (tailoredSections['ACHIEVEMENTS']) {
      logger.info('Tailoring ACHIEVEMENTS section for job match');
      tailoredSections['ACHIEVEMENTS'] = await optimizeAchievementsForJob(
        tailoredSections['ACHIEVEMENTS'],
        jobDescription,
        keyTerms
      );
    }
    
    // Tailor education section - highlight relevant education
    if (tailoredSections['EDUCATION']) {
      logger.info('Tailoring EDUCATION section for job match');
      tailoredSections['EDUCATION'] = await optimizeEducationForJob(
        tailoredSections['EDUCATION'],
        jobDescription,
        keyTerms
      );
    }
    
    // Tailor languages section - highlight relevant languages
    if (tailoredSections['LANGUAGES']) {
      logger.info('Tailoring LANGUAGES section for job match');
      tailoredSections['LANGUAGES'] = await optimizeLanguagesForJob(
        tailoredSections['LANGUAGES'],
        jobDescription
      );
    }
 
    logger.info('CV content tailoring completed successfully with 80/20 preservation ratio');
    return tailoredSections;
  } catch (error) {
    // If any error occurs during tailoring, log it and return original sections
    logger.error('Error during CV content tailoring:', error instanceof Error ? error.message : String(error));
    return sections;
  }
}

/**
 * Helper function to clean up problematic sections before tailoring
 */
function cleanupSections(sections: Record<string, string | string[]>): void {
  // Check for common problematic section content
  Object.keys(sections).forEach(section => {
    const content = sections[section];
    
    // Clean string content
    if (typeof content === 'string') {
      // Check for common problems
      if (content.includes('join our team') || 
          content.includes('for yourself') ||
          content.includes('currently pursuing') ||
          content.includes('including') ||
          content.includes('etc.') ||
          content.includes('brands') ||
          content.includes('intern to join')) {
        
        // This looks like it contains job description text rather than CV content
        logger.warn(`Section ${section} contains job description fragments - cleaning`);
        
        // For skills sections, replace with empty array
        if (section === 'SKILLS' || section === 'TECHNICAL SKILLS' || section === 'PROFESSIONAL SKILLS') {
          sections[section] = [];
        }
        // For experience, clean it but leave skeleton
        else if (section === 'EXPERIENCE') {
          // Extract any useful information
          const jobTitleMatch = content.match(/([A-Z][A-Za-z\s]+)(?:\s+at\s+|\s*[-–|]\s*)([A-Za-z0-9\s]+)/);
          if (jobTitleMatch) {
            sections[section] = `${jobTitleMatch[1]} at ${jobTitleMatch[2]}`;
          } else {
            sections[section] = 'Professional experience';
          }
        }
      }
    }
    // Clean array content
    else if (Array.isArray(content)) {
      const cleanedContent = content.filter(item => {
        if (typeof item !== 'string') return false;
        
        return !item.includes('join our team') && 
               !item.includes('for yourself') &&
               !item.includes('currently pursuing') &&
               !item.includes('including') &&
               !item.includes('etc.') &&
               !item.includes('brands') &&
               !item.includes('intern to join') &&
               item.length < 100;
      });
      
      // If we filtered out many items, log a warning
      if (cleanedContent.length < content.length / 2 && content.length > 3) {
        logger.warn(`Section ${section} had ${content.length - cleanedContent.length} problematic items removed`);
      }
      
      sections[section] = cleanedContent;
    }
  });
}

/**
 * Extracts key terms from job description
 */
function extractKeyTermsFromJobDescription(jobDescription: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'to', 'at', 'in', 'on', 'by', 'for',
    'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'will', 'just', 'should', 'now', 'company', 'position', 'job', 'responsibility',
    'responsibilities', 'role', 'candidate', 'applicant', 'opportunity', 'looking'
  ]);
  
  // Extract words from the job description
  const words = jobDescription.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word)); // Filter out short words and stop words
  
  // Count frequency of words
  const wordCounts: Record<string, number> = {};
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  // Extract multi-word terms using regex patterns for common job skills and qualifications
  const multiWordPatterns = [
    /\b(?:project management|team leadership|problem solving|attention to detail|customer service|quality assurance|strategic planning|time management|decision making|critical thinking)\b/gi,
    /\b(?:database management|data analysis|machine learning|artificial intelligence|business intelligence|web development|mobile development|cloud computing|network security|social media)\b/gi,
    /\b(?:communication skills|analytical skills|leadership skills|management skills|organizational skills|technical skills|interpersonal skills|creative skills|presentation skills)\b/gi,
    /\b(?:bachelor['']?s degree|master['']?s degree|phd|mba|certification|professional certification|industry certification)\b/gi,
    /\b(?:microsoft office|google workspace|adobe creative suite|content management system|customer relationship management)\b/gi,
    /\b(?:years of experience|relevant experience|proven experience|track record|demonstrated ability)\b/gi
  ];
  
  const multiWordTerms: string[] = [];
  for (const pattern of multiWordPatterns) {
    const matches = jobDescription.match(pattern) || [];
    multiWordTerms.push(...matches);
  }
  
  // Sort words by frequency
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  
  // Get top keywords (limit to 30)
  const keywords = sortedWords.slice(0, 30);
  
  // Combine with multi-word terms
  const allTerms = [...multiWordTerms, ...keywords];
  
  // Remove duplicates
  return [...new Set(allTerms)];
}

/**
 * Extracts industry/field from job description
 */
function extractIndustryFromJobDescription(jobDescription: string): string | null {
  // Common industry keywords
  const industries = [
    'technology', 'IT', 'software', 'healthcare', 'medical', 'finance', 'banking',
    'education', 'teaching', 'marketing', 'sales', 'retail', 'manufacturing',
    'construction', 'engineering', 'legal', 'law', 'consulting', 'hospitality',
    'tourism', 'food', 'beverage', 'pharmaceutical', 'biotech', 'automotive',
    'aerospace', 'defense', 'telecommunications', 'media', 'entertainment',
    'fashion', 'apparel', 'transportation', 'logistics', 'energy', 'oil', 'gas',
    'real estate', 'agriculture', 'nonprofit', 'government', 'insurance',
    'ecommerce', 'design', 'architecture', 'accounting'
  ];
  
  const jobDescLower = jobDescription.toLowerCase();
  
  // Try to find industry keywords in the job description
  for (const industry of industries) {
    const pattern = new RegExp(`\\b${industry}\\b`, 'i');
    if (pattern.test(jobDescLower)) {
      return industry;
    }
  }
  
  return null;
}

/**
 * Optimizes profile section for job match
 */
async function optimizeProfileForJob(
  profileContent: string | string[],
  jobDescription: string,
  keyTerms: string[],
  jobTitle?: string,
  companyName?: string
): Promise<string | string[]> {
  // If profile is an array, join it
  const profile = Array.isArray(profileContent) ? profileContent.join('\n') : profileContent;
  
  // Check if we have enough to work with
  if (!profile || profile.length < 20 || !jobDescription || jobDescription.length < 50) {
    return profileContent;
  }
  
  try {
    // First, do basic enhancement
    let enhancedProfile = profile;
    
    // Add job title-specific sentence if not already mentioned
    if (jobTitle && !profile.toLowerCase().includes(jobTitle.toLowerCase())) {
      const jobTitleSentence = `Experienced professional seeking role as ${jobTitle}${companyName ? ` at ${companyName}` : ''}.`;
      enhancedProfile = `${jobTitleSentence} ${enhancedProfile}`;
    }
    
    // For the missing keywords approach, we'll just add relevant keywords that aren't already present
    const missingKeyTerms = keyTerms.filter(term => 
      !profile.toLowerCase().includes(term.toLowerCase())
    ).slice(0, 3); // Limit to 3 terms to avoid overloading
    
    if (missingKeyTerms.length > 0) {
      // Add a sentence with missing key terms
      const keyTermsString = missingKeyTerms.join(', ');
      const additionalSentence = `Strong background in ${keyTermsString}.`;
      
      enhancedProfile = `${enhancedProfile} ${additionalSentence}`;
    }
    
    // Now use Mistral AI to further enhance the profile
    if (jobDescription) {
      logger.info('Using Mistral AI to enhance profile content');
      enhancedProfile = await enhanceTextWithMistralAI(
        enhancedProfile,
        jobDescription,
        'profile'
      );
    }
    
    return enhancedProfile;
  } catch (error) {
    logger.error('Error optimizing profile:', error instanceof Error ? error.message : String(error));
    return profileContent; // Return original content on error
  }
}

/**
 * Optimizes experience section for job match 
 */
async function optimizeExperienceForJob(
  experienceContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): Promise<string | string[]> {
  if (!experienceContent || (Array.isArray(experienceContent) && experienceContent.length === 0)) {
    logger.info('No experience content provided for optimization');
    return experienceContent;
  }

  try {
    logger.info('Optimizing experience content for job');
    
    // Convert content to array for consistent handling
    const experienceItems = Array.isArray(experienceContent) ? experienceContent : [experienceContent];
    
    // Enhanced experience optimization strategy
    let enhancedExperience: string[] = [];
    
    for (let i = 0; i < experienceItems.length; i++) {
      const item = experienceItems[i];
      
      if (typeof item !== 'string' || item.trim().length === 0) {
        continue;
      }
      
      logger.info(`Enhancing experience item ${i + 1} of ${experienceItems.length}`);
      
      // Check if it's a substantial experience item to enhance
      if (item.length > 100) {
        // This is likely a meaningful experience section, enhance it
        const enhancedText = await enhanceTextWithMistralAI(item, jobDescription, 'experience');
        enhancedExperience.push(enhancedText);
      } else {
        // For shorter items (like titles), keep as is
        enhancedExperience.push(item);
      }
    }
    
    // If we ended up with no enhanced experience, return original
    if (enhancedExperience.length === 0) {
      logger.info('No experience enhancements performed, returning original');
      return experienceContent;
    }
    
    // Maintain original format (string or array)
    return Array.isArray(experienceContent) ? enhancedExperience : enhancedExperience.join('\n');
  } catch (error) {
    logger.error(`Error optimizing experience: ${error}`);
    return experienceContent;
  }
}

/**
 * Optimizes skills section for job match by reordering skills based on relevance
 */
async function optimizeSkillsForJob(
  skillsContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): Promise<string | string[]> {
  logger.info('Starting skills optimization for job');
  
  try {
    // Handle empty or missing skills
    if (!skillsContent || (Array.isArray(skillsContent) && skillsContent.length === 0) || 
        (typeof skillsContent === 'string' && skillsContent.trim().length === 0)) {
      
      logger.info('No skills content provided, extracting from job description');
      
      // Extract skills from job description as fallback
      const extractedSkills = extractSkillsFromJobDescription(jobDescription);
      logger.info(`Extracted ${extractedSkills.length} skills from job description`);
      
      // Format skills with appropriate context
      return extractedSkills.map(skill => {
        // Determine if skill matches key terms for context
        const isKeySkill = keyTerms.some(term => 
          skill.toLowerCase().includes(term.toLowerCase()) || 
          term.toLowerCase().includes(skill.toLowerCase())
        );
        
        // Add appropriate context
        if (isKeySkill) {
          const keySkillContexts = ['(Advanced)', '(Expert)', '(Highly Relevant)', '(Key Competency)'];
          return `${skill} ${keySkillContexts[Math.floor(Math.random() * keySkillContexts.length)]}`;
        } else {
          const generalContexts = ['(Proficient)', '(Experienced)', '(Skilled)', '(Competent)'];
          return `${skill} ${generalContexts[Math.floor(Math.random() * generalContexts.length)]}`;
        }
      });
    }
    
    // Convert string to array if needed
    let skillItems: string[] = [];
    if (typeof skillsContent === 'string') {
      // Split by newlines and filter empty items
      skillItems = skillsContent.split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    } else {
      // Filter out empty items from array
      skillItems = skillsContent
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim());
    }
    
    // If we still don't have skills, extract from job description
    if (skillItems.length === 0) {
      logger.info('Skills content is empty after processing, extracting from job description');
      const extractedSkills = extractSkillsFromJobDescription(jobDescription);
      return extractedSkills;
    }
    
    logger.info(`Processing ${skillItems.length} skills`);
    
    // Use Mistral AI to enhance entire skills section at once
    const skillsText = skillItems.join('\n');
    const enhancedSkillsText = await enhanceTextWithMistralAI(
      skillsText,
      jobDescription,
      'skills'
    );
    
    // Convert back to array
    const enhancedSkills = enhancedSkillsText
      .split('\n')
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);
    
    logger.info(`Enhanced skills: ${enhancedSkills.length} items`);
    
    // Return in original format
    return Array.isArray(skillsContent) ? enhancedSkills : enhancedSkillsText;
  } catch (error) {
    logger.error(`Error in skills optimization: ${error}`);
    // Fallback to original
    return skillsContent;
  }
}

/**
 * Optimizes achievements section for job match
 */
async function optimizeAchievementsForJob(
  achievementsContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): Promise<string | string[]> {
  // Convert to array if string
  const achievementsArray = Array.isArray(achievementsContent)
    ? achievementsContent
    : achievementsContent.split('\n').filter(line => line.trim());
  
  // Score achievements by relevance to job description
  const scoredAchievements = achievementsArray.map(achievement => {
    let score = 0;
    
    // Check for key terms
    for (const term of keyTerms) {
      if (achievement.toLowerCase().includes(term.toLowerCase())) {
        score += 2;
      }
    }
    
    // Check for quantifiable results (tends to be impressive)
    if (achievement.match(/\d+%|\$\d+|\d+\s+million|\d+\s+thousand/)) {
      score += 3;
    }
    
    return { achievement, score };
  });
  
  // Sort achievements by relevance score
  scoredAchievements.sort((a, b) => b.score - a.score);
  
  // Extract sorted achievements
  const sortedAchievements = scoredAchievements.map(item => item.achievement);
  
  // Use Mistral AI to enhance achievements directly
  try {
    if (jobDescription && sortedAchievements.length > 0) {
      logger.info('Enhancing achievements with Mistral AI');
      
      // Enhance the top achievements
      const enhancedAchievements = [...sortedAchievements];
      for (let i = 0; i < Math.min(3, enhancedAchievements.length); i++) {
        enhancedAchievements[i] = await enhanceTextWithMistralAI(
          enhancedAchievements[i],
          jobDescription,
          'achievements'
        );
      }
      
      // Return in original format with enhanced achievements
      return Array.isArray(achievementsContent) ? enhancedAchievements : enhancedAchievements.join('\n');
    }
  } catch (error) {
    logger.error('Error enhancing achievements:', error instanceof Error ? error.message : String(error));
  }
  
  // Return in original format if no enhancement was done
  return Array.isArray(achievementsContent) ? sortedAchievements : sortedAchievements.join('\n');
}

/**
 * Optimizes education section for job match
 */
async function optimizeEducationForJob(
  educationContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): Promise<string | string[]> {
  // For education, we typically don't modify the content at all
  // Education facts should remain factual
  logger.info('Preserving original education content - factual information');
  
  // Convert to array if string
  const educationArray = Array.isArray(educationContent) 
    ? educationContent 
    : educationContent.split('\n').filter(line => line.trim().length > 0);
  
  // Score relevance to job (for ordering only)
  const scoredEducation = educationArray.map(entry => {
    let score = 0;
    
    // Check for key terms
    for (const term of keyTerms) {
      if (entry.toLowerCase().includes(term.toLowerCase())) {
        score += 2;
      }
    }
    
    // Higher scores for degrees mentioned in job
    const degreePatterns = [
      /\b(?:bachelor|bachelor's|bachelors|BA|BS|BSc|B\.A\.|B\.S\.|undergraduate degree)\b/i,
      /\b(?:master|master's|masters|MA|MS|MSc|MBA|M\.A\.|M\.S\.|M\.B\.A\.|graduate degree)\b/i,
      /\b(?:PhD|Ph\.D\.|doctorate|doctoral)\b/i,
      /\b(?:certificate|certification|diploma)\b/i
    ];
    
    for (const pattern of degreePatterns) {
      if (pattern.test(entry) && pattern.test(jobDescription)) {
        score += 3;
      }
    }
    
    return { entry, score };
  });
  
  // Sort education by relevance (most relevant first)
  scoredEducation.sort((a, b) => b.score - a.score);
  
  // Extract sorted entries - we preserve 100% of the content, just reorder
  const sortedEducation = scoredEducation.map(item => item.entry);
  
  // Return in original format
  return Array.isArray(educationContent) ? sortedEducation : sortedEducation.join('\n');
}

/**
 * Optimizes languages section for job match
 */
async function optimizeLanguagesForJob(
  languagesContent: string | string[],
  jobDescription: string
): Promise<string | string[]> {
  // For languages, we typically don't modify the content much
  // We might prioritize languages mentioned in the job description
  
  // Convert to array if string
  const languagesArray = Array.isArray(languagesContent)
    ? languagesContent
    : languagesContent.split('\n').filter(line => line.trim());
  
  // Score languages by presence in job description
  const scoredLanguages = languagesArray.map(language => {
    let score = 0;
    
    // Extract language name (assuming format like "English - Fluent")
    const languageName = language.split(/[-:]/)[0].trim().toLowerCase();
    
    // Check if language is mentioned in job description
    if (jobDescription.toLowerCase().includes(languageName)) {
      score += 5;
    }
    
    return { language, score };
  });
  
  // Sort languages by relevance score
  scoredLanguages.sort((a, b) => b.score - a.score);
  
  // Extract sorted languages
  const sortedLanguages = scoredLanguages.map(item => item.language);
  
  // Enhance with Mistral AI if a language is mentioned in the job description
  try {
    if (jobDescription && scoredLanguages.some(item => item.score > 0)) {
      logger.info('Enhancing languages with Mistral AI');
      
      // Only enhance if we're returning an array
      if (Array.isArray(languagesContent)) {
        const enhancedLanguages = [...sortedLanguages];
        
        // Only enhance languages that are relevant to the job
        for (let i = 0; i < Math.min(3, enhancedLanguages.length); i++) {
          if (scoredLanguages[i].score > 0) { // Only enhance relevant languages
            enhancedLanguages[i] = await enhanceTextWithMistralAI(
              enhancedLanguages[i],
              jobDescription,
              'languages' // Use dedicated languages enhancement type
            );
          }
        }
        
        return enhancedLanguages;
      } else {
        // For string input, enhance the whole language section
        const enhancedLanguages = await enhanceTextWithMistralAI(
          sortedLanguages.join('\n'),
          jobDescription,
          'languages' // Use dedicated languages enhancement type
        );
        
        return enhancedLanguages;
      }
    }
  } catch (error) {
    logger.error('Error enhancing languages:', error instanceof Error ? error.message : String(error));
  }
  
  // Return in original format if no enhancement was performed
  return Array.isArray(languagesContent) ? sortedLanguages : sortedLanguages.join('\n');
}

/**
 * Placeholder for Mistral AI text enhancement (to be implemented with actual API)
 * This function would connect to the Mistral AI API to enhance CV content
 */
async function enhanceTextWithMistralAI(
  originalText: string,
  jobDescription: string,
  enhancementType: 'profile' | 'experience' | 'achievements' | 'skills' | 'languages'
): Promise<string> {
  try {
    if (!originalText || originalText.trim().length === 0) {
      logger.info(`Empty ${enhancementType} provided for enhancement, returning original`);
      return originalText;
    }

    // Only enhance if the original text is not too short or not too long
    if (originalText.length < 25 || originalText.length > 5000) {
      logger.info(`${enhancementType} text length (${originalText.length}) outside enhancement range, returning original`);
      return originalText;
    }

    logger.info(`Enhancing ${enhancementType} with Mistral AI`);
    
    const enhancementPrompts = {
      profile: 'Enhance this professional profile summary to highlight relevant experience and skills for the job description. Keep the same information but make it more impactful and targeted to the position.',
      experience: 'Enhance this work experience to emphasize achievements and responsibilities relevant to the job description. Use action verbs and quantify achievements where possible. Maintain factual accuracy and do not invent new experience.',
      achievements: 'Enhance these professional achievements to make them more impactful and relevant to the job description. Quantify results where possible and emphasize transferable skills.',
      skills: 'Enhance these skills by highlighting those most relevant to the job description. Format them clearly and add appropriate proficiency levels if missing.',
      languages: 'Format these language skills clearly, including proficiency levels if available.'
    };

    // Add job description key terms extraction for better targeting
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    logger.info(`Extracted ${keyTerms.length} key terms from job description`);

    // Build the prompt
    const prompt = `
    ORIGINAL TEXT:
    ${originalText.trim()}
    
    JOB DESCRIPTION:
    ${jobDescription.trim()}
    
    KEY TERMS FROM JOB DESCRIPTION:
    ${keyTerms.join(', ')}
    
    TASK: ${enhancementPrompts[enhancementType]}
    
    IMPORTANT GUIDELINES:
    1. Preserve ALL factual information from the original text - do not remove or invent details
    2. Maintain the same overall structure and type of content
    3. Focus on enhancing relevance to the job description by emphasizing matching skills and experience
    4. Format appropriately for a professional CV/resume
    5. For experience, use past tense and action verbs
    6. For profile/summary, use present tense
    7. For skills, create a clean list with appropriate context about proficiency level
    8. Do not introduce job description text as if it were the candidate's experience
    
    ENHANCED TEXT:
    `;

    // Special handling for skills to improve extraction
    if (enhancementType === 'skills') {
      // For skills, extract terms directly from job description too
      const extractedSkills = extractSkillsFromJobDescription(jobDescription);
      
      return await callMistralRagAPIWithSkillsContext(originalText, jobDescription, extractedSkills, prompt);
    }
    
    // Special handling for experience to improve accuracy
    if (enhancementType === 'experience') {
      return await callMistralRagAPIWithExperienceContext(originalText, jobDescription, prompt);
    }

    // Regular enhancement for other section types
    const response = await callMistralRagAPI(originalText, jobDescription, prompt);
    return response.trim();
  } catch (error) {
    logger.error(`Error enhancing ${enhancementType} with Mistral AI: ${error}`);
    return originalText;
  }
}

/**
 * Call Mistral AI API with special handling for skills content
 */
async function callMistralRagAPIWithSkillsContext(
  originalText: string, 
  jobDescription: string,
  extractedSkills: string[],
  prompt: string
): Promise<string> {
  try {
    // Enhance the prompt with specific skills extraction guidance
    const enhancedPrompt = `${prompt}
    
    ADDITIONAL GUIDANCE FOR SKILLS:
    1. The CV contains specific skills that should be preserved in your output
    2. The following skills are directly relevant to the job description and should be emphasized:
       ${extractedSkills.join(', ')}
    3. Format each skill as a separate bullet point
    4. Add context about proficiency level to skills that don't have it (e.g., "Expert", "Advanced", "Proficient")
    5. Exclude any generic phrases that aren't specific skills
    6. Don't include job duties or responsibilities as skills
    
    FINAL ENHANCED SKILLS LIST:
    `;
    
    // Call Mistral API with enhanced prompt
    const response = await callMistralRagAPI(originalText, jobDescription, enhancedPrompt);
    
    // Process the response to ensure it's well-formatted
    let enhancedSkills = response.trim();
    
    // If there's no bullet points, add them
    if (!enhancedSkills.includes('•') && !enhancedSkills.includes('-')) {
      enhancedSkills = enhancedSkills
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `• ${line}`)
        .join('\n');
    }
    
    return enhancedSkills;
  } catch (error) {
    logger.error(`Error enhancing skills with Mistral AI: ${error}`);
    return originalText;
  }
}

/**
 * Call Mistral AI API with special handling for experience content
 */
async function callMistralRagAPIWithExperienceContext(
  originalText: string, 
  jobDescription: string,
  prompt: string
): Promise<string> {
  try {
    // First, try to extract the job titles and companies from the original text
    const jobTitleRegex = /(?:^|\n)([A-Z][A-Za-z\s]+)(?:\s+at\s+|\s*[-–|]\s*)([A-Za-z0-9\s]+)(?:,\s|\n|$)/g;
    let match;
    const jobMatches = [];
    
    while ((match = jobTitleRegex.exec(originalText)) !== null) {
      jobMatches.push({
        title: match[1].trim(),
        company: match[2].trim()
      });
    }
    
    // Enhance the prompt with specific experience extraction guidance
    const enhancedPrompt = `${prompt}
    
    ADDITIONAL GUIDANCE FOR WORK EXPERIENCE:
    1. The CV contains specific job titles and employers that MUST be preserved exactly in your output
    2. The following job positions were identified in the original CV and should be maintained:
       ${jobMatches.map(m => `${m.title} at ${m.company}`).join('\n       ')}
    3. Format each experience entry with the job title, company, and relevant responsibilities/achievements
    4. Use bullet points for responsibilities and achievements
    5. Focus on highlighting experiences most relevant to the job description
    6. Use past tense and action verbs for all descriptions
    7. DO NOT include text from the job description as if it were the candidate's experience
    
    FINAL ENHANCED EXPERIENCE:
    `;
    
    // Call Mistral API with enhanced prompt
    const response = await callMistralRagAPI(originalText, jobDescription, enhancedPrompt);
    
    return response.trim();
  } catch (error) {
    logger.error(`Error enhancing experience with Mistral AI: ${error}`);
    return originalText;
  }
}

/**
 * Call Mistral AI RAG API with the given prompt
 */
async function callMistralRagAPI(originalText: string, jobDescription: string, prompt: string): Promise<string> {
  try {
    const url = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions';
    const apiKey = process.env.MISTRAL_API_KEY;
    
    if (!apiKey) {
      logger.error('Mistral API key not found');
      return originalText;
    }
    
    logger.info('Calling Mistral AI API for RAG processing');
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert CV/resume writer specialized in tailoring resumes to job descriptions. 
        Your task is to enhance CV content to better match job requirements while maintaining all original factual information.
        You must never invent new experience or qualifications.
        You must not mix job description text as if it were the candidate's own experience.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages,
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Mistral API error: ${response.status} ${errorText}`);
      return originalText;
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    logger.error(`Error calling Mistral AI: ${error}`);
    return originalText;
  }
}

/**
 * Extracts potential goals from a job description
 */
function extractGoalsFromJobDescription(jobDescription: string): string[] {
  logger.info('Extracting goals from job description');
  
  const goals: string[] = [];
  
  // Look for common patterns that indicate goals or objectives
  const goalPatterns = [
    /(?:you will|you'll|your goal|our goal|the goal|the aim|you aim to|responsibilities include)[^.!?]*(develop|create|build|establish|improve|grow|increase|enhance|optimize|maintain)[^.!?]*[.!?]/gi,
    /(?:we are looking for|we seek|we want|we need)[^.!?]*(someone who can|candidates who|professionals to|experts in)[^.!?]*(develop|create|build|establish|improve|grow|increase|enhance)[^.!?]*[.!?]/gi,
    /\b(?:objectives|goals|targets|aims|mission|vision)[^.!?]*(?:include|are|is|will be)[^.!?]*[.!?]/gi
  ];
  
  // Extract potential goals using patterns
  for (const pattern of goalPatterns) {
    const matches = jobDescription.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Clean up the goal text
        let goal = match.trim()
          .replace(/^you will|you'll|your goal|our goal|the goal|the aim|you aim to|we are looking for|we seek|we want|we need|objectives|goals|targets|aims|mission|vision/i, '')
          .replace(/^[^\w]+/, '')
          .trim();
        
        // Convert to first person format
        goal = convertToFirstPerson(goal);
        
        // Add if not duplicate and meaningful
        if (goal.length > 20 && !goals.some(g => g.toLowerCase().includes(goal.toLowerCase().substring(0, 15)))) {
          goals.push(goal);
        }
      }
    }
  }
  
  // Add some manually extracted goals if we couldn't find any with patterns
  if (goals.length === 0) {
    // Extract key verbs and nouns
    const keyVerbs = extractKeyVerbs(jobDescription);
    const keyNouns = extractKeyNouns(jobDescription);
    
    // Create basic goals from key terms
    if (keyVerbs.length > 0 && keyNouns.length > 0) {
      for (let i = 0; i < Math.min(3, keyVerbs.length); i++) {
        const verb = keyVerbs[i];
        const noun = keyNouns[i % keyNouns.length];
        goals.push(`To ${verb} ${noun} skills and contribute to company success`);
      }
    }
  }
  
  // Limit to reasonable number of goals
  return goals.slice(0, 3);
}

/**
 * Extracts potential expectations from a job description
 */
function extractExpectationsFromJobDescription(jobDescription: string): string[] {
  logger.info('Extracting expectations from job description');
  
  const expectations: string[] = [];
  
  // Look for common patterns that indicate expectations
  const expectationPatterns = [
    /(?:you can expect|you'll find|you will enjoy|we offer|benefits include|perks include|you will receive|we provide)[^.!?]*[.!?]/gi,
    /\b(?:our environment|our culture|our team|our company|our organization|our workplace)[^.!?]*(?:is|offers|provides|values|supports)[^.!?]*[.!?]/gi,
    /\b(?:work-life balance|flexibility|remote work|hybrid|training|development|growth|advancement|benefits|compensation)[^.!?]*[.!?]/gi
  ];
  
  // Extract potential expectations using patterns
  for (const pattern of expectationPatterns) {
    const matches = jobDescription.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Clean up the expectation text
        let expectation = match.trim()
          .replace(/^you can expect|you'll find|you will enjoy|we offer|benefits include|perks include|you will receive|we provide/i, '')
          .replace(/^[^\w]+/, '')
          .trim();
        
        // Format nicely
        if (!expectation.startsWith('•') && !expectation.startsWith('-')) {
          expectation = '• ' + expectation;
        }
        
        // Add if not duplicate and meaningful
        if (expectation.length > 15 && !expectations.some(e => e.toLowerCase().includes(expectation.toLowerCase().substring(0, 15)))) {
          expectations.push(expectation);
        }
      }
    }
  }
  
  // Create some basic expectations if we couldn't find any with patterns
  if (expectations.length === 0) {
    const basicExpectations = [
      '• A collaborative and supportive team environment',
      '• Opportunities for professional growth and development',
      '• Competitive compensation and benefits package'
    ];
    
    // Add company name if available
    if (jobDescription.includes('company') || jobDescription.includes('organization')) {
      const companyMatch = jobDescription.match(/\b(?:at|with|for|join)\s+([A-Z][A-Za-z0-9\s]+)(?:\s+(?:is|as|where|we|our|LLC|Inc\.|Corporation))/);
      if (companyMatch && companyMatch[1]) {
        const companyName = companyMatch[1].trim();
        basicExpectations.push(`• Become part of the innovative team at ${companyName}`);
      }
    }
    
    expectations.push(...basicExpectations);
  }
  
  // Limit to reasonable number of expectations
  return expectations.slice(0, 4);
}

/**
 * Enhances existing goals with job description goals while preserving
 * 80% of original content
 */
async function enhanceGoalsWithJobDescription(
  existingGoals: string | string[],
  extractedGoals: string[]
): Promise<string | string[]> {
  logger.info('Enhancing existing goals with job description goals - 80/20 preservation');
  
  // Convert to array if string
  const goalsArray = Array.isArray(existingGoals) 
    ? existingGoals 
    : existingGoals.split('\n').filter(line => line.trim().length > 0);
  
  // If very few existing goals, we can add more from job description
  if (goalsArray.length <= 2 && extractedGoals.length > 0) {
    // Keep all existing goals and add 1-2 from job description
    const enhancedGoals = [...goalsArray];
    const goalsToAdd = Math.min(2, extractedGoals.length);
    
    for (let i = 0; i < goalsToAdd; i++) {
      // Check if this goal is already similar to an existing one
      const isDuplicate = enhancedGoals.some(goal => 
        isSimilarText(goal, extractedGoals[i])
      );
      
      if (!isDuplicate) {
        enhancedGoals.push(extractedGoals[i]);
      }
    }
    
    // Return in original format
    return Array.isArray(existingGoals) ? enhancedGoals : enhancedGoals.join('\n');
  }
  
  // If already have enough goals, just reorder to prioritize job-relevant ones
  // This preserves 100% of the content while still optimizing
  return existingGoals;
}

/**
 * Enhances existing expectations with job description expectations while
 * preserving 80% of original content
 */
async function enhanceExpectationsWithJobDescription(
  existingExpectations: string | string[],
  extractedExpectations: string[]
): Promise<string | string[]> {
  logger.info('Enhancing existing expectations with job description expectations - 80/20 preservation');
  
  // Convert to array if string
  const expectationsArray = Array.isArray(existingExpectations) 
    ? existingExpectations 
    : existingExpectations.split('\n').filter(line => line.trim().length > 0);
  
  // If very few existing expectations, we can add more from job description
  if (expectationsArray.length <= 2 && extractedExpectations.length > 0) {
    // Keep all existing expectations and add 1-2 from job description
    const enhancedExpectations = [...expectationsArray];
    const expectationsToAdd = Math.min(2, extractedExpectations.length);
    
    for (let i = 0; i < expectationsToAdd; i++) {
      // Check if this expectation is already similar to an existing one
      const isDuplicate = enhancedExpectations.some(expectation => 
        isSimilarText(expectation, extractedExpectations[i])
      );
      
      if (!isDuplicate) {
        enhancedExpectations.push(extractedExpectations[i]);
      }
    }
    
    // Return in original format
    return Array.isArray(existingExpectations) ? enhancedExpectations : enhancedExpectations.join('\n');
  }
  
  // If already have enough expectations, just preserve them
  // This preserves 100% of the content
  return existingExpectations;
}

/**
 * Helper to check if two text strings are similar
 */
function isSimilarText(text1: string, text2: string): boolean {
  const normalized1 = text1.toLowerCase().replace(/[^\w\s]/g, '');
  const normalized2 = text2.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Check if one text contains a significant portion of the other
  return normalized1.includes(normalized2.substring(0, 15)) || 
         normalized2.includes(normalized1.substring(0, 15));
}

/**
 * Helper to convert text to first person perspective
 */
function convertToFirstPerson(text: string): string {
  return text
    .replace(/\byou will\b/gi, 'I will')
    .replace(/\byou'll\b/gi, 'I will')
    .replace(/\byou can\b/gi, 'I can')
    .replace(/\byour\b/gi, 'my')
    .replace(/\byou are\b/gi, 'I am')
    .replace(/\byou have\b/gi, 'I have');
}

/**
 * Helper to extract key verbs from text
 */
function extractKeyVerbs(text: string): string[] {
  const commonVerbs = [
    'develop', 'create', 'build', 'manage', 'lead', 'design', 'implement',
    'analyze', 'optimize', 'improve', 'coordinate', 'deliver', 'maintain',
    'support', 'grow', 'drive', 'achieve', 'ensure', 'provide', 'collaborate'
  ];
  
  const verbs = commonVerbs.filter(verb => 
    new RegExp(`\\b${verb}\\b`, 'i').test(text)
  );
  
  return verbs.length > 0 ? verbs : ['develop', 'improve', 'contribute'];
}

/**
 * Helper to extract key nouns from text
 */
function extractKeyNouns(text: string): string[] {
  const commonNouns = [
    'skills', 'solutions', 'projects', 'products', 'systems', 'processes',
    'teams', 'strategies', 'applications', 'services', 'growth', 'quality',
    'performance', 'operations', 'initiatives', 'improvements', 'innovation'
  ];
  
  const nouns = commonNouns.filter(noun => 
    new RegExp(`\\b${noun}\\b`, 'i').test(text)
  );
  
  return nouns.length > 0 ? nouns : ['professional', 'technical', 'leadership'];
}

/**
 * Extracts potential skills from job description
 */
function extractSkillsFromJobDescription(jobDescription: string): string[] {
  logger.info('Extracting skills from job description');
  
  // Extract key terms that might be skills
  const terms = extractKeyTermsFromJobDescription(jobDescription);
  
  // Common technical terms that are likely skills
  const technicalTerms = [
    'html', 'css', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node', 'express',
    'python', 'java', 'c#', 'c++', 'ruby', 'php', 'go', 'rust', 'swift', 'kotlin',
    'sql', 'mysql', 'postgresql', 'mongodb', 'oracle', 'aws', 'azure', 'gcp', 'docker',
    'kubernetes', 'terraform', 'jenkins', 'git', 'github', 'gitlab', 'jira', 'agile', 'scrum',
    'machine learning', 'ai', 'data science', 'data analysis', 'excel', 'powerpoint', 'word',
    'project management', 'powerbi', 'tableau', 'sap', 'salesforce', 'marketing', 'sales',
    'customer service', 'leadership', 'management', 'communication', 'problem solving',
    'teamwork', 'collaboration', 'analytical', 'critical thinking', 'time management'
  ];
  
  // Extract phrases that might be skills (1-3 word phrases)
  const skillsRegex = /\b([A-Za-z]+(?: [A-Za-z]+){0,2})\b/g;
  const phrases = jobDescription.match(skillsRegex) || [];
  
  // Filter phrases to likely skills
  const potentialSkills = new Set<string>();
  
  // Add skills from key terms
  for (const term of terms) {
    potentialSkills.add(term);
  }
  
  // Add technical terms found in job description
  for (const term of technicalTerms) {
    if (jobDescription.toLowerCase().includes(term.toLowerCase())) {
      potentialSkills.add(term.charAt(0).toUpperCase() + term.slice(1).toLowerCase());
    }
  }
  
  // Add skill-like phrases
  for (const phrase of phrases) {
    // Skip short or common words
    if (phrase.length < 4 || 
        /\b(and|the|for|this|that|with|have|from|would|should|could|been|were|when|where|what|which|who|how|why)\b/i.test(phrase)) {
      continue;
    }
    
    // Check if the phrase is likely a skill
    if (phrase.length > 3 && !phrase.includes(' ')) {
      potentialSkills.add(phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase());
    } else if (phrase.split(' ').length <= 3 && phrase.length > 6) {
      // Multi-word phrases that could be skills
      potentialSkills.add(phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase());
    }
  }
  
  // Convert to array
  const skills = Array.from(potentialSkills);
  
  // Ensure we have at least 10 skills
  if (skills.length < 10) {
    // Add some general skills based on industry
    const industry = extractIndustryFromJobDescription(jobDescription);
    if (industry) {
      const industrySkills = getIndustrySkills(industry);
      for (const skill of industrySkills) {
        potentialSkills.add(skill);
        if (potentialSkills.size >= 15) break;
      }
    }
    
    // Add technical skills as backup
    if (potentialSkills.size < 15) {
      for (const skill of technicalTerms) {
        potentialSkills.add(skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase());
        if (potentialSkills.size >= 15) break;
      }
    }
  }
  
  // Return up to 15 skills
  return Array.from(potentialSkills).slice(0, 15);
}

/**
 * Returns common skills for a specific industry
 */
function getIndustrySkills(industry: string): string[] {
  const industrySkillMap: Record<string, string[]> = {
    'technology': [
      'Programming', 'Software Development', 'Cloud Computing', 'DevOps', 
      'Machine Learning', 'Database Management', 'Cybersecurity',
      'Agile Methodology', 'UX/UI Design', 'API Development'
    ],
    'finance': [
      'Financial Analysis', 'Accounting', 'Risk Management', 'Investment Banking',
      'Financial Modeling', 'Budgeting', 'Auditing', 'Compliance',
      'Banking', 'Portfolio Management'
    ],
    'healthcare': [
      'Patient Care', 'Electronic Health Records', 'Medical Terminology',
      'Healthcare Compliance', 'Clinical Experience', 'Medical Documentation',
      'Patient Assessment', 'Healthcare Management', 'Medical Coding'
    ],
    'marketing': [
      'Digital Marketing', 'Social Media Marketing', 'Content Creation',
      'SEO', 'Market Research', 'Brand Management', 'Email Marketing',
      'Campaign Management', 'Analytics', 'Customer Engagement'
    ],
    'education': [
      'Curriculum Development', 'Student Assessment', 'Classroom Management',
      'Instructional Design', 'Educational Technology', 'Lesson Planning',
      'Student Support', 'Educational Leadership', 'Teaching'
    ],
    'manufacturing': [
      'Quality Assurance', 'Supply Chain Management', 'Lean Manufacturing',
      'Inventory Management', 'Production Planning', 'Process Improvement',
      'Equipment Maintenance', 'ERP Systems', 'Safety Management'
    ],
    'retail': [
      'Customer Service', 'Sales', 'Inventory Management', 'Visual Merchandising',
      'POS Systems', 'Retail Operations', 'Stock Management', 'Merchandising',
      'Cash Handling', 'Loss Prevention'
    ],
    'consulting': [
      'Business Strategy', 'Client Management', 'Project Management',
      'Process Improvement', 'Data Analysis', 'Change Management',
      'Business Development', 'Stakeholder Management', 'Presentations'
    ]
  };
  
  // Normalize industry name and find closest match
  const normalizedIndustry = industry.toLowerCase();
  
  for (const [key, skills] of Object.entries(industrySkillMap)) {
    if (normalizedIndustry.includes(key.toLowerCase())) {
      return skills;
    }
  }
  
  // Return general business skills if no match found
  return [
    'Communication', 'Leadership', 'Project Management', 'Problem Solving',
    'Critical Thinking', 'Teamwork', 'Organization', 'Attention to Detail',
    'Time Management', 'Adaptability'
  ];
}