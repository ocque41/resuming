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
  
  // Merge PROFILE and SUMMARY sections to avoid duplication
  if (sections['PROFILE'] || sections['SUMMARY']) {
    // Get content from both sections
    const profileContent = typeof sections['PROFILE'] === 'string' 
      ? sections['PROFILE'] 
      : Array.isArray(sections['PROFILE']) ? sections['PROFILE'].join('\n') : '';
    
    const summaryContent = typeof sections['SUMMARY'] === 'string' 
      ? sections['SUMMARY'] 
      : Array.isArray(sections['SUMMARY']) ? sections['SUMMARY'].join('\n') : '';
    
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
    
    // Store in PROFILE section
    sections['PROFILE'] = combinedProfile;
    
    // Always delete SUMMARY section after merging
    delete sections['SUMMARY'];
    logger.info('Removed SUMMARY section after merging with PROFILE');
  }
  
  // Enhanced skills section deduplication logic
  // Step 1: Handle all skills-related sections together 
  const skillSectionNames = ['SKILLS', 'TECHNICAL SKILLS', 'PROFESSIONAL SKILLS'];
  const presentSkillSections = skillSectionNames.filter(name => sections[name]);
  
  if (presentSkillSections.length > 1) {
    logger.info(`Multiple skill sections detected: ${presentSkillSections.join(', ')}`);
    
    // Process each skills section into a standardized format (array of skills)
    const processedSkills: Record<string, string[]> = {};
    const skillWords = new Set<string>(); // Tracks unique skill words for better deduplication
    
    for (const sectionName of presentSkillSections) {
      // Get content and convert to array
      let skillsContent = sections[sectionName];
      let skillsArray = Array.isArray(skillsContent) ? [...skillsContent] : [skillsContent];
      
      // Process into individual skills
      skillsArray = skillsArray
        .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
        .map(skill => typeof skill === 'string' ? skill.trim() : skill)
        .filter(skill => 
          typeof skill === 'string' && 
          skill.length > 0 && 
          !skill.toUpperCase().includes(sectionName.toUpperCase()) &&
          !skill.toUpperCase().includes('SKILL'));
      
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
      if (sections['SKILLS']) {
        logger.info('Deleting generic SKILLS section since we have specific skill sections');
        delete sections['SKILLS'];
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
      sections['TECHNICAL SKILLS'] = processedSkills['TECHNICAL SKILLS'];
      sections['PROFESSIONAL SKILLS'] = processedSkills['PROFESSIONAL SKILLS'];
      
      logger.info(`After deduplication: TECHNICAL SKILLS has ${processedSkills['TECHNICAL SKILLS'].length} items, PROFESSIONAL SKILLS has ${processedSkills['PROFESSIONAL SKILLS'].length} items`);
      
      // If either section is now empty, remove it
      if (processedSkills['PROFESSIONAL SKILLS'].length === 0) {
        logger.info('Removed PROFESSIONAL SKILLS section as all items were duplicates of TECHNICAL SKILLS');
        delete sections['PROFESSIONAL SKILLS'];
      }
      
      if (processedSkills['TECHNICAL SKILLS'].length === 0) {
        logger.info('Removed TECHNICAL SKILLS section as all items were duplicates');
        delete sections['TECHNICAL SKILLS'];
      }
    }
  }
  
  // Rename 'SKILLS' to 'OTHER SKILLS' if we have both technical/professional and general skills
  // to better distinguish between them in the final document
  if (sections['SKILLS'] && (sections['TECHNICAL SKILLS'] || sections['PROFESSIONAL SKILLS'])) {
    sections['OTHER SKILLS'] = sections['SKILLS'];
    delete sections['SKILLS'];
    // Update section order to include OTHER SKILLS
    const otherSkillsIndex = sectionOrder.indexOf('SKILLS');
    if (otherSkillsIndex !== -1) {
      sectionOrder[otherSkillsIndex] = 'OTHER SKILLS';
    }
    logger.info('Renamed generic SKILLS section to OTHER SKILLS for clarity');
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
  const processedSections = new Set(); // Track sections we've already processed
  
  for (const section of sectionOrder) {
    // Skip if section doesn't exist
    if (!sections[section]) {
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
    if (section === 'SKILLS' && (sections['TECHNICAL SKILLS'] || sections['PROFESSIONAL SKILLS'])) {
      logger.info('Skipping generic SKILLS section as specific skills sections exist');
      continue;
    }
    
    // Get content for this section
    const content = sections[section];
    
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
    // Special handling for Languages section
    else if (section === 'LANGUAGES') {
      // Add languages header with special formatting
      const languagesHeader = new Paragraph({
        text: 'Languages',
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
      paragraphs.push(languagesHeader);
      
      // Process language content with enhanced formatting
      if (typeof content === 'string') {
        const contentLines = content.split('\n').filter(line => line.trim());
        
        for (const line of contentLines) {
          if (!line.trim()) continue;
          
          // Check if this language line contains a proficiency level marker
          const hasSeparator = line.includes(':') || line.includes('-') || line.includes('–');
          
          let languageName = line.trim();
          let proficiencyLevel = '';
          
          // Try to separate language name from proficiency level
          if (hasSeparator) {
            const parts = line.split(/[:–-]/);
            if (parts.length >= 2) {
              languageName = parts[0].trim();
              proficiencyLevel = parts.slice(1).join(' - ').trim();
            }
          }
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: languageName,
                  bold: true,
                  size: 24,
                }),
                ...(proficiencyLevel ? [
                  new TextRun({
                    text: ` - ${proficiencyLevel}`,
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
      } else if (Array.isArray(content)) {
        // Handle array content for languages
        for (const item of content) {
          if (!item.trim()) continue;
          
          // Check if this language line contains a proficiency level marker
          const hasSeparator = item.includes(':') || item.includes('-') || item.includes('–');
          
          let languageName = item.trim();
          let proficiencyLevel = '';
          
          // Try to separate language name from proficiency level
          if (hasSeparator) {
            const parts = item.split(/[:–-]/);
            if (parts.length >= 2) {
              languageName = parts[0].trim();
              proficiencyLevel = parts.slice(1).join(' - ').trim();
            }
          }
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: languageName,
                  bold: true,
                  size: 24,
                }),
                ...(proficiencyLevel ? [
                  new TextRun({
                    text: ` - ${proficiencyLevel}`,
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
      let skillItems = Array.isArray(content) ? content : [content];
      
      // Clean skill items to ensure they don't include section headers
      skillItems = skillItems
        .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
        .map(skill => typeof skill === 'string' ? skill.trim() : skill)
        .filter(skill => 
          typeof skill === 'string' && 
          skill.length > 0 && 
          !skill.toUpperCase().includes(section) &&
          !skill.toUpperCase().includes('TECHNICAL') &&
          !skill.toUpperCase().includes('PROFESSIONAL') &&
          !skill.toUpperCase().includes('SKILL'));
      
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
    { name: 'PROFILE', regex: /^[\s*•\-\|]*(?:PROFILE|PROFESSIONAL\s+PROFILE|ABOUT(?:\s+ME)?)[\s:]*$/i, priority: 5 },
    { name: 'EXPERIENCE', regex: /^[\s*•\-\|]*(?:EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|PROFESSIONAL\s+EXPERIENCE|CAREER|WORK\s+HISTORY)[\s:]*$/i, priority: 4 },
    { name: 'EDUCATION', regex: /^[\s*•\-\|]*(?:EDUCATION|ACADEMIC\s+BACKGROUND|ACADEMIC\s+HISTORY|QUALIFICATIONS)[\s:]*$/i, priority: 4 },
    { name: 'SKILLS', regex: /^[\s*•\-\|]*(?:SKILLS|CORE\s+SKILLS|KEY\s+SKILLS)[\s:]*$/i, priority: 3 },
    { name: 'TECHNICAL SKILLS', regex: /^[\s*•\-\|]*(?:TECHNICAL\s+SKILLS|TECHNICAL\s+EXPERTISE|TECH\s+SKILLS|TECHNICAL\s+PROFICIENCIES)[\s:]*$/i, priority: 4 },
    { name: 'PROFESSIONAL SKILLS', regex: /^[\s*•\-\|]*(?:PROFESSIONAL\s+SKILLS|SOFT\s+SKILLS|INTERPERSONAL\s+SKILLS|CORE\s+COMPETENCIES)[\s:]*$/i, priority: 4 },
    { name: 'LANGUAGES', regex: /^[\s*•\-\|]*(?:LANGUAGES|LANGUAGE\s+SKILLS|LANGUAGE\s+PROFICIENCIES|LANGUAGE\s+KNOWLEDGE)[\s:]*$/i, priority: 3 },
    { name: 'ACHIEVEMENTS', regex: /^[\s*•\-\|]*(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY\s+ACHIEVEMENTS|MAJOR\s+ACCOMPLISHMENTS)[\s:]*$/i, priority: 3 },
    { name: 'CERTIFICATIONS', regex: /^[\s*•\-\|]*(?:CERTIFICATIONS|CERTIFICATES|PROFESSIONAL\s+CERTIFICATIONS|CREDENTIALS)[\s:]*$/i, priority: 3 },
    { name: 'PROJECTS', regex: /^[\s*•\-\|]*(?:PROJECTS|KEY\s+PROJECTS|MAJOR\s+PROJECTS|PROJECT\s+EXPERIENCE)[\s:]*$/i, priority: 3 },
    { name: 'PUBLICATIONS', regex: /^[\s*•\-\|]*(?:PUBLICATIONS|PUBLISHED\s+WORKS|PAPERS|RESEARCH\s+PUBLICATIONS)[\s:]*$/i, priority: 2 },
    { name: 'REFERENCES', regex: /^[\s*•\-\|]*(?:REFERENCES|PROFESSIONAL\s+REFERENCES|RECOMMENDATION)[\s:]*$/i, priority: 1 },
    { name: 'VOLUNTEER', regex: /^[\s*•\-\|]*(?:VOLUNTEER(?:\s+EXPERIENCE)?|COMMUNITY\s+SERVICE|COMMUNITY\s+INVOLVEMENT)[\s:]*$/i, priority: 2 },
    { name: 'INTERESTS', regex: /^[\s*•\-\|]*(?:INTERESTS|HOBBIES|ACTIVITIES|PERSONAL\s+INTERESTS)[\s:]*$/i, priority: 1 },
    { name: 'GOALS', regex: /^[\s*•\-\|]*(?:GOALS|CAREER\s+GOALS|OBJECTIVES|CAREER\s+OBJECTIVES)[\s:]*$/i, priority: 3 },
    { name: 'EXPECTATIONS', regex: /^[\s*•\-\|]*(?:EXPECTATIONS|SALARY\s+EXPECTATIONS|COMPENSATION\s+REQUIREMENTS)[\s:]*$/i, priority: 2 }
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
  
  return sections;
} 