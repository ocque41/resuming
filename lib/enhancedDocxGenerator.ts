import * as fs from 'fs';
import * as path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType, Table, TableRow, TableCell, WidthType, convertInchesToTwip, ShadingType } from "docx";
import { promises as fsPromises } from 'fs';

/**
 * Interface for a formatted CV with structured sections
 */
interface FormattedCV {
  profile: string;
  achievements: string[];
  experience: {
    company: string;
    position: string;
    duration: string;
    responsibilities: string[];
  }[];
  skills: string[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  languages: {
    language: string;
    proficiency: string;
  }[];
}

/**
 * Interface for CV sections
 */
interface CVSection {
  title: string;
  content: string;
}

/**
 * Parses sections from markdown-formatted CV text
 */
export function parseStandardCVSections(cvText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Split the text by headings (lines starting with #)
  const sectionRegex = /(?:^|\n)#\s+([A-Z\s]+)\s*\n([\s\S]*?)(?=(?:\n#\s+[A-Z\s]+)|$)/g;
  
  let match;
  while ((match = sectionRegex.exec(cvText)) !== null) {
    const sectionName = match[1].trim();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }
  
  return sections;
}

/**
 * Parse the optimized CV text into a structured format
 */
export function parseOptimizedCVContent(optimizedText: string): FormattedCV {
  const sections = parseStandardCVSections(optimizedText);
  
  // Parse profile
  const profile = sections['PROFILE'] || '';
  
  // Parse achievements
  const achievementsText = sections['ACHIEVEMENTS'] || '';
  const achievements = achievementsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.substring(1).trim());
  
  // Parse experience
  const experienceText = sections['EXPERIENCE'] || '';
  const experienceBlocks = experienceText.split(/\n##\s+/).filter(Boolean);
  if (experienceBlocks[0] && !experienceBlocks[0].startsWith('##')) {
    experienceBlocks[0] = experienceBlocks[0].replace(/^#*\s+/, '');
  }
  
  const experience = experienceBlocks.map(block => {
    const lines = block.split('\n').filter(line => line.trim());
    const headerLine = lines[0] || '';
    
    // Parse company and position (format: "Company Name - Position (Start Date - End Date)")
    const headerMatch = headerLine.match(/(.*?)\s*-\s*(.*?)\s*\((.*?)\)/);
    
    const company = headerMatch ? headerMatch[1].trim() : headerLine;
    const position = headerMatch ? headerMatch[2].trim() : '';
    const duration = headerMatch ? headerMatch[3].trim() : '';
    
    // Parse responsibilities (bullet points)
    const responsibilities = lines
      .slice(1)
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.substring(1).trim());
    
    return {
      company,
      position,
      duration,
      responsibilities
    };
  });
  
  // Parse skills
  const skillsText = sections['SKILLS'] || '';
  const skills = skillsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.substring(1).trim());
  
  // Parse education
  const educationText = sections['EDUCATION'] || '';
  const educationLines = educationText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  const education = educationLines.map(line => {
    // Format: "[Degree] in [Field of Study], [Institution], [Graduation Year]"
    const matches = line.match(/(.*?)\s*,\s*(.*?)(?:\s*,\s*(.*))?$/);
    
    if (matches) {
      return {
        degree: matches[1] || '',
        institution: matches[2] || '',
        year: matches[3] || ''
      };
    }
    
    return {
      degree: line,
      institution: '',
      year: ''
    };
  });
  
  // Parse languages
  const languagesText = sections['LANGUAGES'] || '';
  const languageLines = languagesText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  const languages = languageLines.map(line => {
    // Format: "[Language]: [Proficiency Level]"
    const parts = line.split(':').map(part => part.trim());
    
    return {
      language: parts[0] || '',
      proficiency: parts[1] || ''
    };
  });
  
  return {
    profile,
    achievements,
    experience,
    skills,
    education,
    languages
  };
}

/**
 * Generate a DOCX file from optimized CV content
 */
export async function generateEnhancedCVDocx(
  optimizedContent: string,
  outputDir: string = '/tmp',
  fileName: string = 'optimized-cv.docx'
): Promise<{ filePath: string; base64: string }> {
  // Parse the optimized CV content
  const formattedCV = parseOptimizedCVContent(optimizedContent);
  
  // Define colors
  const primaryColor = "2F5496"; // Blue
  const secondaryColor = "808080"; // Gray for secondary text
  
  // Create document
  const doc = new Document({
    styles: {
      default: {
        heading1: {
          run: {
            size: 28,
            bold: true,
            color: primaryColor,
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
        heading2: {
          run: {
            size: 26,
            bold: true,
            color: primaryColor,
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
      }
    },
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
        children: [
          // Profile Section
          new Paragraph({
            text: "PROFILE",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          new Paragraph({
            text: formattedCV.profile,
            spacing: {
              after: 200,
            },
          }),
          
          // Achievements Section
          new Paragraph({
            text: "ACHIEVEMENTS",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.achievements.map(
            achievement => new Paragraph({
              text: achievement,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 120,
              },
            })
          ),
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),
          
          // Experience Section
          new Paragraph({
            text: "EXPERIENCE",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.experience.flatMap(exp => [
            new Paragraph({
              text: `${exp.company} - ${exp.position}`,
              heading: HeadingLevel.HEADING_2,
              spacing: {
                after: 80,
              },
            }),
            new Paragraph({
              text: exp.duration,
              spacing: {
                after: 120,
              },
            }),
            ...exp.responsibilities.map(
              resp => new Paragraph({
                text: resp,
                bullet: {
                  level: 0,
                },
                spacing: {
                  after: 80,
                },
              })
            ),
            new Paragraph({
              text: "",
              spacing: {
                after: 160,
              },
            }),
          ]),
          
          // Skills Section
          new Paragraph({
            text: "SKILLS",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.skills.map(
            skill => new Paragraph({
              text: skill,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 80,
              },
            })
          ),
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),
          
          // Education Section
          new Paragraph({
            text: "EDUCATION",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.education.flatMap(edu => [
            new Paragraph({
              text: edu.degree,
              heading: HeadingLevel.HEADING_2,
              spacing: {
                after: 80,
              },
            }),
            new Paragraph({
              text: `${edu.institution}${edu.year ? `, ${edu.year}` : ''}`,
              spacing: {
                after: 160,
              },
            }),
          ]),
          
          // Languages Section
          new Paragraph({
            text: "LANGUAGES",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.languages.map(
            lang => new Paragraph({
              text: `${lang.language}: ${lang.proficiency}`,
              spacing: {
                after: 80,
              },
            })
          ),
        ],
      },
    ],
  });
  
  // Ensure the output directory exists
  try {
    await fsPromises.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Error creating output directory:', error);
  }
  
  // Generate file path
  const filePath = path.join(outputDir, fileName);
  
  // Create a buffer with the docx
  const buffer = await Packer.toBuffer(doc);
  
  // Write the file to disk
  await fsPromises.writeFile(filePath, buffer);
  
  // Convert to base64 for preview or download
  const base64 = buffer.toString('base64');
  
  return {
    filePath,
    base64,
  };
}

/**
 * Extract sections from raw CV text
 */
export function extractCVSections(rawText: string): CVSection[] {
  const sections: CVSection[] = [];
  const sectionTitles = [
    'PROFILE', 'SUMMARY', 'ABOUT', 'OBJECTIVE',
    'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT', 'PROFESSIONAL EXPERIENCE',
    'EDUCATION', 'ACADEMIC BACKGROUND', 'QUALIFICATIONS',
    'SKILLS', 'COMPETENCIES', 'TECHNICAL SKILLS',
    'LANGUAGES', 'LANGUAGE PROFICIENCY',
    'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES',
    'PROJECTS', 'ACHIEVEMENTS', 'AWARDS'
  ];
  
  // Split text into lines
  const lines = rawText.split(/\r?\n/);
  let currentSection: CVSection | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Check if this line is a section title
    const isSectionTitle = sectionTitles.some(title => 
      trimmedLine.toUpperCase().includes(title) && 
      (trimmedLine.toUpperCase() === title || 
       trimmedLine.toUpperCase().startsWith(title + ':') ||
       trimmedLine.toUpperCase().startsWith(title + ' '))
    );
    
    if (isSectionTitle) {
      // If we were building a section, push it to our array
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start a new section
      currentSection = {
        title: trimmedLine,
        content: ''
      };
    } else if (currentSection) {
      // Add this line to the current section
      currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
    }
  }
  
  // Add the last section if it exists
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
} 