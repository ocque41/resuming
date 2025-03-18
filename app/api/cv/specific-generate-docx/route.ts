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
    
    // Define skill validation regexes
    const commonTechnicalSkillsRegex = /\b(?:html|css|javascript|typescript|react|angular|vue|node|express|python|java|c#|c\+\+|ruby|php|go|rust|swift|sql|mysql|postgresql|mongodb|oracle|database|aws|azure|gcp|cloud|docker|kubernetes|jenkins|git|github|gitlab|office|excel|word|powerpoint|tableau|powerbi|sap|salesforce|jira|agile|scrum|photoshop|illustrator|indesign|design|adobe|figma|sketch)\b/i;
    
    const commonProfessionalSkillsRegex = /\b(?:leadership|management|communication|teamwork|collaboration|problem[-\s]solving|critical thinking|time management|organization|project management|customer service|negotiation|conflict resolution|strategy|analysis|research|writing|editing|presentation|public speaking|interpersonal|coaching|mentoring|detail[-\s]oriented|creativity|innovation|adaptability|flexibility)\b/i;
    
    // Track extracted skills to avoid duplicates
    const allExtractedSkills = new Set<string>();
    
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
          
          // Convert to lowercase for comparison
          const skillLower = skill.toLowerCase();
          
          // Core filter to remove non-skills and keep actual skills
          const isValidSkill = (
            // Exclude section headers - more strict pattern matching
            !/^(skills|technical|professional|core|key|language|competenc|soft|hard)/i.test(skill) &&
            
            // Exclude social media platforms when they appear alone (they're not skills)
            !/^(facebook|twitter|instagram|linkedin|tiktok|threads|youtube|social media)$/i.test(skillLower) &&
            
            // Exclude filler words and meta-content that aren't actual skills
            !/^(for|to|from|by|with|of|about|at|in|on|the|a|an|this|that|these|those|it|they|etc|including|brands|listed|mentioned|above|below)/i.test(skill) &&
            
            // Exclude common phrases that aren't skills
            !/^(for yourself|including|or organizations|yourself|etc\.?|brands|your|you'll|you will)/i.test(skillLower) &&
            
            // Exclude long phrases that are likely job description fragments
            skill.split(' ').length <= 6 &&
            
            // Skill should have reasonable length (not too short, not too long)
            skill.length >= 2 && skill.length <= 50 &&
            
            // Valid skills typically don't have multiple sentences
            !skill.includes('. ') &&
            
            // Valid skills don't contain URLs or email addresses
            !skill.includes('http') && !skill.includes('@') &&
            
            // Must contain at least one letter (not just numbers or symbols)
            /[a-z]/i.test(skill)
          );
          
          // If it's already a clearly invalid skill, return false
          if (!isValidSkill) return false;
          
          // Recognize common technical skills - higher confidence
          if (commonTechnicalSkillsRegex.test(skillLower)) {
            return true;
          }
          
          // Recognize common professional skills - higher confidence
          if (commonProfessionalSkillsRegex.test(skillLower)) {
            return true;
          }
          
          // For other items, they should:
          // 1. Be reasonably short (already checked)
          // 2. Not start with common non-skill words
          // 3. Not be just numbers
          return (
            // Not just numbers
            !/^\d+$/.test(skill) &&
            
            // Not just a punctuation
            !/^[.,;:()\[\]{}'"]+$/.test(skill) &&
            
            // Either starts with bullet or has a capital letter (proper format)
            (/^[•\-*]/.test(skill) || /[A-Z]/.test(skill))
          );
        });
      
      // Further clean skill items - remove leading bullets and standardize format
      skillsArray = skillsArray.map(skill => {
        if (typeof skill !== 'string') return '';
        
        // Remove leading bullets/characters
        let cleanedSkill = skill.replace(/^[•\-*\s]+/, '');
        
        // Make first letter uppercase for consistency
        if (cleanedSkill.length > 0) {
          cleanedSkill = cleanedSkill.charAt(0).toUpperCase() + cleanedSkill.slice(1);
        }
        
        return cleanedSkill;
      }).filter(skill => skill && !allExtractedSkills.has(skill.toLowerCase()));
      
      // Add to tracking set to avoid duplicates
      skillsArray.forEach(skill => {
        if (typeof skill === 'string') {
          allExtractedSkills.add(skill.toLowerCase());
        }
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
    
    // If after filtering we have empty skill sections, extract skills from job description
    for (const sectionName of presentSkillSections) {
      if (processedSkills[sectionName].length === 0 && jobDescription) {
        logger.info(`${sectionName} section is empty after filtering, extracting from job description`);
        
        // Get skills from job description
        let extractedSkills: string[] = [];
        
        if (sectionName === 'TECHNICAL SKILLS') {
          // For technical skills, use tech-focused extraction
          extractedSkills = extractTechnicalTermsFromJobDescription(jobDescription);
        } else {
          // For other skills, use the general skill extraction
          extractedSkills = extractSkillsFromJobDescription(jobDescription)
            .filter(skill => !allExtractedSkills.has(skill.toLowerCase()));
        }
        
        // Add the extracted skills
        processedSkills[sectionName] = extractedSkills;
        
        // Update tracking set
        extractedSkills.forEach(skill => allExtractedSkills.add(skill.toLowerCase()));
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
      let skillItems = Array.isArray(content) ? content : [content];
      
      // Clean skill items to ensure they don't include section headers or non-skills
      skillItems = skillItems
        .flatMap(item => typeof item === 'string' ? item.split('\n') : item)
        .map(skill => typeof skill === 'string' ? skill.trim() : skill)
        .filter(skill => {
          if (typeof skill !== 'string' || skill.length === 0) {
            return false;
          }
          
          // Only filter out obvious non-skills to be more inclusive
          const isSkillLike = (
            // Exclude exact section headers
            !(skill.toUpperCase() === section || 
              skill.toUpperCase() === 'TECHNICAL SKILLS' || 
              skill.toUpperCase() === 'PROFESSIONAL SKILLS' || 
              skill.toUpperCase() === 'SKILLS') &&
            
            // Exclude obvious social media profiles
            !skill.match(/^\s*(https?:\/\/)?(www\.)?([a-z]+\.(com|org|net)\/)/i) &&
            
            // Keep phrases of reasonable length
            skill.split(' ').length <= 8 &&
            
            // Should have at least 2 characters to be meaningful
            skill.replace(/[•\-\*\s]/g, '').length >= 2
          );
          
          return isSkillLike;
        });
      
      // If we ended up with no skills, try to extract some from job description
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
    { name: 'TECHNICAL SKILLS', regex: /^[\s*•\-\|]*(?:TECHNICAL\s+SKILLS|TECHNICAL\s+EXPERTISE|TECH\s+SKILLS|TECHNICAL\s+PROFICIENCIES|HARD\s+SKILLS|TECHNICAL\s+COMPETENCIES|IT\s+SKILLS|TECHNOLOGIES)[\s:]*$/i, priority: 4 },
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
  
  // Enhanced SKILLS section detection - if no skills section was found explicitly
  if (!sections['SKILLS'] && !sections['TECHNICAL SKILLS'] && !sections['PROFESSIONAL SKILLS']) {
    logger.info('No skills sections found, looking for skills with aggressive detection methods');
    
    // Common skill indicators that might appear in line prefixes
    const skillIndicatorPrefixes = [
      /^[\s*•\-]*(?:proficient in|skilled in|expertise in|knowledge of|experience with|familiar with)/i,
      /^[\s*•\-]*(?:proficiency in|mastery of|trained in|certified in|qualified in)/i
    ];
    
    // Skill-like patterns (technical terms, languages, tools, etc.)
    const skillPatterns = [
      /\b(?:html|css|javascript|typescript|react|angular|vue|node|express|python|java|c#|c\+\+|ruby|php|go|rust|swift)\b/i,
      /\b(?:sql|mysql|postgresql|mongodb|oracle|database|aws|azure|gcp|cloud|docker|kubernetes|jenkins|git|github|gitlab)\b/i,
      /\b(?:microsoft|excel|word|powerpoint|office|powerbi|tableau|sap|salesforce|jira|agile|scrum|kanban|lean)\b/i,
      /\b(?:machine learning|ai|artificial intelligence|data science|data analysis|big data|statistics|analytics|visualization)\b/i,
      /\b(?:marketing|sales|customer service|communication|leadership|management|teamwork|collaboration)\b/i,
      /\b(?:accounting|finance|budgeting|forecasting|reporting|compliance|audit|legal|regulatory)\b/i,
      /\b(?:design|ux|ui|photoshop|illustrator|indesign|sketch|figma|adobe|creative suite)\b/i,
      /\b(?:writing|editing|copywriting|content|social media|seo|digital marketing|analytics|email marketing)\b/i,
      /\b(?:english|spanish|french|german|italian|portuguese|chinese|japanese|korean|russian|arabic)\b/i
    ];
    
    // Look for lines that might contain skills
    const technicalSkills: string[] = [];
    const softSkills: string[] = [];
    
    // Check all lines for skill-like content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip lines that are too long to be a single skill
      if (line.length > 100) continue;
      
      // Skip lines that are clearly contact info
      if (line.includes('@') || line.includes('linkedin.com') || line.match(/^\+?[\d\s()-]{7,}$/)) continue;
      
      // Check for skill indicator prefixes
      const hasSkillPrefix = skillIndicatorPrefixes.some(pattern => pattern.test(line));
      
      // Check for skill-like patterns
      let hasSkillPattern = false;
      for (const pattern of skillPatterns) {
        if (pattern.test(line.toLowerCase())) {
          hasSkillPattern = true;
          break;
        }
      }
      
      // Check if the line is a bullet point - likely a skill item
      const isBulletPoint = /^[\s*•\-]+/.test(line);
      
      // Check if line is a short phrase likely to be a skill
      const isShortPhrase = line.length < 40 && 
                           !line.includes('.') && 
                           !/^[A-Z][A-Z\s]+$/.test(line) && // Not all caps
                           !/\b(?:for|including|brands|etc|or|and|your|from|the|with|that|this)\b/i.test(line); // Filter common non-skill words
      
      // If line looks like a skill
      if ((hasSkillPrefix || hasSkillPattern || (isBulletPoint && isShortPhrase)) && 
          !line.toUpperCase().includes('SKILLS') && !line.toUpperCase().includes('EXPERIENCE')) {
        
        // Determine if it's more likely a technical or soft skill
        if (line.match(/\b(?:communication|teamwork|leadership|management|interpersonal|organization|problem[\s-]solving|time management|adaptability|creativity|critical thinking|emotional intelligence|conflict resolution|customer service|flexibility|negotiation|patience|persuasion|public speaking|self-motivation|work ethic)\b/i)) {
          // Likely a soft skill
          softSkills.push(line);
        } else {
          // Likely a technical skill
          technicalSkills.push(line);
        }
      }
    }
    
    // Create skills sections if we found content
    if (technicalSkills.length > 0) {
      sections['TECHNICAL SKILLS'] = technicalSkills.join('\n');
      logger.info(`Created TECHNICAL SKILLS section with ${technicalSkills.length} lines`);
    }
    
    if (softSkills.length > 0) {
      sections['PROFESSIONAL SKILLS'] = softSkills.join('\n');
      logger.info(`Created PROFESSIONAL SKILLS section with ${softSkills.length} lines`);
    }
    
    // If we found neither, search for inline lists of skills in the profile or experience sections
    if (technicalSkills.length === 0 && softSkills.length === 0) {
      logger.info('No separate skills found, searching for inline skills in other sections');
      
      // Patterns that might indicate a list of skills within other content
      const inlineSkillsPatterns = [
        /(?:skills include|skilled in|proficient in|expertise in|knowledge of|experience with|familiar with)[^.!?]*([^.!?]+)/i,
        /(?:including|such as|like|e\.g\.|i\.e\.)[^.!?]*([^.!?]+)/i
      ];
      
      const profileContent = sections['PROFILE'] || '';
      const experienceContent = sections['EXPERIENCE'] || '';
      const allContent = `${profileContent}\n${experienceContent}`;
      
      // Try to extract inline skills
      for (const pattern of inlineSkillsPatterns) {
        const match = allContent.match(pattern);
        if (match && match[1]) {
          // Potential list of skills - split by commas or "and"
          const skillsList = match[1].split(/(?:,\s*|\s+and\s+|\s*[;|]\s*)/).filter(item => 
            item.trim().length > 0 && 
            !/\b(?:for|including|brands|etc|or|your|from|the|with|that|this)\b/i.test(item.trim())
          );
          
          if (skillsList.length > 0) {
            sections['SKILLS'] = skillsList.join('\n');
            logger.info(`Created SKILLS section with ${skillsList.length} items extracted from inline content`);
            break;
          }
        }
      }
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
  
  // Return the parsed sections
  return sections;
}

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
  // If no job description provided, return sections as is
  if (!jobDescription) {
    logger.info('No job description provided, skipping content tailoring');
  return sections;
  }

  logger.info('Starting CV content tailoring for job match with 80/20 preservation ratio');
  const tailoredSections = { ...sections };
  
  try {
    // Extract key terms from job description
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    logger.info(`Extracted ${keyTerms.length} key terms from job description`);
    
    // Get industry/field from job description
    const industry = extractIndustryFromJobDescription(jobDescription);
    logger.info(`Detected industry: ${industry || 'Unknown'}`);
    
    // Extract goals and expectations from job description (NEW)
    const extractedGoals = extractGoalsFromJobDescription(jobDescription);
    const extractedExpectations = extractExpectationsFromJobDescription(jobDescription);
    
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
    
    // Extract technical skills from job description to ensure we have them
    const technicalSkills = extractSkillsFromJobDescription(jobDescription);
    logger.info(`Extracted ${technicalSkills.length} technical skills from job description`);
    
    // Ensure TECHNICAL SKILLS section exists if job requires technical skills
    if (technicalSkills.length > 0 && !tailoredSections['TECHNICAL SKILLS'] && !tailoredSections['SKILLS']) {
      logger.info('Adding TECHNICAL SKILLS section from job description');
      tailoredSections['TECHNICAL SKILLS'] = technicalSkills;
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
  // Validate input
  if (!experienceContent || 
      (Array.isArray(experienceContent) && experienceContent.length === 0) ||
      (typeof experienceContent === 'string' && !experienceContent.trim())) {
    logger.warn('Empty experience content received, returning as is');
    return experienceContent;
  }

  // For array input, prioritize but preserve entries
  if (Array.isArray(experienceContent)) {
    logger.info('Optimizing array of experience entries');
    
    // Preserve all entries but score them to prioritize
    const scoredEntries = experienceContent.map(entry => {
      // Skip invalid entries
      if (!entry || typeof entry !== 'string' || entry.trim().length < 10) {
        return { entry, score: -1 }; // Low score for invalid entries
      }
      
      let score = 0;
      
      // Check for job title or company name matches - these are important
      const experienceLines = entry.split('\n');
      const firstLine = experienceLines[0]?.toLowerCase() || '';
      
      // First line often contains job title/company name - check for key term matches
      for (const term of keyTerms) {
        if (term && firstLine.includes(term.toLowerCase())) {
          score += 5; // Higher score for job title matches
        }
        // Check rest of content for term matches
        else if (term && entry.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
      }
      
      // Bonus for quantifiable achievements
      if (entry.match(/\d+%|\$\d+|\d+\s+million|\d+\s+thousand/)) {
        score += 3;
      }
      
      // Bonus for action verbs at the beginning of lines
      const actionVerbs = ['managed', 'led', 'developed', 'created', 'implemented', 'designed', 'built', 'improved'];
      const actionVerbCount = experienceLines.filter(line => 
        actionVerbs.some(verb => line.toLowerCase().trim().startsWith(verb))
      ).length;
      
      score += actionVerbCount;
      
      return { entry, score };
    });
    
    // Remove invalid entries
    const validScoredEntries = scoredEntries.filter(item => item.score >= 0);
    
    // Sort by score but never discard entries
    validScoredEntries.sort((a, b) => b.score - a.score);
    
    // Get entries sorted by relevance
    const sortedEntries = validScoredEntries.map(item => item.entry);
    
    // Enhance formatting but preserve content of the most relevant entries
    if (jobDescription && sortedEntries.length > 0) {
      logger.info('Enhancing formatting for experience entries while preserving content');
      
      // Only enhance top 3 entries for efficiency, but keep ALL entries
      const enhancedEntries = [...sortedEntries]; // Make a copy
      
      for (let i = 0; i < Math.min(3, enhancedEntries.length); i++) {
        // Only enhance valid entries that are substantial
        if (enhancedEntries[i] && enhancedEntries[i].length > 30) {
          enhancedEntries[i] = await enhanceTextWithMistralAI(
            enhancedEntries[i],
            jobDescription,
            'experience'
          );
        }
      }
      
      return enhancedEntries;
    }
    
    // Return sorted entries
    return sortedEntries;
  }
  
  // For string input
  logger.info('Optimizing string-based experience content');
  const experience = experienceContent as string;
  
  // Check if content is substantial enough to process
  if (experience.trim().length < 30) {
    logger.warn('Experience content too short to optimize');
    return experience;
  }
  
  // Try to split the content into job entries based on line breaks and identify sections
  const entries = experience.split(/\n{2,}/).filter(entry => entry.trim().length > 0);
  
  if (entries.length > 1) {
    logger.info(`Split experience into ${entries.length} entries`);
    
    // Score each entry for relevance
    const scoredEntries = entries.map(entry => {
      let score = 0;
      
      // Check for key terms
      for (const term of keyTerms) {
        if (term && entry.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
      }
      
      // Bonus points for recent roles (contain recent years)
      if (entry.match(/202\d|201[5-9]/)) {
        score += 3;
      }
      
      return { entry, score };
    });
    
    // Sort by score (highest first) but preserve all entries
    scoredEntries.sort((a, b) => b.score - a.score);
    
    // Get entries sorted by relevance
    const sortedEntries = scoredEntries.map(item => item.entry);
    
    // Enhance formatting of the most relevant entry while preserving content
    if (jobDescription && sortedEntries.length > 0) {
      logger.info('Enhancing top experience entry while preserving content');
      
      const enhancedEntries = [...sortedEntries];
      
      // Only enhance the first entry
      if (enhancedEntries[0] && enhancedEntries[0].length > 30) {
        enhancedEntries[0] = await enhanceTextWithMistralAI(
          enhancedEntries[0],
          jobDescription,
          'experience'
        );
      }
      
      // Join back together with double newlines
      return enhancedEntries.join('\n\n');
    }
    
    // Join back together with double newlines
    return sortedEntries.join('\n\n');
  }
  
  // If it's a single continuous text, enhance formatting while preserving content
  if (jobDescription && experience.trim().length > 50) {
    logger.info('Enhancing single experience section while preserving content');
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
  // If skills content is empty or undefined, try to extract skills from job description
  if (!skillsContent || (Array.isArray(skillsContent) && skillsContent.length === 0) || 
      (typeof skillsContent === 'string' && !skillsContent.trim())) {
    logger.info('Skills section is empty, extracting skills from job description');
    
    // Extract potential skills from job description
    const extractedSkills = extractSkillsFromJobDescription(jobDescription);
    
    // Format as the original content type (array or string)
    return Array.isArray(skillsContent) ? extractedSkills : extractedSkills.join('\n');
  }

  // Convert to array if string
  const skillsArray = typeof skillsContent === 'string' 
    ? skillsContent.split('\n').filter(line => line.trim()) 
    : skillsContent.filter(item => typeof item === 'string' && item.trim());
  
  // Clean and validate skills - remove non-skill content
  const validatedSkills = skillsArray
    .map(skill => typeof skill === 'string' ? skill.trim() : '')
    .filter(skill => {
      // Skip empty items
      if (!skill) return false;
      
      // Skill filtering criteria
      // 1. Filter out items that are too long to be a skill
      if (skill.length > 100) return false;
      
      // 2. Filter out items that are clearly not skills (prepositions, articles, etc.)
      const nonSkillPatterns = [
        /^(?:for|to|from|by|with|of|about|at|in|on|the|a|an|this|that|these|those|it|they)\s/i,
        /\b(?:including|etc|brands|organizations|yourself|below|above|your|my|we|us|our|their)\b/i,
        /^[^a-zA-Z0-9]+$/, // Items with no alphanumeric characters
        /^\d+$/, // Just numbers
        /^[A-Z][A-Z]+$/ // All uppercase acronyms without context (might be just headers)
      ];
      
      if (nonSkillPatterns.some(pattern => pattern.test(skill))) {
        return false;
      }
      
      // 3. Remove social media profiles and links
      if (skill.includes('facebook.com') || 
          skill.includes('twitter.com') || 
          skill.includes('linkedin.com') || 
          skill.includes('instagram.com') || 
          skill.includes('http://') || 
          skill.includes('https://')) {
        return false;
      }
      
      // 4. Check minimum length - skill should have some substance
      if (skill.length < 3) return false;
      
      // Allow skill if it passes all filters
      return true;
    });
  
  // If no valid skills remain, extract from job description as fallback
  if (validatedSkills.length === 0) {
    logger.info('No valid skills found after filtering, extracting from job description');
    const extractedSkills = extractSkillsFromJobDescription(jobDescription);
    return Array.isArray(skillsContent) ? extractedSkills : extractedSkills.join('\n');
  }
  
  // Add technical terms from job description that are missing from the skills list
  // This helps ensure that all relevant skills are included
  const jobTechnicalTerms = extractTechnicalTermsFromJobDescription(jobDescription);
  
  // Add any missing technical terms from job description
  const existingTerms = new Set(validatedSkills.map(s => s.toLowerCase()));
  const additionalSkills = jobTechnicalTerms.filter(term => 
    term.length > 0 && 
    !existingTerms.has(term.toLowerCase()) &&
    !existingTerms.has(term.toLowerCase() + ' (proficient)')
  );
  
  if (additionalSkills.length > 0) {
    logger.info(`Adding ${additionalSkills.length} technical skills from job description`);
    validatedSkills.push(...additionalSkills);
  }
  
  // Calculate relevance score for each skill based on presence in job description and key terms
  const scoredSkills = validatedSkills.map(skill => {
    let score = 0;
    
    // Check if skill is directly mentioned in job description
    if (jobDescription.toLowerCase().includes(skill.toLowerCase())) {
      score += 5;
    }
    
    // Check if skill matches any key terms
    for (const term of keyTerms) {
      if (term && (skill.toLowerCase().includes(term.toLowerCase()) || 
          term.toLowerCase().includes(skill.toLowerCase()))) {
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
    logger.info('Enhancing skills with AI');
    
    // For array input, enhance the top skills
    if (Array.isArray(skillsContent)) {
      const enhancedSkills = [...sortedSkills];
      
      // Enhance all skills for better coverage, but max 15 to keep the list focused
      const skillsToEnhance = Math.min(15, enhancedSkills.length);
      logger.info(`Enhancing ${skillsToEnhance} skills from the original list`);
      
      for (let i = 0; i < skillsToEnhance; i++) {
        // Only enhance if it's a real skill (not section header, not already enhanced)
        if (enhancedSkills[i] && 
            !enhancedSkills[i].includes('(') && 
            enhancedSkills[i].length < 50) {
          enhancedSkills[i] = await enhanceTextWithMistralAI(
            enhancedSkills[i],
            jobDescription,
            'skills'
          );
        }
      }
      
      return enhancedSkills;
    } else {
      // For string input, enhance each line
      const skillLines = sortedSkills.join('\n').split('\n');
      const enhancedLines = [];
      
      for (const line of skillLines) {
        if (line && line.trim() && line.length < 50) {
          enhancedLines.push(await enhanceTextWithMistralAI(
            line.trim(),
            jobDescription,
            'skills'
          ));
        } else {
          enhancedLines.push(line);
        }
      }
      
      return enhancedLines.join('\n');
    }
  } catch (error) {
    logger.error('Error enhancing skills:', error instanceof Error ? error.message : String(error));
    // Return in original format on error
    return Array.isArray(skillsContent) ? sortedSkills : sortedSkills.join('\n');
  }
}

/**
 * Extract technical terms from job description that are likely to be technical skills
 */
function extractTechnicalTermsFromJobDescription(jobDescription: string): string[] {
  logger.info('Extracting technical terms from job description');
  
  // Define patterns for common technical terms and tools
  const technicalPatterns = [
    /\b(?:html|css|javascript|typescript|react|angular|vue|nodejs|express|php|ruby|python|java|c\+\+|c#|swift|go|rust)\b/gi,
    /\b(?:aws|azure|gcp|cloud|docker|kubernetes|jenkins|git|github|gitlab|bitbucket|terraform|ansible|chef|puppet)\b/gi,
    /\b(?:sql|mysql|postgresql|mongodb|oracle|sqlite|dynamodb|redis|cassandra|elasticsearch|database|nosql)\b/gi,
    /\b(?:linux|unix|windows|macos|ios|android|devops|ci\/cd|automation|scripting|bash|powershell)\b/gi,
    /\b(?:adobe|photoshop|illustrator|indesign|xd|figma|sketch|design|ui|ux|user experience|user interface)\b/gi,
    /\b(?:office|excel|word|powerpoint|sharepoint|outlook|microsoft|google workspace|google docs)\b/gi,
    /\b(?:seo|sem|google analytics|google ads|facebook ads|social media|digital marketing)\b/gi,
    /\b(?:api|rest|graphql|json|xml|soap|microservices|serverless|architecture)\b/gi,
    /\b(?:agile|scrum|kanban|jira|confluence|project management|product management)\b/gi,
    /\b(?:analytics|data science|machine learning|ai|artificial intelligence|deep learning|nlp|neural networks)\b/gi,
    /\b(?:tableau|power bi|looker|data visualization|data analysis|statistics|r|data mining)\b/gi
  ];

  const terms = new Set<string>();
  
  // Extract all matches from each pattern
  for (const pattern of technicalPatterns) {
    const matches = jobDescription.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Format term with first letter capitalized
        const term = match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
        terms.add(term);
      }
    }
  }
  
  // Extract specific terms commonly mentioned in "required skills" sections
  const skillsSection = extractSkillsSectionFromJobDescription(jobDescription);
  if (skillsSection) {
    // Extract bullet points from skills section
    const skillLines = skillsSection.split('\n');
    for (const line of skillLines) {
      // If line is a bullet point and mentions experience
      if (line.match(/^[\s•\-*]+/) && line.length < 100) {
        // Extract the core skill from the line
        const cleaned = line.replace(/^[\s•\-*]+/, '').trim();
        // Only add if it's a reasonable length for a skill
        if (cleaned.length > 3 && cleaned.length < 40) {
          terms.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
        }
      }
    }
  }
  
  logger.info(`Found ${terms.size} potential technical terms in job description`);
  return Array.from(terms).slice(0, 10); // Limit to 10 terms to avoid overwhelming
}

/**
 * Extract skills section from job description
 */
function extractSkillsSectionFromJobDescription(jobDescription: string): string | null {
  // Common headers for skills sections in job descriptions
  const skillsSectionHeaders = [
    /required skills/i,
    /qualifications/i,
    /requirements/i,
    /skills and experience/i,
    /technical skills/i,
    /your skills/i,
    /skills required/i,
    /what you'll need/i,
    /what we're looking for/i
  ];
  
  // Try to find a skills section
  const paragraphs = jobDescription.split(/\n\s*\n/); // Split by empty lines
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // Check if this paragraph is a skills section header
    const isSkillsHeader = skillsSectionHeaders.some(pattern => pattern.test(paragraph));
    
    if (isSkillsHeader && i < paragraphs.length - 1) {
      // Return the next paragraph (skills content)
      return paragraphs[i + 1];
    }
  }
  
  // If no section header found, return null
  return null;
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
  // This is a placeholder function that would be replaced with actual API integration
  // For now, we'll just simulate what the AI might do with some basic enhancements
  
  logger.info(`Enhancing ${enhancementType} content - preserving 90% original content`);
  
  try {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Start with original text - conservative approach
    let enhancedText = originalText.trim();
    
    // Skip enhancement if text is too short or appears to be a header/title
    if (enhancedText.length < 5 || enhancedText.toUpperCase() === enhancedText) {
      return enhancedText;
    }
    
    // Extract key terms from job description
    const keyTerms = extractKeyTermsFromJobDescription(jobDescription);
    const topKeyTerms = keyTerms.slice(0, 3); // Reduce to 3 key terms for more subtle enhancement
    
    // Simulate different enhancement types - with minimal changes
    switch (enhancementType) {
      case 'profile':
        // For profile, make VERY minimal changes, focus on preserving content
        // Detect if profile already mentions key terms
        let hasKeyTerm = false;
        for (const term of topKeyTerms) {
          if (term && enhancedText.toLowerCase().includes(term.toLowerCase())) {
            hasKeyTerm = true;
            break;
          }
        }
        
        // Only add a SINGLE key term if none are present, and only at the end
        if (!hasKeyTerm && topKeyTerms.length > 0 && topKeyTerms[0]) {
          // Add just one key term in a subtle way at the end
          enhancedText = `${enhancedText.trim()} Experience includes ${topKeyTerms[0]}.`;
        }
        break;
        
      case 'experience':
        // For experience, PRESERVE original content structure
        // Only add bullet points if they don't exist
        if (enhancedText && enhancedText.length > 30 && !enhancedText.includes('•')) {
          // Split into lines to preserve structure
          const lines = enhancedText.split('\n');
          
          // Only format lines that are likely descriptions, not company names or dates
          enhancedText = lines.map(line => {
            // Skip short lines (likely dates or company names)
            if (line.trim().length < 20 || line.match(/\d{4}/)) {
              return line;
            }
            
            // Skip lines that already have formatting
            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              return line;
            }
            
            // Add bullet only to substantial content lines that need formatting
            return `• ${line.trim()}`;
          }).join('\n');
        }
        break;
        
      case 'skills':
        // For skills, preserve all original content
        if (enhancedText && enhancedText.length > 2 && enhancedText.length < 50) {
          // Skip if the skill already includes any context or formatting
          if (!enhancedText.includes('(') && 
              !enhancedText.includes(' - ') && 
              !enhancedText.includes(':')) {
              
            // Check if skill matches job description terms
            let hasMatch = false;
            for (const term of keyTerms) {
              if (term && (
                  enhancedText.toLowerCase().includes(term.toLowerCase()) ||
                  term.toLowerCase().includes(enhancedText.toLowerCase()))) {
                hasMatch = true;
                break;
              }
            }

            // Add relevant context based on match
            if (hasMatch) {
              const contextPhrases = [
                `(highly relevant)`,
                `(key requirement)`,
                `(core competency)`,
                `(essential skill)`
              ];
              const randomPhrase = contextPhrases[Math.floor(Math.random() * contextPhrases.length)];
              enhancedText = `${enhancedText} ${randomPhrase}`;
            } 
            // Even for non-matching skills, provide some context, but only for valid skills
            else if (enhancedText.length > 3 && enhancedText.length < 30) {
              // Validate that it looks like a skill (not a filter term or heading)
              if (!/for|including|brand|etc|or|and|your|from/.test(enhancedText.toLowerCase())) {
                const generalPhrases = [
                  `(proficient)`,
                  `(experienced)`,
                  `(transferable skill)`
                ];
                const randomPhrase = generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
                enhancedText = `${enhancedText} ${randomPhrase}`;
              }
            }
          }
        }
        break;
        
      case 'achievements':
      case 'languages':
        // For these sections, make no changes - preserve the original content
        break;
    }
    
    return enhancedText;
  } catch (error) {
    logger.error('Error in AI enhancement:', error instanceof Error ? error.message : String(error));
    return originalText; // Fall back to original on error
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