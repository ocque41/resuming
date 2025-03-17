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
  if (sections['PROFILE'] && sections['SUMMARY']) {
    // Extract and merge the content
    const profileContent = typeof sections['PROFILE'] === 'string' 
      ? sections['PROFILE'] 
      : Array.isArray(sections['PROFILE']) ? sections['PROFILE'].join(' ') : '';
    
    const summaryContent = typeof sections['SUMMARY'] === 'string' 
      ? sections['SUMMARY'] 
      : Array.isArray(sections['SUMMARY']) ? sections['SUMMARY'].join(' ') : '';
    
    // Check if they're not identical to avoid redundancy
    if (profileContent.toLowerCase().trim() !== summaryContent.toLowerCase().trim()) {
      // Only merge if they're different
      sections['PROFILE'] = profileContent + (profileContent && summaryContent ? ' ' : '') + summaryContent;
      logger.info('Merged SUMMARY section into PROFILE to avoid duplication');
    }
    
    // Remove the SUMMARY section as its content is now in PROFILE
    delete sections['SUMMARY'];
    logger.info('Removed SUMMARY section after merging with PROFILE');
  }
  
  // Special handling for Technical and Professional Skills to avoid duplications
  if (sections['TECHNICAL SKILLS'] && sections['PROFESSIONAL SKILLS']) {
    // Convert to arrays for easier processing
    let technicalSkills = Array.isArray(sections['TECHNICAL SKILLS']) 
      ? sections['TECHNICAL SKILLS'] 
      : [sections['TECHNICAL SKILLS']];
    
    let professionalSkills = Array.isArray(sections['PROFESSIONAL SKILLS']) 
      ? sections['PROFESSIONAL SKILLS'] 
      : [sections['PROFESSIONAL SKILLS']];
      
    // Clean skills arrays
    technicalSkills = technicalSkills
      .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
      .map(skill => typeof skill === 'string' ? skill.trim() : skill)
      .filter(skill => 
        typeof skill === 'string' && 
        skill.length > 0 && 
        !skill.toUpperCase().includes('TECHNICAL SKILLS') &&
        !skill.toUpperCase().includes('SKILL'));
        
    professionalSkills = professionalSkills
      .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
      .map(skill => typeof skill === 'string' ? skill.trim() : skill)
      .filter(skill => 
        typeof skill === 'string' && 
        skill.length > 0 && 
        !skill.toUpperCase().includes('PROFESSIONAL SKILLS') &&
        !skill.toUpperCase().includes('SKILL'));
    
    // Create a set of technical skills (case insensitive) for comparison
    const technicalSkillsSet = new Set(technicalSkills.map(s => typeof s === 'string' ? s.toLowerCase() : ''));
    
    // Filter professional skills to remove duplicates found in technical skills
    professionalSkills = professionalSkills.filter(skill => 
      typeof skill === 'string' && !technicalSkillsSet.has(skill.toLowerCase()));
    
    // Update sections with cleaned content
    sections['TECHNICAL SKILLS'] = technicalSkills;
    sections['PROFESSIONAL SKILLS'] = professionalSkills;
    
    // Remove generic SKILLS section if we have specific skill sections
    if (sections['SKILLS']) {
      logger.info('Deleting generic SKILLS section since we have specific skill sections');
      delete sections['SKILLS'];
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
    // Skip if section doesn't exist or was already processed (e.g., SUMMARY merged into PROFILE)
    if (!sections[section]) continue;
    
    // Skip certain sections if their equivalents were already processed
    // This handles the duplicates shown in the brown circles in the sample document
    if ((section === 'SKILLS' && (sections['TECHNICAL SKILLS'] || sections['PROFESSIONAL SKILLS'])) ||
        (section === 'SUMMARY' && sections['PROFILE'])) {
      logger.info(`Skipping ${section} section to prevent duplication`);
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
    // Special formatting for Skills sections
    else if (section === 'TECHNICAL SKILLS' || section === 'PROFESSIONAL SKILLS' || section === 'SKILLS') {
      // Determine section title based on section key
      let sectionTitle;
      if (section === 'TECHNICAL SKILLS') sectionTitle = 'Technical Skills';
      else if (section === 'PROFESSIONAL SKILLS') sectionTitle = 'Professional Skills';
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
      
      // Add special handling for OBJECTIVES/GOALS section
      if (section === 'GOALS') {
        // Enhanced formatting for goals/objectives section
        const goalsHeader = new Paragraph({
          text: 'Career Objectives',
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
        paragraphs.push(goalsHeader);
        
        // Handle content based on type (array or string)
        let goalItems = Array.isArray(content) ? content : [content];
        
        // Clean goal items to ensure they don't include section headers
        goalItems = goalItems
          .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
          .map(goal => typeof goal === 'string' ? goal.trim() : goal)
          .filter(goal => 
            typeof goal === 'string' && 
            goal.length > 0 && 
            !goal.toUpperCase().includes(section) &&
            !goal.toUpperCase().includes('GOAL') &&
            !goal.toUpperCase().includes('OBJECTIVES'));
        
        // Create bullet points for each goal
        for (const goal of goalItems) {
          if (typeof goal === 'string' && goal.trim()) {
            const cleanedGoal = goal.trim().replace(/^[•\-\*]+\s*/, '');
            paragraphs.push(
              new Paragraph({
                text: cleanedGoal,
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
        
        continue; // Skip the generic content handling for goals
      }
      
      // Add special handling for EXPERIENCE section
      else if (section === 'EXPERIENCE') {
        // Enhanced formatting for experience section
        const experienceHeader = new Paragraph({
          text: 'Professional Experience',
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
        paragraphs.push(experienceHeader);
        
        // Handle content based on type (array or string)
        let experienceItems = Array.isArray(content) ? content : content.split('\n\n');
        
        // Process each experience entry
        for (let i = 0; i < experienceItems.length; i++) {
          let entry = typeof experienceItems[i] === 'string' ? experienceItems[i] : '';
          if (!entry.trim()) continue;
          
          // Check if this entry has company/title/date format
          const lines = entry.split('\n');
          
          // First line often contains the job title/company
          if (lines.length > 0 && lines[0].trim()) {
            paragraphs.push(
              new Paragraph({
                text: lines[0].trim(),
                heading: HeadingLevel.HEADING_3,
                spacing: {
                  before: 200,
                  after: 100,
                },
              })
            );
          }
          
          // Second line often contains dates
          if (lines.length > 1 && lines[1].trim()) {
            // Check if it looks like a date range
            if (lines[1].match(/\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: lines[1].trim(),
                      italics: true,
                    }),
                  ],
                  spacing: {
                    before: 0,
                    after: 100,
                  },
                })
              );
            } else {
              // Not a date, treat as regular content
              paragraphs.push(
                new Paragraph({
                  text: lines[1].trim(),
                })
              );
            }
          }
          
          // Remaining lines are likely responsibilities or achievements
          for (let j = 2; j < lines.length; j++) {
            if (!lines[j].trim()) continue;
            
            // Check if line starts with a bullet point
            const hasBullet = lines[j].trim().match(/^[•\-\*]/);
            
            paragraphs.push(
              new Paragraph({
                text: lines[j].trim().replace(/^[•\-\*]+\s*/, ''),
                bullet: hasBullet ? { level: 0 } : undefined,
                spacing: {
                  before: 60,
                  after: 60,
                }
              })
            );
          }
          
          // Add spacing between entries
          if (i < experienceItems.length - 1) {
            paragraphs.push(new Paragraph({ text: '', spacing: { before: 150, after: 150 } }));
          }
        }
        
        continue; // Skip the generic content handling for experience
      }
      
      // Add special handling for LANGUAGES section
      else if (section === 'LANGUAGES') {
        // Enhanced formatting for languages section
        const languagesHeader = new Paragraph({
          text: 'Language Proficiency',
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
        paragraphs.push(languagesHeader);
        
        // Handle content based on type (array or string)
        let languageItems = Array.isArray(content) ? content : [content];
        
        // Clean language items to ensure they don't include section headers
        languageItems = languageItems
          .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
          .map(lang => typeof lang === 'string' ? lang.trim() : lang)
          .filter(lang => 
            typeof lang === 'string' && 
            lang.length > 0 && 
            !lang.toUpperCase().includes('LANGUAGES') &&
            !lang.toUpperCase().includes('LANGUAGE PROFICIENCY'));
        
        // Create bullet points for each language
        for (const lang of languageItems) {
          if (typeof lang === 'string' && lang.trim()) {
            const cleanedLang = lang.trim().replace(/^[•\-\*]+\s*/, '');
            paragraphs.push(
              new Paragraph({
                text: cleanedLang,
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
        
        continue; // Skip the generic content handling for languages
      }
      
      // Add special handling for EDUCATION section
      else if (section === 'EDUCATION') {
        // Enhanced formatting for education section
        const educationHeader = new Paragraph({
          text: 'Education',
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
        paragraphs.push(educationHeader);
        
        // Handle content based on type (array or string)
        let educationItems = Array.isArray(content) ? content : content.split('\n\n');
        
        // Process each education entry
        for (let i = 0; i < educationItems.length; i++) {
          let entry = typeof educationItems[i] === 'string' ? educationItems[i] : '';
          if (!entry.trim()) continue;
          
          // Split entry into lines
          const lines = entry.split('\n');
          
          // First line often contains the degree/institution
          if (lines.length > 0 && lines[0].trim()) {
            paragraphs.push(
              new Paragraph({
                text: lines[0].trim(),
                heading: HeadingLevel.HEADING_3,
                spacing: {
                  before: 200,
                  after: 100,
                },
              })
            );
          }
          
          // Second line often contains dates or location
          if (lines.length > 1 && lines[1].trim()) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: lines[1].trim(),
                    italics: true,
                  }),
                ],
                spacing: {
                  before: 0,
                  after: 100,
                },
              })
            );
          }
          
          // Remaining lines are likely additional details
          for (let j = 2; j < lines.length; j++) {
            if (!lines[j].trim()) continue;
            
            // Check if line starts with a bullet point
            const hasBullet = lines[j].trim().match(/^[•\-\*]/);
            
            paragraphs.push(
              new Paragraph({
                text: lines[j].trim().replace(/^[•\-\*]+\s*/, ''),
                bullet: hasBullet ? { level: 0 } : undefined,
                spacing: {
                  before: 60,
                  after: 60,
                }
              })
            );
          }
          
          // Add spacing between entries
          if (i < educationItems.length - 1) {
            paragraphs.push(new Paragraph({ text: '', spacing: { before: 150, after: 150 } }));
          }
        }
        
        continue; // Skip the generic content handling for education
      }
      
      // Add special handling for EXPECTATIONS section
      else if (section === 'EXPECTATIONS') {
        // Enhanced formatting for expectations section
        const expectationsHeader = new Paragraph({
          text: 'Job Expectations',
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
        paragraphs.push(expectationsHeader);
        
        // Handle content based on type (array or string)
        let expectationItems = Array.isArray(content) ? content : [content];
        
        // Clean expectation items to ensure they don't include section headers
        expectationItems = expectationItems
          .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
          .map(exp => typeof exp === 'string' ? exp.trim() : exp)
          .filter(exp => 
            typeof exp === 'string' && 
            exp.length > 0 && 
            !exp.toUpperCase().includes('EXPECTATIONS') && 
            !exp.toUpperCase().includes('WHAT TO EXPECT'));
        
        // Create paragraphs for each expectation
        for (const exp of expectationItems) {
          if (typeof exp === 'string' && exp.trim()) {
            const cleanedExp = exp.trim().replace(/^[•\-\*]+\s*/, '');
            
            // Determine if this should be a bullet point
            const shouldBeBullet = cleanedExp.length < 100 || cleanedExp.match(/^[A-Z][a-z]+/);
            
            paragraphs.push(
              new Paragraph({
                text: cleanedExp,
                bullet: shouldBeBullet ? { level: 0 } : undefined,
                spacing: {
                  before: 100,
                  after: 100,
                }
              })
            );
          }
        }
        
        continue; // Skip the generic content handling for expectations
      }
      
      // Add special handling for ACHIEVEMENTS section
      else if (section === 'ACHIEVEMENTS') {
        // Enhanced formatting for achievements section
        const achievementsHeader = new Paragraph({
          text: 'Key Achievements',
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
        paragraphs.push(achievementsHeader);
        
        // Handle content based on type (array or string)
        let achievementItems = Array.isArray(content) ? content : [content];
        
        // Clean achievement items to ensure they don't include section headers
        achievementItems = achievementItems
          .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
          .map(ach => typeof ach === 'string' ? ach.trim() : ach)
          .filter(ach => 
            typeof ach === 'string' && 
            ach.length > 0 && 
            !ach.toUpperCase().includes('ACHIEVEMENTS') &&
            !ach.toUpperCase().includes('KEY ACHIEVEMENTS'));
        
        // Create bullet points for each achievement
        for (const ach of achievementItems) {
          if (typeof ach === 'string' && ach.trim()) {
            const cleanedAch = ach.trim().replace(/^[•\-\*]+\s*/, '');
            paragraphs.push(
              new Paragraph({
                text: cleanedAch,
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
        
        continue; // Skip the generic content handling for achievements
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
  
  // Define section patterns to improve detection
  const sectionPatterns: { regex: RegExp, name: string, priority?: number, synonyms?: string[] }[] = [
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:PROFILE|SUMMARY|ABOUT(?:\s+ME)?|PROFESSIONAL(?:\s+SUMMARY)?|PERSONAL(?:\s+STATEMENT)?)[\s\*•:\-_\|\#]*$/i, 
      name: 'PROFILE', 
      priority: 10,
      synonyms: ['SUMMARY', 'ABOUT ME', 'PROFESSIONAL SUMMARY', 'PERSONAL STATEMENT']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:ACHIEVEMENTS|ACCOMPLISHMENTS|KEY(?:\s+ACHIEVEMENTS)|HIGHLIGHTS|NOTABLE(?:\s+ACHIEVEMENTS))[\s\*•:\-_\|\#]*$/i, 
      name: 'ACHIEVEMENTS',
      priority: 8,
      synonyms: ['ACCOMPLISHMENTS', 'KEY ACHIEVEMENTS', 'HIGHLIGHTS', 'NOTABLE ACHIEVEMENTS'] 
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:GOALS|OBJECTIVES|CAREER(?:\s+GOALS)|ASPIRATIONS|CAREER(?:\s+OBJECTIVES)|AMBITIONS|PROFESSIONAL(?:\s+OBJECTIVES))[\s\*•:\-_\|\#]*$/i, 
      name: 'GOALS',
      priority: 7,
      synonyms: ['OBJECTIVES', 'CAREER GOALS', 'ASPIRATIONS', 'CAREER OBJECTIVES', 'PROFESSIONAL OBJECTIVES', 'AMBITIONS']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:LANGUAGES?|LANGUAGE(?:\s+PROFICIENCY)|LANGUAGE(?:\s+SKILLS)|FOREIGN(?:\s+LANGUAGES))[\s\*•:\-_\|\#]*$/i, 
      name: 'LANGUAGES',
      priority: 6,
      synonyms: ['LANGUAGE PROFICIENCY', 'LANGUAGE SKILLS', 'FOREIGN LANGUAGES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:TECHNICAL(?:\s+SKILLS)|TECHNICAL(?:\s+EXPERTISE)|TECHNICAL(?:\s+PROFICIENCIES)|IT(?:\s+SKILLS)|TECH(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, 
      name: 'TECHNICAL SKILLS',
      priority: 5,
      synonyms: ['TECHNICAL EXPERTISE', 'TECHNICAL PROFICIENCIES', 'IT SKILLS', 'TECH SKILLS'] 
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:PROFESSIONAL(?:\s+SKILLS)|SOFT(?:\s+SKILLS)|KEY(?:\s+SKILLS)|CORE(?:\s+COMPETENCIES)|INTERPERSONAL(?:\s+SKILLS))[\s\*•:\-_\|\#]*$/i, 
      name: 'PROFESSIONAL SKILLS',
      priority: 5,
      synonyms: ['SOFT SKILLS', 'KEY SKILLS', 'CORE COMPETENCIES', 'INTERPERSONAL SKILLS']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:SKILLS|CORE(?:\s+SKILLS)|EXPERTISE|COMPETENCIES|CAPABILITIES|PROFICIENCIES)[\s\*•:\-_\|\#]*$/i, 
      name: 'SKILLS',
      priority: 5,
      synonyms: ['CORE SKILLS', 'EXPERTISE', 'COMPETENCIES', 'CAPABILITIES', 'PROFICIENCIES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EDUCATION|ACADEMIC(?:\s+BACKGROUND)|EDUCATIONAL(?:\s+HISTORY)|QUALIFICATIONS|ACADEMIC(?:\s+QUALIFICATIONS)|EDUCATIONAL(?:\s+QUALIFICATIONS)|DEGREES)[\s\*•:\-_\|\#]*$/i, 
      name: 'EDUCATION',
      priority: 9,
      synonyms: ['ACADEMIC BACKGROUND', 'EDUCATIONAL HISTORY', 'QUALIFICATIONS', 'ACADEMIC QUALIFICATIONS', 'EDUCATIONAL QUALIFICATIONS', 'DEGREES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EXPERIENCE|WORK(?:\s+EXPERIENCE)|EMPLOYMENT(?:\s+HISTORY)|PROFESSIONAL(?:\s+EXPERIENCE)|CAREER(?:\s+HISTORY)|JOB(?:\s+HISTORY)|WORK(?:\s+HISTORY))[\s\*•:\-_\|\#]*$/i, 
      name: 'EXPERIENCE',
      priority: 9,
      synonyms: ['WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'PROFESSIONAL EXPERIENCE', 'CAREER HISTORY', 'JOB HISTORY', 'WORK HISTORY']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:REFERENCES|PROFESSIONAL(?:\s+REFERENCES)|RECOMMENDATIONS|REFEREES)[\s\*•:\-_\|\#]*$/i, 
      name: 'REFERENCES',
      priority: 3,
      synonyms: ['PROFESSIONAL REFERENCES', 'RECOMMENDATIONS', 'REFEREES']
    },
    { 
      regex: /^\s*[\*•\-\|\#]?\s*(?:EXPECTATIONS|WHAT(?:\s+TO)?(?:\s+EXPECT)|JOB(?:\s+EXPECTATIONS)|ROLE(?:\s+REQUIREMENTS)|JOB(?:\s+REQUIREMENTS)|DESIRED(?:\s+ROLE)|EXPECTATIONS(?:\s+FROM(?:\s+THE)?(?:\s+JOB)?)|WHY(?:\s+THIS(?:\s+JOB)?)|MOTIVATIONS?)[\s\*•:\-_\|\#]*$/i, 
      name: 'EXPECTATIONS',
      priority: 4,
      synonyms: ['WHAT TO EXPECT', 'JOB EXPECTATIONS', 'ROLE REQUIREMENTS', 'JOB REQUIREMENTS', 'DESIRED ROLE', 'WHY THIS JOB', 'MOTIVATIONS']
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
    }
  }
  
  // Ensure the function has a proper return statement
  logger.info(`Parsed ${Object.keys(sections).length} sections from optimized text`);
  return sections;
}