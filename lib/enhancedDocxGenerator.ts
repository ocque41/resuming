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
  
  // Try different section heading formats
  
  // Format 1: Lines starting with # (markdown headings)
  const markdownRegex = /(?:^|\n)#\s+([A-Z\s]+)\s*\n([\s\S]*?)(?=(?:\n#\s+[A-Z\s]+)|$)/g;
  let match;
  while ((match = markdownRegex.exec(cvText)) !== null) {
    const sectionName = match[1].trim().toUpperCase();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }
  
  // If no sections found with markdown headings, try uppercase section names
  if (Object.keys(sections).length === 0) {
    // Format 2: Lines in all caps followed by content
    const uppercaseRegex = /(?:^|\n)([A-Z][A-Z\s]+)(?:\:|\n)([\s\S]*?)(?=(?:\n[A-Z][A-Z\s]+(?:\:|\n))|$)/g;
    while ((match = uppercaseRegex.exec(cvText)) !== null) {
      const sectionName = match[1].trim().toUpperCase();
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }
  }
  
  // If still no sections found, try title case section names
  if (Object.keys(sections).length === 0) {
    // Format 3: Lines in Title Case followed by content
    const titleCaseRegex = /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\:|\n)([\s\S]*?)(?=(?:\n[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\:|\n))|$)/g;
    while ((match = titleCaseRegex.exec(cvText)) !== null) {
      const sectionName = match[1].trim().toUpperCase();
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }
  }
  
  // If still no sections found, try looking for common section names
  if (Object.keys(sections).length === 0) {
    const commonSections = [
      'PROFILE', 'SUMMARY', 'ABOUT', 'OBJECTIVE',
      'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT', 'PROFESSIONAL EXPERIENCE',
      'EDUCATION', 'ACADEMIC BACKGROUND', 'QUALIFICATIONS',
      'SKILLS', 'COMPETENCIES', 'TECHNICAL SKILLS',
      'LANGUAGES', 'LANGUAGE PROFICIENCY',
      'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES',
      'PROJECTS', 'ACHIEVEMENTS', 'AWARDS'
    ];
    
    for (const section of commonSections) {
      const regex = new RegExp(`(?:^|\\n)${section}[\\s\\:\\n](.*?)(?=(?:\\n(?:${commonSections.join('|')})[\\s\\:\\n])|$)`, 'is');
      match = regex.exec(cvText);
      if (match) {
        sections[section] = match[1].trim();
      }
    }
  }
  
  return sections;
}

/**
 * Parse the optimized CV text into a structured format
 */
export function parseOptimizedCVContent(optimizedText: string): FormattedCV {
  // First, try to parse using standard section headings
  const sections = parseStandardCVSections(optimizedText);
  
  // If we couldn't find any sections with the standard parser, try to extract sections
  // using a more flexible approach
  const isEmpty = Object.keys(sections).length === 0;
  
  if (isEmpty) {
    console.log("No standard sections found, using flexible section extraction");
    const extractedSections = extractCVSections(optimizedText);
    
    // Convert extracted sections to the standard format
    extractedSections.forEach(section => {
      const title = section.title.replace(/[^A-Z]/g, '').toUpperCase();
      sections[title] = section.content;
    });
  }
  
  // Check if we have the main sections, if not, try to identify them from the text
  if (!sections['PROFILE'] && !sections['SUMMARY'] && !sections['ABOUT']) {
    // Look for a profile-like section at the beginning of the text
    const firstParagraph = optimizedText.split('\n\n')[0];
    if (firstParagraph && firstParagraph.length > 20 && !firstParagraph.includes('•')) {
      sections['PROFILE'] = firstParagraph;
    }
  }
  
  // Normalize section names
  if (sections['SUMMARY'] && !sections['PROFILE']) {
    sections['PROFILE'] = sections['SUMMARY'];
  }
  if (sections['ABOUT'] && !sections['PROFILE']) {
    sections['PROFILE'] = sections['ABOUT'];
  }
  
  // Parse profile
  const profile = sections['PROFILE'] || '';
  
  // Parse achievements
  let achievements: string[] = [];
  const achievementsText = sections['ACHIEVEMENTS'] || '';
  
  // Try different bullet point styles
  if (achievementsText.includes('•')) {
    achievements = achievementsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('•'))
      .map(line => line.substring(1).trim());
  } else if (achievementsText.includes('-')) {
    achievements = achievementsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  } else if (achievementsText.includes('*')) {
    achievements = achievementsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('*'))
      .map(line => line.substring(1).trim());
  } else {
    // If no bullet points, split by lines and filter out empty lines
    achievements = achievementsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  
  // Parse experience
  let experience: {
    company: string;
    position: string;
    duration: string;
    responsibilities: string[];
  }[] = [];
  
  const experienceText = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['EMPLOYMENT'] || '';
  
  // Try to parse experience in different formats
  if (experienceText) {
    // Split by double newlines to separate different experiences
    const experienceBlocks = experienceText.split(/\n\n+/).filter(Boolean);
    
    if (experienceBlocks.length > 0) {
      experience = experienceBlocks.map(block => {
        const lines = block.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          return {
            company: "Not specified",
            position: "Not specified",
            duration: "Not specified",
            responsibilities: ["No responsibilities specified."]
          };
        }
        
        // First line is usually company and position
        const headerLine = lines[0];
        
        // Try different formats for the header line
        let company = "Not specified";
        let position = "Not specified";
        let duration = "Not specified";
        
        // Format: "Company Name - Position (Duration)"
        const headerMatch1 = headerLine.match(/(.*?)\s*-\s*(.*?)\s*\((.*?)\)/);
        if (headerMatch1) {
          company = headerMatch1[1].trim();
          position = headerMatch1[2].trim();
          duration = headerMatch1[3].trim();
        } 
        // Format: "Position at Company Name (Duration)"
        else if (headerLine.includes(" at ") && headerLine.includes("(")) {
          const atMatch = headerLine.match(/(.*?)\s*at\s*(.*?)\s*\((.*?)\)/);
          if (atMatch) {
            position = atMatch[1].trim();
            company = atMatch[2].trim();
            duration = atMatch[3].trim();
          }
        }
        // Format: "Company Name | Position | Duration"
        else if (headerLine.includes("|")) {
          const parts = headerLine.split("|").map(part => part.trim());
          if (parts.length >= 3) {
            company = parts[0];
            position = parts[1];
            duration = parts[2];
          } else if (parts.length === 2) {
            company = parts[0];
            position = parts[1];
          }
        }
        // Format: "Company Name - Position"
        else if (headerLine.includes(" - ")) {
          const parts = headerLine.split(" - ").map(part => part.trim());
          if (parts.length >= 2) {
            company = parts[0];
            position = parts[1];
          }
        }
        // If no match, use the whole line as company
        else {
          company = headerLine;
        }
        
        // Parse responsibilities (bullet points)
        let responsibilities: string[] = [];
        
        // Try different bullet point styles
        const bulletLines = lines.slice(1).filter(line => line.trim());
        
        if (bulletLines.some(line => line.trim().startsWith('•'))) {
          responsibilities = bulletLines
            .filter(line => line.trim().startsWith('•'))
            .map(line => line.substring(1).trim());
        } else if (bulletLines.some(line => line.trim().startsWith('-'))) {
          responsibilities = bulletLines
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.substring(1).trim());
        } else if (bulletLines.some(line => line.trim().startsWith('*'))) {
          responsibilities = bulletLines
            .filter(line => line.trim().startsWith('*'))
            .map(line => line.substring(1).trim());
        } else {
          // If no bullet points, use all remaining lines
          responsibilities = bulletLines;
        }
        
        // Ensure we have at least one responsibility
        if (responsibilities.length === 0) {
          responsibilities = ["No responsibilities specified."];
        }
        
        return {
          company,
          position,
          duration,
          responsibilities
        };
      });
    }
  }
  
  // If no experience was parsed, add a placeholder
  if (experience.length === 0) {
    experience = [{
      company: "Not specified",
      position: "Not specified",
      duration: "Not specified",
      responsibilities: ["No responsibilities specified."]
    }];
  }
  
  // Parse skills
  let skills: string[] = [];
  const skillsText = sections['SKILLS'] || sections['COMPETENCIES'] || sections['TECHNICAL SKILLS'] || '';
  
  // Try different bullet point styles
  if (skillsText.includes('•')) {
    skills = skillsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('•'))
      .map(line => line.substring(1).trim());
  } else if (skillsText.includes('-')) {
    skills = skillsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  } else if (skillsText.includes('*')) {
    skills = skillsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('*'))
      .map(line => line.substring(1).trim());
  } else if (skillsText.includes(',')) {
    // Skills might be comma-separated
    skills = skillsText
      .split(',')
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);
  } else {
    // If no bullet points or commas, split by lines
    skills = skillsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  
  // Parse education
  let education: {
    degree: string;
    institution: string;
    year: string;
  }[] = [];
  
  const educationText = sections['EDUCATION'] || sections['ACADEMIC BACKGROUND'] || sections['QUALIFICATIONS'] || '';
  
  if (educationText) {
    // Split by double newlines to separate different education entries
    const educationBlocks = educationText.split(/\n\n+/).filter(Boolean);
    
    if (educationBlocks.length > 0) {
      education = educationBlocks.map(block => {
        const lines = block.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          return {
            degree: "Not specified",
            institution: "Not specified",
            year: "Not specified"
          };
        }
        
        // First line is usually degree or institution
        const firstLine = lines[0];
        
        // Try different formats
        let degree = "Not specified";
        let institution = "Not specified";
        let year = "Not specified";
        
        // Format: "Degree in Field, Institution, Year"
        const commaMatch = firstLine.match(/(.*?)\s*,\s*(.*?)(?:\s*,\s*(.*))?$/);
        if (commaMatch) {
          degree = commaMatch[1] || '';
          institution = commaMatch[2] || '';
          year = commaMatch[3] || '';
        }
        // Format: "Degree - Institution (Year)"
        else if (firstLine.includes(" - ") && firstLine.includes("(")) {
          const dashMatch = firstLine.match(/(.*?)\s*-\s*(.*?)\s*\((.*?)\)/);
          if (dashMatch) {
            degree = dashMatch[1].trim();
            institution = dashMatch[2].trim();
            year = dashMatch[3].trim();
          }
        }
        // Format: "Institution - Degree - Year"
        else if (firstLine.includes(" - ")) {
          const parts = firstLine.split(" - ").map(part => part.trim());
          if (parts.length >= 3) {
            institution = parts[0];
            degree = parts[1];
            year = parts[2];
          } else if (parts.length === 2) {
            institution = parts[0];
            degree = parts[1];
          }
        }
        // If no match, use the whole line as degree
        else {
          degree = firstLine;
          
          // Check if second line has institution
          if (lines.length > 1) {
            institution = lines[1];
          }
          
          // Check if third line has year
          if (lines.length > 2) {
            year = lines[2];
          }
        }
        
        return {
          degree,
          institution,
          year
        };
      });
    } else {
      // If no blocks, try to parse the whole text
      const lines = educationText.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        education = [{
          degree: lines[0],
          institution: lines.length > 1 ? lines[1] : "Not specified",
          year: lines.length > 2 ? lines[2] : "Not specified"
        }];
      }
    }
  }
  
  // If no education was parsed, add a placeholder
  if (education.length === 0) {
    education = [{
      degree: "Not specified",
      institution: "Not specified",
      year: "Not specified"
    }];
  }
  
  // Parse languages
  let languages: {
    language: string;
    proficiency: string;
  }[] = [];
  
  const languagesText = sections['LANGUAGES'] || sections['LANGUAGE PROFICIENCY'] || '';
  
  if (languagesText) {
    const languageLines = languagesText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    
    if (languageLines.length > 0) {
      languages = languageLines.map(line => {
        // Format: "Language: Proficiency"
        if (line.includes(':')) {
          const parts = line.split(':').map(part => part.trim());
          return {
            language: parts[0] || '',
            proficiency: parts[1] || ''
          };
        }
        // Format: "Language - Proficiency"
        else if (line.includes(' - ')) {
          const parts = line.split(' - ').map(part => part.trim());
          return {
            language: parts[0] || '',
            proficiency: parts[1] || ''
          };
        }
        // Format: "Language (Proficiency)"
        else if (line.includes('(') && line.includes(')')) {
          const match = line.match(/(.*?)\s*\((.*?)\)/);
          if (match) {
            return {
              language: match[1].trim(),
              proficiency: match[2].trim()
            };
          }
        }
        
        // Default: use the whole line as language
        return {
          language: line,
          proficiency: "Not specified"
        };
      });
    }
  }
  
  // If no languages were parsed, add a placeholder
  if (languages.length === 0) {
    languages = [{
      language: "Not specified",
      proficiency: "Not specified"
    }];
  }
  
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
  console.log(`Starting DOCX generation with content length: ${optimizedContent?.length || 0} characters`);
  
  if (!optimizedContent || optimizedContent.trim().length === 0) {
    console.error("Empty optimized content provided to DOCX generator");
    throw new Error("Cannot generate DOCX from empty content");
  }

  try {
    // Preprocess the optimized content to ensure it has proper section headings
    console.log("Preprocessing optimized content");
    let processedContent = optimizedContent;
    
    // Check if the content has section headings
    const hasMarkdownHeadings = /(?:^|\n)#\s+[A-Z\s]+/.test(processedContent);
    const hasUppercaseHeadings = /(?:^|\n)[A-Z][A-Z\s]+(?:\:|\n)/.test(processedContent);
    const hasTitleCaseHeadings = /(?:^|\n)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\:|\n)/.test(processedContent);
    
    console.log(`Content has markdown headings: ${hasMarkdownHeadings}`);
    console.log(`Content has uppercase headings: ${hasUppercaseHeadings}`);
    console.log(`Content has title case headings: ${hasTitleCaseHeadings}`);
    
    // If no headings are detected, try to add them based on common patterns
    if (!hasMarkdownHeadings && !hasUppercaseHeadings && !hasTitleCaseHeadings) {
      console.log("No section headings detected, attempting to add them");
      
      // Split content into paragraphs
      const paragraphs = processedContent.split(/\n\n+/);
      
      // Check if the first paragraph looks like a profile
      if (paragraphs.length > 0 && paragraphs[0].length > 20 && !paragraphs[0].includes('•') && !paragraphs[0].includes('-')) {
        processedContent = `# PROFILE\n\n${paragraphs[0]}\n\n` + processedContent.substring(paragraphs[0].length).trim();
      }
      
      // Look for bullet points that might be achievements
      const achievementsMatch = processedContent.match(/(?:^|\n)(?:•|-|\*)\s+.*?(?:\n(?:•|-|\*)\s+.*?)*(?=\n\n|$)/);
      if (achievementsMatch && achievementsMatch.index !== undefined) {
        const beforeMatch = processedContent.substring(0, achievementsMatch.index);
        const match = achievementsMatch[0];
        const afterMatch = processedContent.substring(achievementsMatch.index + match.length);
        
        // Check if this section is already labeled
        if (!beforeMatch.includes("ACHIEVEMENTS") && !beforeMatch.includes("EXPERIENCE") && !beforeMatch.includes("SKILLS")) {
          processedContent = beforeMatch + "\n\n# ACHIEVEMENTS\n\n" + match + afterMatch;
        }
      }
    }
    
    // Parse the optimized CV content
    console.log("Parsing optimized CV content into formatted structure");
    const formattedCV = parseOptimizedCVContent(processedContent);
    
    // Log the parsed sections
    console.log("Parsed sections:");
    console.log(`Profile: ${formattedCV.profile ? 'Present' : 'Missing'}`);
    console.log(`Achievements: ${formattedCV.achievements.length} items`);
    console.log(`Experience: ${formattedCV.experience.length} entries`);
    console.log(`Skills: ${formattedCV.skills.length} items`);
    console.log(`Education: ${formattedCV.education.length} entries`);
    console.log(`Languages: ${formattedCV.languages.length} entries`);
    
    // Validate the parsed content to ensure we have required sections
    if (!formattedCV.profile || formattedCV.profile.trim().length === 0) {
      console.warn("Profile section is empty in the optimized content");
      // Try to extract a profile from the beginning of the text
      const firstParagraph = processedContent.split('\n\n')[0];
      if (firstParagraph && firstParagraph.length > 20 && !firstParagraph.includes('•') && !firstParagraph.includes('-')) {
        formattedCV.profile = firstParagraph;
      } else {
        formattedCV.profile = "Professional with experience in the field.";
      }
    }
    
    if (!formattedCV.achievements || formattedCV.achievements.length === 0) {
      console.warn("No achievements found in the optimized content");
      // Try to extract achievements from bullet points
      const bulletPoints = processedContent.match(/(?:^|\n)(?:•|-|\*)\s+(.*?)(?=\n|$)/g);
      if (bulletPoints && bulletPoints.length > 0) {
        formattedCV.achievements = bulletPoints.map(bp => 
          bp.replace(/^[\n\s]*(?:•|-|\*)\s+/, '').trim()
        ).filter(bp => bp.length > 0);
      }
      
      // If still no achievements, add placeholders
      if (formattedCV.achievements.length === 0) {
        formattedCV.achievements = [
          "Successfully implemented projects resulting in improved efficiency.",
          "Achieved significant results through strategic planning and execution.",
          "Recognized for outstanding performance and contributions to team success."
        ];
      }
    }
    
    if (!formattedCV.experience || formattedCV.experience.length === 0) {
      console.warn("No experience entries found in the optimized content");
      // Add a placeholder experience to prevent array length issues
      formattedCV.experience = [{
        company: "Not specified",
        position: "Not specified",
        duration: "Not specified",
        responsibilities: ["No responsibilities specified."]
      }];
    } else {
      // Ensure each experience entry has responsibilities
      formattedCV.experience = formattedCV.experience.map(exp => {
        if (!exp.responsibilities || exp.responsibilities.length === 0) {
          console.warn(`Experience entry for ${exp.company} has no responsibilities`);
          return {
            ...exp,
            responsibilities: ["No responsibilities specified."]
          };
        }
        return exp;
      });
    }
    
    if (!formattedCV.skills || formattedCV.skills.length === 0) {
      console.warn("No skills found in the optimized content");
      // Add a placeholder skill
      formattedCV.skills = ["No skills specified."];
    }
    
    if (!formattedCV.education || formattedCV.education.length === 0) {
      console.warn("No education entries found in the optimized content");
      // Add a placeholder education entry
      formattedCV.education = [{
        degree: "Not specified",
        institution: "Not specified", 
        year: "Not specified"
      }];
    }
    
    if (!formattedCV.languages || formattedCV.languages.length === 0) {
      console.warn("No languages found in the optimized content");
      // Add a placeholder language
      formattedCV.languages = [{ 
        language: "Not specified", 
        proficiency: "Not specified" 
      }];
    }
    
    console.log("Creating DOCX document with the formatted CV data");
    
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
              text: formattedCV.profile || "No profile information available.",
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
            ...(formattedCV.achievements.length > 0 
              ? formattedCV.achievements.map(
                achievement => new Paragraph({
                  text: achievement,
                  bullet: {
                    level: 0,
                  },
                  spacing: {
                    after: 120,
                  },
                })
              )
              : [new Paragraph({
                text: "No notable achievements specified.",
                spacing: {
                  after: 120,
                },
              })]
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
                text: edu.degree || '',
                heading: HeadingLevel.HEADING_2,
                spacing: {
                  after: 80,
                },
              }),
              new Paragraph({
                text: [edu.institution, edu.year].filter(Boolean).join(', '),
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
    console.log(`Creating output directory: ${outputDir}`);
    try {
      await fsPromises.mkdir(outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
    
    // Generate file path
    const filePath = path.join(outputDir, fileName);
    console.log(`Output file path: ${filePath}`);
    
    // Create a buffer with the docx
    console.log("Generating DOCX buffer");
    const buffer = await Packer.toBuffer(doc);
    console.log(`Generated DOCX buffer with size: ${buffer.length} bytes`);
    
    // Write the file to disk
    console.log(`Writing DOCX file to disk: ${filePath}`);
    await fsPromises.writeFile(filePath, buffer);
    
    // Convert to base64 for preview
    console.log("Converting DOCX buffer to base64");
    const base64 = buffer.toString('base64');
    console.log(`Generated base64 data with length: ${base64.length} characters`);
    
    console.log("DOCX generation completed successfully");
    return {
      filePath,
      base64,
    };
  } catch (error) {
    console.error('Error in DOCX generation:', error);
    throw new Error(`DOCX generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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