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
    
    // Store the combined profile back to PROFILE
    sections['PROFILE'] = combinedProfile;
    
    // Remove SUMMARY to avoid duplication
    if (sections['SUMMARY']) {
      delete sections['SUMMARY'];
    }
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
  
  // Apply job-specific tailoring if job description is provided
  logger.info('Applying job-specific tailoring to CV sections');
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

// After parseOptimizedText function and before generateSpecificDocx function

/**
 * Tailors CV content to better match a job description
 * Makes minor adjustments while preserving original content integrity
 */
async function tailorCVContentForJob(
  sections: Record<string, string | string[]>,
  jobDescription?: string,
  jobTitle?: string,
  companyName?: string
): Promise<Record<string, string | string[]>> {
  // If no job description provided, return sections as is
  if (!jobDescription) {
    logger.info('No job description provided, skipping content tailoring');
    return sections;
  }

  logger.info('Starting CV content tailoring for job match');
  const tailoredSections = { ...sections };
  
  try {
    // Extract key terms from job description
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    logger.info(`Extracted ${keyTerms.length} key terms from job description`);
    
    // Get industry/field from job description
    const industry = extractIndustryFromJobDescription(jobDescription);
    logger.info(`Detected industry: ${industry || 'Unknown'}`);
    
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
    
    // Tailor experience section - highlight relevant experiences
    if (tailoredSections['EXPERIENCE']) {
      logger.info('Tailoring EXPERIENCE section for job match');
      tailoredSections['EXPERIENCE'] = await optimizeExperienceForJob(
        tailoredSections['EXPERIENCE'],
        jobDescription,
        keyTerms
      );
    }
    
    // Tailor skills section - reorder skills based on relevance to job
    if (tailoredSections['SKILLS'] || tailoredSections['TECHNICAL SKILLS'] || tailoredSections['PROFESSIONAL SKILLS']) {
      logger.info('Tailoring skills sections for job match');
      
      if (tailoredSections['SKILLS']) {
        tailoredSections['SKILLS'] = await optimizeSkillsForJob(
          tailoredSections['SKILLS'],
          jobDescription,
          keyTerms
        );
      }
      
      if (tailoredSections['TECHNICAL SKILLS']) {
        tailoredSections['TECHNICAL SKILLS'] = await optimizeSkillsForJob(
          tailoredSections['TECHNICAL SKILLS'],
          jobDescription,
          keyTerms
        );
      }
      
      if (tailoredSections['PROFESSIONAL SKILLS']) {
        tailoredSections['PROFESSIONAL SKILLS'] = await optimizeSkillsForJob(
          tailoredSections['PROFESSIONAL SKILLS'],
          jobDescription,
          keyTerms
        );
      }
    }
    
    // Tailor achievements section - highlight relevant achievements
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
      tailoredSections['EDUCATION'] = optimizeEducationForJob(
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
    
    logger.info('CV content tailoring completed successfully');
    return tailoredSections;
  } catch (error) {
    // If any error occurs during tailoring, log it and return original sections
    logger.error('Error during CV content tailoring:', error instanceof Error ? error.message : String(error));
    return sections;
  }
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
  // For array input, score and reorder entries
  if (Array.isArray(experienceContent)) {
    // Create a scored version of each entry
    const scoredEntries = experienceContent.map(entry => {
      let score = 0;
      
      // Check for key terms
      for (const term of keyTerms) {
        if (entry.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
      }
      
      // Check for quantifiable results (usually important)
      if (entry.match(/\d+%|\$\d+|\d+\s+million|\d+\s+thousand/)) {
        score += 3;
      }
      
      return { entry, score };
    });
    
    // Sort by score (highest first)
    scoredEntries.sort((a, b) => b.score - a.score);
    
    // Get entries sorted by relevance
    const sortedEntries = scoredEntries.map(item => item.entry);
    
    // Use Mistral AI to enhance the most relevant entries (top 3)
    if (jobDescription && sortedEntries.length > 0) {
      logger.info('Using Mistral AI to enhance experience entries');
      
      // Only enhance the top entries to be efficient
      const enhancedEntries = [...sortedEntries]; // Make a copy
      
      for (let i = 0; i < Math.min(3, enhancedEntries.length); i++) {
        enhancedEntries[i] = await enhanceTextWithMistralAI(
          enhancedEntries[i],
          jobDescription,
          'experience'
        );
      }
      
      return enhancedEntries;
    }
    
    // Return sorted entries
    return sortedEntries;
  }
  
  // For string input
  const experience = experienceContent as string;
  
  // Try to split the content into job entries based on line breaks
  const entries = experience.split(/\n{2,}/);
  
  if (entries.length > 1) {
    // Score each entry
    const scoredEntries = entries.map(entry => {
      let score = 0;
      
      // Check for key terms
      for (const term of keyTerms) {
        if (entry.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
      }
      
      return { entry, score };
    });
    
    // Sort by score (highest first)
    scoredEntries.sort((a, b) => b.score - a.score);
    
    // Get entries sorted by relevance
    const sortedEntries = scoredEntries.map(item => item.entry);
    
    // Use Mistral AI to enhance the most relevant entry
    if (jobDescription && sortedEntries.length > 0) {
      logger.info('Using Mistral AI to enhance top experience entry');
      
      const enhancedEntries = [...sortedEntries];
      enhancedEntries[0] = await enhanceTextWithMistralAI(
        enhancedEntries[0],
        jobDescription,
        'experience'
      );
      
      return enhancedEntries.join('\n\n');
    }
    
    // Join back together with double newlines
    return sortedEntries.join('\n\n');
  }
  
  // If it's a single continuous text, enhance it directly
  if (jobDescription) {
    logger.info('Using Mistral AI to enhance experience section');
    return await enhanceTextWithMistralAI(
      experience,
      jobDescription,
      'experience'
    );
  }
  
  // If we couldn't split it or there's only one entry, return as is
  return experience;
}

/**
 * Optimizes skills section for job match by reordering skills based on relevance
 */
async function optimizeSkillsForJob(
  skillsContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): Promise<string | string[]> {
  // Convert to array if string
  const skillsArray = Array.isArray(skillsContent) 
    ? skillsContent 
    : skillsContent.split('\n').filter(line => line.trim());
  
  // Calculate relevance score for each skill based on presence in job description and key terms
  const scoredSkills = skillsArray.map(skill => {
    let score = 0;
    
    // Check if skill is directly mentioned in job description
    if (jobDescription.toLowerCase().includes(skill.toLowerCase())) {
      score += 5;
    }
    
    // Check if skill matches any key terms
    for (const term of keyTerms) {
      if (skill.toLowerCase().includes(term.toLowerCase()) || 
          term.toLowerCase().includes(skill.toLowerCase())) {
        score += 3;
        break;
      }
    }
    
    return { skill, score };
  });
  
  // Sort skills by relevance score (highest first)
  scoredSkills.sort((a, b) => b.score - a.score);
  
  // Extract sorted skills
  const sortedSkills = scoredSkills.map(item => item.skill);
  
  // Enhance the skills with Mistral AI
  try {
    logger.info('Enhancing skills with Mistral AI');
    
    // For array input, enhance the top skills
    if (Array.isArray(skillsContent)) {
      const enhancedSkills = [...sortedSkills];
      
      // Only enhance top skills that are relevant to the job
      for (let i = 0; i < Math.min(5, enhancedSkills.length); i++) {
        if (scoredSkills[i].score > 0) { // Only enhance relevant skills
          enhancedSkills[i] = await enhanceTextWithMistralAI(
            enhancedSkills[i],
            jobDescription,
            'skills'
          );
        }
      }
      
      return enhancedSkills;
    } else {
      // For string input, enhance the whole skills section
      const enhancedSkills = await enhanceTextWithMistralAI(
        sortedSkills.join('\n'),
        jobDescription,
        'skills'
      );
      
      return enhancedSkills;
    }
  } catch (error) {
    logger.error('Error enhancing skills:', error instanceof Error ? error.message : String(error));
    // Return in original format on error
    return Array.isArray(skillsContent) ? sortedSkills : sortedSkills.join('\n');
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
function optimizeEducationForJob(
  educationContent: string | string[],
  jobDescription: string,
  keyTerms: string[]
): string | string[] {
  // For education, we typically don't modify the content much
  // We might reorder entries based on relevance, but education facts should remain factual
  return educationContent;
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
  // This is a placeholder function that would be replaced with actual API integration
  // For now, we'll just simulate what the AI might do with some basic enhancements
  
  logger.info(`Simulating Mistral AI enhancement for ${enhancementType}`);
  
  try {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let enhancedText = originalText;
    
    // Extract key terms from job description
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    const topKeyTerms = keyTerms.slice(0, 5);
    
    // Simulate different enhancement types
    switch (enhancementType) {
      case 'profile':
        // For profile, add job-specific elements if not present
        if (!originalText.toLowerCase().includes('experienced')) {
          enhancedText = `Experienced professional with a strong background in ${topKeyTerms.join(', ')}. ${originalText}`;
        }
        break;
        
      case 'experience':
        // For experience, highlight relevant achievements
        if (originalText.includes('\n')) {
          // Split into lines
          const lines = originalText.split('\n');
          
          // Enhance lines that contain key terms
          enhancedText = lines.map(line => {
            for (const term of topKeyTerms) {
              if (line.toLowerCase().includes(term.toLowerCase()) && 
                !line.includes('•') && line.length > 20) {
                // Add a bullet point for important achievements
                return `• ${line}`;
              }
            }
            return line;
          }).join('\n');
        }
        break;
        
      case 'achievements':
        // For achievements, add quantifiable results if not present
        if (!originalText.match(/\d+%|\$\d+|\d+\s+million|\d+\s+thousand/)) {
          // Find a keyword from the job description that matches
          for (const term of topKeyTerms) {
            if (originalText.toLowerCase().includes(term.toLowerCase())) {
              // Add a quantifiable element related to the term
              const quantifiers = ['significant', 'measurable', 'substantial', 'noteworthy'];
              const randomQuantifier = quantifiers[Math.floor(Math.random() * quantifiers.length)];
              
              enhancedText = `${originalText}, resulting in ${randomQuantifier} improvements related to ${term}`;
              break;
            }
          }
        }
        
        // Ensure it starts with a strong action verb
        const actionVerbs = ['Achieved', 'Delivered', 'Implemented', 'Managed', 'Developed', 'Led', 'Created', 'Improved'];
        const startsWithActionVerb = actionVerbs.some(verb => originalText.startsWith(verb));
        
        if (!startsWithActionVerb) {
          const randomVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
          // Remove any bullet points or dashes that might be at the start
          const cleanedText = originalText.replace(/^[•\-\*\s]+/, '');
          enhancedText = `${randomVerb} ${cleanedText}`;
        }
        break;
        
      case 'languages':
        // For languages, add proficiency context if not present
        if (originalText) {
          // Parse language entry (typically in format "Language - Proficiency Level")
          const parts = originalText.split(/[-:]/);
          
          if (parts.length === 1 && !originalText.toLowerCase().includes('fluent') && 
              !originalText.toLowerCase().includes('native') && 
              !originalText.toLowerCase().includes('proficient')) {
            // Add proficiency context if missing
            const languageName = parts[0].trim();
            
            // Check if language is mentioned in job description to determine importance
            const isLanguageImportant = jobDescription.toLowerCase().includes(languageName.toLowerCase());
            
            // Assign appropriate proficiency
            if (isLanguageImportant) {
              enhancedText = `${languageName} - Fluent/Professional proficiency`;
            } else {
              const proficiencies = [
                'Proficient',
                'Working proficiency',
                'Good command',
                'Conversational'
              ];
              const randomProficiency = proficiencies[Math.floor(Math.random() * proficiencies.length)];
              enhancedText = `${languageName} - ${randomProficiency}`;
            }
          }
        }
        break;
        
      case 'skills':
        // For skills, enhance with job-specific context
        if (originalText) {
          // Skip if the skill already includes job-specific context
          if (!originalText.includes('(') && !originalText.includes(' - ') && originalText.length < 30) {
            // Find matching terms from job description
            for (const term of topKeyTerms) {
              if (originalText.toLowerCase().includes(term.toLowerCase())) {
                // Add context to emphasize the skill's relevance
                const contexts = [
                  `(essential for ${term})`,
                  `- key for ${term}`,
                  `(proficient in contexts like ${term})`,
                  `- applied to ${term}`
                ];
                const randomContext = contexts[Math.floor(Math.random() * contexts.length)];
                enhancedText = `${originalText} ${randomContext}`;
                break;
              }
            }
          }
        }
        break;
    }
    
    return enhancedText;
  } catch (error) {
    logger.error('Error in Mistral AI enhancement:', error instanceof Error ? error.message : String(error));
    return originalText; // Fall back to original on error
  }
}