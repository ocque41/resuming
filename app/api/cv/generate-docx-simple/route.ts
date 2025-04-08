export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  BorderStyle,
  Header,
  Footer,
  Tab,
  Table,
  TableRow,
  TableCell,
  WidthType
} from 'docx';

/**
 * Simple, optimized document generator for CV content
 * Generates a DOCX file from the provided CV content with minimal processing
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized access attempt to generate-docx-simple API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { content, jobTitle = 'Position', cvId, metadata = {} } = body;
    
    if (!content) {
      logger.error('Missing content in generate-docx-simple request');
      return NextResponse.json(
        { success: false, error: 'Missing content' },
        { status: 400 }
      );
    }
    
    logger.info(`Generating formatted CV document for job: ${jobTitle}`);
    
    // Generate properly formatted CV document
    const doc = await createFormattedCVDocument(content, jobTitle);
    
    // Generate document buffer
    const buffer = await Packer.toBuffer(doc);
    
    // Return the generated document
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="CV_${jobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`,
      },
    });
  } catch (error) {
    logger.error('Error in generate-docx-simple API:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: 'Failed to generate document' },
      { status: 500 }
    );
  }
}

/**
 * Extract the person's name and contact info from the CV content
 */
function extractPersonInfo(content: string): { name: string, contactInfo: string } {
  try {
    // Try to parse JSON if the content is in JSON format
    let textContent = content;
    try {
      const jsonData = JSON.parse(content);
      if (jsonData.tailoredContent) {
        textContent = jsonData.tailoredContent;
      }
    } catch (e) {
      // Not JSON, continue with regular text processing
    }

    // Look for name pattern - usually at the beginning of the CV
    const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // First non-empty line is often the name
    let name = lines[0];
    
    // If name looks like a section title (all caps, contains "PROFILE", etc.), use a default
    if (name.toUpperCase() === name && 
        (name.includes('PROFILE') || name.includes('SUMMARY') || name.includes('EXPERIENCE') || name.includes('EDUCATION'))) {
      name = 'CV Candidate';
    }
    
    // Try to find contact info (email, phone, location)
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
    const phonePattern = /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/;
    const locationPattern = /(?:[A-Za-z]+(?:,?\s+)[A-Za-z]+(?:,?\s+)[A-Za-z]+)/;
    
    let contactInfo = '';
    
    // Look in the first few lines for contact info
    for (let i = 1; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (emailPattern.test(line) || phonePattern.test(line) || locationPattern.test(line)) {
        contactInfo = line;
        break;
      }
    }
    
    return { name, contactInfo };
  } catch (error) {
    logger.error('Error extracting person info:', error instanceof Error ? error.message : String(error));
    return { name: 'CV Candidate', contactInfo: '' };
  }
}

/**
 * Extract sections from the CV content
 */
function extractSections(content: string): Record<string, string> {
  try {
    // Try to parse JSON if the content is in JSON format
    let textContent = content;
    try {
      const jsonData = JSON.parse(content);
      if (jsonData.tailoredContent) {
        textContent = jsonData.tailoredContent;
        
        // If we have structured section improvements, we can use them to identify sections
        if (jsonData.sectionImprovements) {
          const sectionMapping: Record<string, string> = {
            'profile': 'PROFILE',
            'skills': 'SKILLS',
            'experience': 'EXPERIENCE',
            'education': 'EDUCATION',
            'achievements': 'ACHIEVEMENTS',
            'goals': 'GOALS'
          };
          
          // Log the available sections from Mistral
          logger.info('Sections identified in Mistral response:', Object.keys(jsonData.sectionImprovements));
        }
      }
    } catch (e) {
      // Not JSON, continue with regular text processing
    }
    
    const sections: Record<string, string> = {
      'PROFILE': '',
      'GOALS': '',
      'SKILLS': '',
      'EXPERIENCE': '',
      'EDUCATION': '',
      'ACHIEVEMENTS': ''
    };
    
    // Common section headers
    const sectionPatterns: Record<string, RegExp> = {
      'PROFILE': /\b(PROFILE|SUMMARY|ABOUT|OBJECTIVE|PROFESSIONAL SUMMARY)\b/i,
      'GOALS': /\b(GOALS|OBJECTIVES|CAREER GOALS|PROFESSIONAL OBJECTIVES)\b/i,
      'SKILLS': /\b(SKILLS|COMPETENCIES|CAPABILITIES|EXPERTISE|QUALIFICATIONS)\b/i,
      'EXPERIENCE': /\b(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL EXPERIENCE)\b/i,
      'EDUCATION': /\b(EDUCATION|ACADEMIC|QUALIFICATIONS|DEGREES|ACADEMIC BACKGROUND)\b/i,
      'ACHIEVEMENTS': /\b(ACHIEVEMENTS|ACCOMPLISHMENTS|HONORS|AWARDS|KEY ACHIEVEMENTS)\b/i
    };
    
    // Split content by lines
    const lines = textContent.split('\n');
    let currentSection = '';
    let sectionContent = '';
    
    for (const line of lines) {
      // Check if this line is a section header
      let isSectionHeader = false;
      
      for (const [section, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(line) && line.length < 50) { // Section headers are typically short
          // Save previous section content if any
          if (currentSection && sectionContent) {
            sections[currentSection] = sectionContent.trim();
          }
          
          // Start new section
          currentSection = section;
          sectionContent = '';
          isSectionHeader = true;
          break;
        }
      }
      
      // If not a section header, add to current section
      if (!isSectionHeader && currentSection) {
        sectionContent += line + '\n';
      } else if (!isSectionHeader && !currentSection && !line.includes(extractPersonInfo(content).name)) {
        // If we haven't assigned a section yet and this isn't the name,
        // it might be part of the profile
        sections['PROFILE'] += line + '\n';
      }
    }
    
    // Save the last section
    if (currentSection && sectionContent) {
      sections[currentSection] = sectionContent.trim();
    }
    
    // If PROFILE isn't found but there's content at the beginning, use it as profile
    if (!sections['PROFILE'] && lines.length > 0) {
      let profileContent = '';
      let i = 0;
      
      // Skip name and contact info (first few lines)
      i = Math.min(2, lines.length);
      
      // Collect lines until we hit another section
      while (i < lines.length) {
        let isOtherSectionHeader = false;
        for (const [section, pattern] of Object.entries(sectionPatterns)) {
          if (section !== 'PROFILE' && pattern.test(lines[i])) {
            isOtherSectionHeader = true;
            break;
          }
        }
        
        if (isOtherSectionHeader) break;
        profileContent += lines[i] + '\n';
        i++;
      }
      
      if (profileContent.trim()) {
        sections['PROFILE'] = profileContent.trim();
      }
    }
    
    return sections;
  } catch (error) {
    logger.error('Error extracting sections:', error instanceof Error ? error.message : String(error));
    return {
      'PROFILE': 'Profile information not available',
      'GOALS': '',
      'SKILLS': '',
      'EXPERIENCE': '',
      'EDUCATION': '',
      'ACHIEVEMENTS': ''
    };
  }
}

/**
 * Format a section with bullet points for items that look like list entries
 */
function formatSectionContent(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines) {
    // Expanded list of bullet point indicators
    const bulletPointIndicators = [
      '•', '-', '*', '+', '➢', '➤', '▶', '►', '○', '●', '■', '□', '➟', '⦿', '⟡', '⟢', 
      '⥤', '→', '⇒', '⇨', '⟶', '⤷', '⁃', '‣', '⁌', '⁍', '⦾', '⦿', '⧫', '⧪'
    ];
    
    // Check if line starts with a bullet point indicator
    const startsWithBullet = bulletPointIndicators.some(bullet => line.startsWith(bullet));
    
    // Check for common bullet point patterns
    const bulletPointPatterns = [
      /^\s*[\-–—•]\s+/,             // Dash or bullet with space
      /^\s*\d+\.\s+/,               // Numbered list (1. )
      /^\s*\([a-z\d]\)\s+/,         // Letter/number in parentheses ((a) )
      /^\s*[a-z\d]\)\s+/,           // Letter/number with parenthesis (a) )
      /^\s*[ivxIVX]+\.\s+/,         // Roman numerals (i., ii., etc.)
      /^\s*[A-Z]\.\s+/              // Capital letter with period (A. )
    ];
    
    const looksLikeBulletPoint = bulletPointPatterns.some(pattern => pattern.test(line));
    
    // Function to clean bullet points from the beginning of a line
    const cleanBulletPoint = (text: string) => {
      // Try each pattern and remove the bullet point
      for (const pattern of bulletPointPatterns) {
        if (pattern.test(text)) {
          return text.replace(pattern, '');
        }
      }
      
      // Try removing specific bullet characters
      for (const bullet of bulletPointIndicators) {
        if (text.startsWith(bullet)) {
          return text.substring(bullet.length).trim();
        }
      }
      
      return text;
    };
    
    if (startsWithBullet || looksLikeBulletPoint) {
      // Format as a bullet point
      const cleanedLine = cleanBulletPoint(line);
      
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            new TextRun({ text: cleanedLine }),
          ],
          indent: { left: 360 }, // Indent for bullet points
          spacing: { before: 100, after: 100 },
        })
      );
    } else {
      // Regular paragraph
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 120 },
        })
      );
    }
  }
  
  return paragraphs;
}

/**
 * Create a formatted CV document with name, sections, and proper formatting
 */
async function createFormattedCVDocument(content: string, jobTitle: string): Promise<Document> {
  // Try to parse JSON format first
  let tailoredContent = content;
  let enhancedProfile = '';
  let sectionImprovements: Record<string, string> = {};
  
  try {
    const jsonData = JSON.parse(content);
    if (jsonData.tailoredContent) {
      tailoredContent = jsonData.tailoredContent;
      
      // Get enhanced profile if available
      if (jsonData.enhancedProfile) {
        enhancedProfile = jsonData.enhancedProfile;
      }
      
      // Get section improvements if available
      if (jsonData.sectionImprovements) {
        sectionImprovements = jsonData.sectionImprovements;
        logger.info('Section improvements from Mistral:', Object.keys(sectionImprovements));
      }
    }
  } catch (e) {
    // Not JSON, continue with regular text processing
    logger.info('Content is not in JSON format, processing as plain text');
  }
  
  // Extract person info and sections
  const { name, contactInfo } = extractPersonInfo(tailoredContent);
  const sections = extractSections(tailoredContent);
  
  // If we have an enhanced profile from Mistral, use it
  if (enhancedProfile && (!sections['PROFILE'] || sections['PROFILE'].trim().length === 0)) {
    sections['PROFILE'] = enhancedProfile;
  }
  
  // Document children to build
  const children: Paragraph[] = [];
  
  // Add name as document title
  children.push(
    new Paragraph({
      text: name,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      border: {
        bottom: {
          color: '#000000',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 1,
        },
      },
      spacing: { after: 200 },
    })
  );
  
  // Add contact info
  if (contactInfo) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactInfo, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }
  
  // Define section order
  const sectionOrder = [
    'PROFILE', 
    'GOALS', 
    'SKILLS', 
    'EXPERIENCE', 
    'EDUCATION', 
    'ACHIEVEMENTS'
  ];
  
  // Add each section in the defined order
  for (const sectionName of sectionOrder) {
    const sectionContent = sections[sectionName];
    
    // Skip empty sections
    if (!sectionContent || sectionContent.trim().length === 0) continue;
    
    // Add section header with bottom border for visual separation
    children.push(
      new Paragraph({
        text: sectionName,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: {
            color: '#B4916C', // Use the brand's micro touch color for subtle styling
            space: 1,
            style: BorderStyle.SINGLE,
            size: 1,
          },
        },
      })
    );
    
    // Add improvement note if available (as a comment or small text)
    const lowerSectionName = sectionName.toLowerCase();
    if (sectionImprovements[lowerSectionName]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: sectionImprovements[lowerSectionName],
              size: 16,
              italics: true,
              color: '#666666'
            })
          ],
          spacing: { before: 0, after: 200 },
        })
      );
    }
    
    // Add section content with appropriate formatting
    children.push(...formatSectionContent(sectionContent));
  }
  
  // Create document with all sections and content
  const doc = new Document({
    title: `Optimized CV for ${jobTitle}`,
    description: 'Optimized CV generated by CV Optimizer',
    sections: [{
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
      children: children,
    }],
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: {
            font: 'Calibri',
            size: 24,
            color: '#050505', // Use brand main color
          },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: { line: 276 }, // Approximately 1.15 line spacing
          },
        },
        {
          id: 'Title',
          name: 'Title',
          run: {
            font: 'Calibri',
            size: 36,
            bold: true,
            color: '#050505', // Use brand main color
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
          },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          run: {
            font: 'Calibri',
            size: 28,
            bold: true,
            color: '#050505', // Use brand main color
          },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 120 },
          },
        },
      ],
    },
  });
  
  return doc;
} 