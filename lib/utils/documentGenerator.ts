import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, convertInchesToTwip, PageOrientation, PageNumber, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, UnderlineType, ShadingType, TableLayoutType } from "docx";
import { logger } from "@/lib/logger";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Professional Document Generator
 * A utility for generating DOCX files from CV text with premium styling
 * that matches world-class CV templates
 */
export class DocumentGenerator {
  // Define professional color scheme
  private static readonly colors = {
    primary: "2D5597", // Professional blue
    accent: "2D5597",  // Professional blue
    dark: "333333",    // Dark text
    medium: "666666",  // Medium gray
    light: "AAAAAA",   // Light gray
    ultraLight: "F5F5F5", // Ultra light gray
    white: "FFFFFF",   // White
  };
  
  /**
   * Generate a DOCX file from CV text with professional formatting
   * @param cvText The optimized CV text
   * @param metadata Optional metadata for enhanced formatting
   * @param photoPath Optional path to profile photo
   */
  static async generateDocx(cvText: string, metadata?: any, photoPath?: string): Promise<Buffer> {
    try {
      logger.info("Starting professional document generation");
      const startTime = Date.now();
      
      // Clean up text for better parsing
      let filteredText = cvText
        .replace(/\bDeveloped\b/g, '')
        .replace(/\bDelivered\b/g, '')
        .replace(/\bImplemented\b/g, '');
      
      // Clean up any double spaces that might have been created
      filteredText = filteredText.replace(/\s{2,}/g, ' ');
      
      // Split the CV text into sections based on common headers
      const sections = this.splitIntoSections(filteredText);
      
      // Create document with optimal margins and modern formatting
      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "SectionHeading",
              name: "Section Heading",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: "Calibri",
                size: 28,
                bold: true,
                color: this.colors.primary,
              },
              paragraph: {
                spacing: {
                  after: 120,
                  before: 240,
                },
              },
            },
            {
              id: "BodyText",
              name: "Body Text",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: "Calibri",
                size: 22,
                color: this.colors.dark,
              },
              paragraph: {
                spacing: {
                  after: 80,
                  line: 360, // 1.5 line spacing
                },
              },
            },
          ],
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: convertInchesToTwip(0.5),
                  right: convertInchesToTwip(0.5),
                  bottom: convertInchesToTwip(0.5),
                  left: convertInchesToTwip(0.5),
                },
                size: {
                  orientation: PageOrientation.PORTRAIT,
                },
              },
            },
            children: this.createDocumentContent(sections, metadata, photoPath)
          }
        ]
      });
      
      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      
      logger.info(`Document generation completed in ${Date.now() - startTime}ms`);
      return buffer;
    } catch (error) {
      logger.error(`Error generating document: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Document generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Split CV text into logical sections
   */
  private static splitIntoSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {
      header: "",
      content: ""
    };
    
    // Try to find common section headers
    const headerMatch = text.match(/^(.*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|SKILLS|PROFILE|SUMMARY))/is);
    if (headerMatch && headerMatch[0]) {
      sections.header = headerMatch[0].trim();
      sections.content = text.substring(headerMatch[0].length).trim();
    } else {
      // If no clear header found, use first few lines as header
      const lines = text.split('\n');
      
      // Look for a natural break in the text (empty line) within the first 10 lines
      let headerEndIndex = -1;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].trim() === '' && i > 0) {
          headerEndIndex = i;
          break;
        }
      }
      
      // If no natural break found, use first 3 lines or 10% of the document
      if (headerEndIndex === -1) {
        headerEndIndex = Math.min(3, Math.ceil(lines.length * 0.1));
      }
      
      sections.header = lines.slice(0, headerEndIndex).join('\n').trim();
      sections.content = lines.slice(headerEndIndex).join('\n').trim();
    }
    
    return sections;
  }
  
  /**
   * Create document content with professional formatting
   */
  private static createDocumentContent(sections: Record<string, string>, metadata?: any, photoPath?: string): any[] {
    const children: any[] = [];
    
    // Add header with name and contact info in a modern table layout
    if (sections.header) {
      const headerLines = sections.header.split('\n');
      
      // Create a table for the header section with two columns
      // Left column: Name and job title
      // Right column: Contact info
      const headerTable = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              // Left column for name and job title
              new TableCell({
                width: {
                  size: 70,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  // Name in bold, large font with accent color
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: headerLines[0].trim().toUpperCase(),
                        bold: true,
                        size: 36, // ~18pt font
                        color: this.colors.primary,
                        font: "Calibri",
                      }),
                    ],
                    spacing: {
                      after: 120
                    }
                  }),
                  // Job title if available
                  ...(headerLines.length > 1 ? [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      children: [
                        new TextRun({
                          text: headerLines[1].trim(),
                          size: 28, // ~14pt font
                          color: this.colors.medium,
                          font: "Calibri",
                          bold: true,
                        }),
                      ],
                      spacing: {
                        after: 120
                      }
                    })
                  ] : []),
                ],
              }),
              
              // Right column for contact info
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  // Contact info with icons for modern look
                  ...(headerLines.length > 2 ? headerLines.slice(2).map(line => 
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [
                        new TextRun({
                          text: line.trim(),
                          size: 22, // ~11pt font
                          font: "Calibri",
                          color: this.colors.dark,
                        }),
                      ],
                      spacing: {
                        after: 80
                      }
                    })
                  ) : [])
                ],
              }),
            ],
          }),
        ],
      });
      
      children.push(headerTable);
      
      // Add a professional separator line after the header
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: this.colors.primary,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 3,
            },
          },
          spacing: {
            before: 120,
            after: 240
          }
        })
      );
    }
    
    // Process main content
    if (sections.content) {
      // Identify sections in the content
      const contentSections = this.identifySections(sections.content);
      
      // Extract education section to move it to the end
      let educationSection = null;
      if (contentSections['EDUCATION']) {
        educationSection = { name: 'EDUCATION', content: contentSections['EDUCATION'] };
      }
      
      // Add About Me / Profile section if it exists
      if (contentSections['PROFILE'] || contentSections['SUMMARY'] || contentSections['ABOUT ME']) {
        const profileContent = contentSections['PROFILE'] || contentSections['SUMMARY'] || contentSections['ABOUT ME'];
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'PROFILE',
                bold: true,
                size: 28, // ~14pt font
                color: this.colors.primary,
                font: "Calibri",
              }),
            ],
            spacing: {
              after: 120
            },
            border: {
              bottom: {
                color: this.colors.light,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 1,
              },
            },
          })
        );
        
        // Add profile content with enhanced formatting
        const profileLines = profileContent.split('\n');
        profileLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  size: 22, // ~11pt font
                  font: "Calibri",
                  color: this.colors.dark,
                }),
              ],
              spacing: {
                before: 80,
                after: 80
              }
            })
          );
        });
      }
      
      // Add Skills/Competences section with modern styling
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'SKILLS',
              bold: true,
              size: 28, // ~14pt font
              color: this.colors.primary,
              font: "Calibri",
            }),
          ],
          spacing: { before: 240, after: 120 },
          border: {
            bottom: {
              color: this.colors.light,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 1,
            },
          },
        })
      );
      
      // Prioritize skills from content or metadata
      let skillsList: string[] = [];
      
      if (contentSections['SKILLS']) {
        // Extract skills from content
        const skillsLines = contentSections['SKILLS'].split('\n');
        skillsList = skillsLines
          .map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0) return null;
            
            // Remove bullet points if present
            if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
              return trimmedLine.substring(1).trim();
            }
            return trimmedLine;
          })
          .filter(Boolean) as string[];
      } else if (metadata && metadata.skills && Array.isArray(metadata.skills) && metadata.skills.length > 0) {
        skillsList = metadata.skills;
      } else if (metadata && metadata.industry) {
        skillsList = this.getIndustrySkills(metadata.industry);
      }
      
      // Create a table for skills with 3 columns - enhanced with modern styling
      const SKILLS_PER_ROW = 3;
      const tableRows: TableRow[] = [];
      
      for (let i = 0; i < skillsList.length; i += SKILLS_PER_ROW) {
        const rowSkills = skillsList.slice(i, i + SKILLS_PER_ROW);
        
        // Create cells for this row with enhanced styling
        const cells = rowSkills.map(skill => 
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "• ",
                    size: 22,
                    bold: true,
                    color: this.colors.primary,
                    font: "Calibri",
                  }),
                  new TextRun({
                    text: skill,
                    size: 22,
                    color: this.colors.dark,
                    font: "Calibri",
                  }),
                ],
                spacing: { before: 60, after: 60 }
              })
            ],
          })
        );
        
        // If we don't have enough skills to fill the row, add empty cells
        while (cells.length < SKILLS_PER_ROW) {
          cells.push(
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [new Paragraph({})],
            })
          );
        }
        
        // Add the row to the table
        tableRows.push(new TableRow({ children: cells }));
      }
      
      // Create the skills table with the rows
      const skillsTableWithRows = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: tableRows,
      });
      
      // Add the skills table to the document
      children.push(skillsTableWithRows);
      
      // Check for languages section and add it before work experience if available
      const languagesSection = contentSections['LANGUAGES'] || contentSections['LANGUAGE SKILLS'];
      if (languagesSection) {
        // Add Languages header
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'LANGUAGES',
                bold: true,
                size: 28,
                color: this.colors.primary,
                font: "Calibri",
              }),
            ],
            spacing: {
              before: 240,
              after: 120
            },
            border: {
              bottom: {
                color: this.colors.light,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 1,
              },
            },
          })
        );
        
        // Process languages
        const languageLines = languagesSection.split('\n');
        const languagesList: {language: string, level: string}[] = [];
        
        languageLines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          // Try to extract language and level
          const parts = trimmed.split(':').map(p => p.trim());
          if (parts.length >= 2) {
            languagesList.push({
              language: parts[0],
              level: parts[1]
            });
          } else if (trimmed.includes('-')) {
            const dashParts = trimmed.split('-').map(p => p.trim());
            if (dashParts.length >= 2) {
              languagesList.push({
                language: dashParts[0],
                level: dashParts[1]
              });
            } else {
              languagesList.push({
                language: trimmed,
                level: 'Proficient'
              });
            }
          } else {
            languagesList.push({
              language: trimmed,
              level: 'Proficient'
            });
          }
        });
        
        // Create a table for languages with modern visualization
        const LANGUAGES_PER_ROW = 3;
        const languageRows: TableRow[] = [];
        
        for (let i = 0; i < languagesList.length; i += LANGUAGES_PER_ROW) {
          const rowLanguages = languagesList.slice(i, i + LANGUAGES_PER_ROW);
          
          // Create cells for this row
          const cells = rowLanguages.map(lang => 
            new TableCell({
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: lang.language,
                      size: 22,
                      bold: true,
                      color: this.colors.dark,
                      font: "Calibri",
                    }),
                  ],
                  spacing: { after: 40 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: this.getLanguageLevelBar(lang.level),
                      size: 20,
                      color: this.colors.primary,
                      font: "Calibri",
                    }),
                  ],
                  spacing: { before: 0, after: 80 }
                })
              ],
            })
          );
          
          // If we don't have enough languages to fill the row, add empty cells
          while (cells.length < LANGUAGES_PER_ROW) {
            cells.push(
              new TableCell({
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [new Paragraph({})],
              })
            );
          }
          
          // Add the row to the table
          languageRows.push(new TableRow({ children: cells }));
        }
        
        // Create the languages table
        const languagesTable = new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          layout: TableLayoutType.FIXED,
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: languageRows,
        });
        
        // Add the languages table
        children.push(languagesTable);
      }
      
      // Add Experience section with enhanced formatting
      const experienceSection = contentSections['EXPERIENCE'] || 
                               contentSections['WORK EXPERIENCE'] || 
                               contentSections['PROFESSIONAL EXPERIENCE'] ||
                               contentSections['EMPLOYMENT HISTORY'];
      
      if (experienceSection) {
        // Add Experience header with modern styling
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'EXPERIENCE',
                bold: true,
                size: 28,
                color: this.colors.primary,
                font: "Calibri",
              }),
            ],
            spacing: {
              before: 240,
              after: 120
            },
            border: {
              bottom: {
                color: this.colors.light,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 1,
              },
            },
          })
        );
        
        // Process experience content
        const experienceLines = experienceSection.split('\n');
        let currentJobTitle = '';
        let currentCompany = '';
        let currentDateRange = '';
        let currentBullets: string[] = [];
        let isProcessingJob = false;
        
        for (let i = 0; i < experienceLines.length; i++) {
          const line = experienceLines[i].trim();
          if (line.length === 0) {
            // Empty line - if we were processing a job, add it to the document
            if (isProcessingJob && (currentJobTitle || currentCompany)) {
              this.addJobToDocument(children, currentJobTitle, currentCompany, currentDateRange, currentBullets);
              
              // Reset for next job
              currentJobTitle = '';
              currentCompany = '';
              currentDateRange = '';
              currentBullets = [];
              isProcessingJob = false;
              
              // Add a subtle separator between jobs
              children.push(
                new Paragraph({
                  border: {
                    bottom: {
                      color: this.colors.ultraLight,
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 1,
                    },
                  },
                  spacing: {
                    after: 120
                  }
                })
              );
            }
            continue;
          }
          
          // Check if this is a bullet point
          const isBullet = line.startsWith('-') || line.startsWith('•') || line.startsWith('*');
          
          if (isBullet) {
            // Add to current bullets
            currentBullets.push(line.substring(1).trim());
            isProcessingJob = true;
          } else {
            // Check if this might be a job title, company, or date
            const containsYear = /\b(19|20)\d{2}\b/.test(line);
            const isShortLine = line.length < 60;
            
            if (containsYear && isShortLine) {
              // This is likely a date range
              currentDateRange = line;
              isProcessingJob = true;
            } else if (isShortLine) {
              // This is likely a job title or company
              if (!currentJobTitle) {
                currentJobTitle = line;
              } else if (!currentCompany) {
                currentCompany = line;
              }
              isProcessingJob = true;
            } else {
              // This is likely a description - add it as a bullet
              currentBullets.push(line);
              isProcessingJob = true;
            }
          }
        }
        
        // Add the last job if there is one
        if (isProcessingJob && (currentJobTitle || currentCompany)) {
          this.addJobToDocument(children, currentJobTitle, currentCompany, currentDateRange, currentBullets);
        }
      }
      
      // Add Education section with enhanced styling
      if (educationSection) {
        // Add Education header
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'EDUCATION',
                bold: true,
                size: 28,
                color: this.colors.primary,
                font: "Calibri",
              }),
            ],
            spacing: {
              before: 240,
              after: 120
            },
            border: {
              bottom: {
                color: this.colors.light,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 1,
              },
            },
          })
        );
        
        // Process education content
        const educationLines = educationSection.content.split('\n');
        let currentDegree = '';
        let currentInstitution = '';
        let currentYear = '';
        let currentDetails: string[] = [];
        let isProcessingEducation = false;
        
        for (let i = 0; i < educationLines.length; i++) {
          const line = educationLines[i].trim();
          if (line.length === 0) {
            // Empty line - if we were processing an education entry, add it to the document
            if (isProcessingEducation && (currentDegree || currentInstitution)) {
              this.addEducationToDocument(children, currentDegree, currentInstitution, currentYear, currentDetails);
              
              // Reset for next education entry
              currentDegree = '';
              currentInstitution = '';
              currentYear = '';
              currentDetails = [];
              isProcessingEducation = false;
              
              // Add a separator between education entries
              children.push(
                new Paragraph({
                  border: {
                    bottom: {
                      color: "#EEEEEE",
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 1,
                    },
                  },
                  spacing: {
                    after: 120
                  }
                })
              );
            }
            continue;
          }
          
          // Check if this is a bullet point
          const isBullet = line.startsWith('-') || line.startsWith('•') || line.startsWith('*');
          
          if (isBullet) {
            // Add to current details
            currentDetails.push(line.substring(1).trim());
            isProcessingEducation = true;
          } else {
            // Check if this might be a degree, institution, or year
            const containsYear = /\b(19|20)\d{2}\b/.test(line);
            const isShortLine = line.length < 60;
            const isDegreeKeyword = /\b(degree|diploma|bachelor|master|phd|certificate)\b/i.test(line);
            
            if (containsYear && isShortLine) {
              // This is likely a year
              currentYear = line;
              isProcessingEducation = true;
            } else if (isDegreeKeyword || (isShortLine && !currentDegree)) {
              // This is likely a degree
              currentDegree = line;
              isProcessingEducation = true;
            } else if (isShortLine) {
              // This is likely an institution
              currentInstitution = line;
              isProcessingEducation = true;
            } else {
              // This is likely a description - add it as a detail
              currentDetails.push(line);
              isProcessingEducation = true;
            }
          }
        }
        
        // Add the last education entry if there is one
        if (isProcessingEducation && (currentDegree || currentInstitution)) {
          this.addEducationToDocument(children, currentDegree, currentInstitution, currentYear, currentDetails);
        }
      }
    }
    
    return children;
  }
  
  /**
   * Identify sections in the CV content
   */
  private static identifySections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
    // Define section headers regex patterns for improved detection
    const sectionPatterns = [
      { name: 'PROFILE', pattern: /(?:^|\n)(?:profile|summary|about me|objective)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'EXPERIENCE', pattern: /(?:^|\n)(?:experience|work history|employment|professional background|career|work)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'EDUCATION', pattern: /(?:^|\n)(?:education|academic|qualifications|degrees|university|college)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:experience|work|employment|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'SKILLS', pattern: /(?:^|\n)(?:skills|proficiencies|competencies|expertise|technical skills|core competencies)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'LANGUAGES', pattern: /(?:^|\n)(?:languages|linguistic skills|language proficiency)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'INTERESTS', pattern: /(?:^|\n)(?:interests|hobbies|activities|extracurricular)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|references|profile|summary|\Z)|\Z)/is },
      { name: 'REFERENCES', pattern: /(?:^|\n)(?:references|referees)(?:\s*:|\s*\n|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|interests|profile|summary|\Z)|\Z)/is }
    ];
    
    // Additional keywords for better education section identification
    const educationKeywords = [
      'university', 'college', 'school', 'degree', 'bachelor', 'master', 'phd', 'doctorate', 
      'diploma', 'certificate', 'thesis', 'gpa', 'grade', 'graduated', 'graduation', 
      'major', 'minor', 'academic', 'study', 'studies', 'mba', 'bsc', 'ba', 'bs', 'ma', 'ms', 'msc'
    ];
    
    // Additional keywords for better work experience section identification
    const experienceKeywords = [
      'managed', 'led', 'created', 'implemented', 'responsible', 'achievements',
      'improved', 'increased', 'reduced', 'supervised', 'team', 'project',
      'client', 'customer', 'report', 'business', 'strategy', 'market', 'sales', 'revenue',
      'manager', 'director', 'supervisor', 'position', 'role', 'company', 'organization', 'firm'
    ];
    
    // Try to find sections based on patterns
    sectionPatterns.forEach(({ name, pattern }) => {
      const match = content.match(pattern);
      if (match && match[1]) {
        sections[name] = match[1].trim();
      }
    });
    
    // If no sections were found using regex, try a simpler approach
    if (Object.keys(sections).length === 0) {
      // Split by lines and look for section headers
      const lines = content.split('\n');
      let currentSection = '';
      let currentContent = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (line === '') continue;
        
        // Check if this line looks like a section header
        const isHeader = line.toUpperCase() === line && line.length < 30;
        
        if (isHeader) {
          // Save previous section if it exists
          if (currentSection && currentContent) {
            sections[currentSection] = currentContent.trim();
          }
          
          // Start new section
          currentSection = line;
          currentContent = '';
        } else {
          // Add to current section content
          currentContent += line + '\n';
        }
      }
      
      // Save the last section
      if (currentSection && currentContent) {
        sections[currentSection] = currentContent.trim();
      }
    }
    
    // Post-processing validation for education vs experience to reduce confusion
    if (sections['EDUCATION'] && sections['EXPERIENCE']) {
      // Check if education section contains more experience keywords than education keywords
      const educationText = sections['EDUCATION'].toLowerCase();
      const experienceText = sections['EXPERIENCE'].toLowerCase();
      
      let educationKeywordCount = 0;
      let experienceKeywordCount = 0;
      
      educationKeywords.forEach(keyword => {
        if (educationText.includes(keyword.toLowerCase())) {
          educationKeywordCount++;
        }
      });
      
      experienceKeywords.forEach(keyword => {
        if (educationText.includes(keyword.toLowerCase())) {
          experienceKeywordCount++;
        }
      });
      
      // If the education section has more experience keywords than education keywords,
      // it's likely mislabeled. Either merge with experience or keep separate depending on the difference.
      if (experienceKeywordCount > educationKeywordCount * 2) {
        // Very clear mismatch - merge with experience
        sections['EXPERIENCE'] += '\n' + sections['EDUCATION'];
        delete sections['EDUCATION'];
      }
    }
    
    return sections;
  }
  
  /**
   * Extract achievements from work experience content
   * Looks for sentences that appear to be achievements based on certain patterns
   */
  private static extractAchievements(experienceContent: string): string[] {
    const lines = experienceContent.split('\n');
    const achievements: string[] = [];
    
    // Action verbs that often indicate achievements
    const achievementVerbs = [
      "increased", "decreased", "improved", "reduced", "saved", "grew", 
      "created", "established", "implemented", "launched", 
      "generated", "achieved", "won", "awarded", "recognized"
    ];
    
    // Patterns that might indicate metrics or quantifiable results
    const metricPatterns = [
      /\d+\s*%/, // Percentage (e.g., 25%)
      /\$\s*\d+/, // Dollar amount (e.g., $500K)
      /\d+\s*k/i, // Thousands (e.g., 500K)
      /\d+\s*m/i, // Millions (e.g., 2M)
      /\d+\s*million/i, // Written millions (e.g., 2 million)
      /\d+\s*billion/i, // Written billions (e.g., 1 billion)
    ];
    
    // Search through each line for achievement-like content
    lines.forEach((line) => {
      // Skip empty lines
      if (line.trim().length === 0) return;
      
      // Clean the line (remove bullet points)
      let cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('•') || cleanLine.startsWith('*')) {
        cleanLine = cleanLine.substring(1).trim();
      }
      
      // Skip if line is too short
      if (cleanLine.length < 20) return;
      
      // Check if line contains achievement verbs
      const containsAchievementVerb = achievementVerbs.some(verb => 
        cleanLine.toLowerCase().includes(verb)
      );
      
      // Check if line contains metrics
      const containsMetrics = metricPatterns.some(pattern => 
        pattern.test(cleanLine)
      );
      
      // If line has either achievement verbs or metrics, consider it an achievement
      if (containsAchievementVerb || containsMetrics) {
        // Ensure first letter is capitalized
        const firstChar = cleanLine.charAt(0).toUpperCase();
        const restOfLine = cleanLine.slice(1);
        
        // Add to achievements
        achievements.push(firstChar + restOfLine);
      }
    });
    
    // If no achievements found using patterns, look for longest bullet points
    if (achievements.length === 0) {
      const bulletPoints = lines
        .filter(line => {
          const trimmed = line.trim();
          return (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) && 
                 trimmed.length > 30; // Only consider substantial bullet points
        })
        .map(line => {
          let cleaned = line.trim();
          if (cleaned.startsWith('-') || cleaned.startsWith('•') || cleaned.startsWith('*')) {
            cleaned = cleaned.substring(1).trim();
          }
          // Ensure first letter is capitalized
          const firstChar = cleaned.charAt(0).toUpperCase();
          const restOfLine = cleaned.slice(1);
          return firstChar + restOfLine;
        })
        .sort((a, b) => b.length - a.length); // Sort by length (longest first)
      
      // Take up to 3 longest bullet points
      achievements.push(...bulletPoints.slice(0, 3));
    }
    
    // If still no achievements, create generic achievements based on job titles
    if (achievements.length === 0) {
      // Try to extract job titles
      const jobTitlePattern = /(?:^|\n)([A-Z][A-Za-z\s]+(?:Manager|Director|Engineer|Developer|Specialist|Analyst|Consultant|Designer|Coordinator|Assistant|Representative|Officer|Lead|Head|Chief))/g;
      const jobTitleMatches = [...experienceContent.matchAll(jobTitlePattern)];
      
      if (jobTitleMatches.length > 0) {
        // Use job titles to create achievements
        jobTitleMatches.slice(0, 2).forEach(match => {
          const jobTitle = match[1].trim();
          achievements.push(`Successfully performed key responsibilities as ${jobTitle}, exceeding expectations`);
          achievements.push(`Demonstrated excellence in problem-solving and teamwork as ${jobTitle}`);
        });
      } else {
        // Fallback to generic achievements
        achievements.push(
          "Successfully implemented process improvements resulting in increased efficiency",
          "Collaborated effectively with cross-functional teams to achieve organizational goals",
          "Recognized for exceptional performance and contribution to team success"
        );
      }
    }
    
    return achievements;
  }
  
  /**
   * Get a list of relevant skills for a specific industry
   * Used when no explicit skills are provided in the CV
   * @param industry The industry name
   * @returns Array of relevant skills for the industry
   */
  private static getIndustrySkills(industry: string): string[] {
    const normalizedIndustry = industry.toLowerCase().trim();
    
    const industrySkills: Record<string, string[]> = {
      'technology': [
        'Programming & Software Development',
        'Cloud Architecture (AWS/Azure/GCP)',
        'DevOps & CI/CD Pipelines',
        'Artificial Intelligence & Machine Learning',
        'Database Management & SQL',
        'API Design & Integration',
        'Agile/Scrum Methodologies',
        'Systems Architecture',
        'Cybersecurity & Identity Management',
        'Microservices & Containerization'
      ],
      'finance': [
        'Financial Analysis & Reporting',
        'Risk Management & Compliance',
        'Investment Portfolio Management',
        'Financial Modeling & Forecasting',
        'Banking Regulations & Policies',
        'Corporate Finance',
        'Capital Markets & Securities',
        'Financial Control Systems',
        'Mergers & Acquisitions',
        'Tax Planning & Strategy'
      ],
      'healthcare': [
        'Electronic Health Records (EHR) Systems',
        'Healthcare Compliance (HIPAA/GDPR)',
        'Clinical Workflow Optimization',
        'Medical Coding & Billing',
        'Healthcare Analytics',
        'Patient Care Management',
        'Healthcare Information Technology',
        'Medical Research & Clinical Trials',
        'Telehealth & Remote Care Solutions',
        'Healthcare Policy & Regulation'
      ],
      'marketing': [
        'Digital Marketing Strategy',
        'Content Creation & Marketing',
        'Search Engine Optimization (SEO)',
        'Social Media Management',
        'Marketing Analytics & Reporting',
        'Brand Development & Management',
        'Customer Journey Mapping',
        'Marketing Automation',
        'Market Research & Competitive Analysis',
        'Email Marketing Campaigns'
      ],
      'retail': [
        'Merchandising & Product Management',
        'E-commerce Platform Management',
        'Supply Chain Optimization',
        'Retail Analytics & KPIs',
        'Customer Experience Design',
        'Inventory Management Systems',
        'Point of Sale (POS) Systems',
        'Omnichannel Retail Strategy',
        'Visual Merchandising',
        'Customer Relationship Management'
      ],
      'legal': [
        'Contract Drafting & Negotiation',
        'Legal Research & Analysis',
        'Regulatory Compliance',
        'Intellectual Property Management',
        'Corporate Governance',
        'Litigation Management',
        'Legal Risk Assessment',
        'Data Privacy Law',
        'Employment Law',
        'Mergers & Acquisitions'
      ],
      'human resources': [
        'Talent Acquisition & Retention',
        'Performance Management Systems',
        'Compensation & Benefits Planning',
        'Employee Relations & Engagement',
        'HR Analytics & Reporting',
        'Training & Development Programs',
        'HRIS & Workforce Management Systems',
        'Organizational Development',
        'Labor Relations & Compliance',
        'Succession Planning'
      ],
      'education': [
        'Curriculum Development & Assessment',
        'Educational Technology Integration',
        'Instructional Design',
        'Learning Management Systems',
        'Student Engagement Strategies',
        'Educational Research & Analysis',
        'Classroom Management',
        'Special Education Programs',
        'Educational Leadership',
        'Student Assessment & Evaluation'
      ],
      'manufacturing': [
        'Production Planning & Scheduling',
        'Quality Control Systems',
        'Lean Manufacturing Principles',
        'Supply Chain Management',
        'Manufacturing Execution Systems',
        'Industrial Automation',
        'Process Improvement & Six Sigma',
        'Inventory Management',
        'Equipment Maintenance & Reliability',
        'Health & Safety Compliance'
      ],
      'construction': [
        'Project Planning & Management',
        'Building Information Modeling (BIM)',
        'Construction Safety Protocols',
        'Cost Estimation & Budgeting',
        'Contract Administration',
        'Building Codes & Regulatory Compliance',
        'Construction Documentation',
        'Quality Assurance & Control',
        'Sustainable Building Practices',
        'Construction Technology Applications'
      ]
    };
    
    // Find the matching industry or use default skills
    for (const [key, skills] of Object.entries(industrySkills)) {
      if (normalizedIndustry.includes(key)) {
        return skills;
      }
    }
    
    // Default skills if no industry match found
    return [
      'Project Management',
      'Communication & Presentation',
      'Problem Solving & Analysis',
      'Team Leadership & Collaboration',
      'Strategic Planning',
      'Data Analysis & Reporting',
      'Research & Documentation',
      'Client Relationship Management',
      'Time Management & Organization',
      'Critical Thinking & Innovation'
    ];
  }

  /**
   * Add a job entry to the document with premium styling
   */
  private static addJobToDocument(children: any[], jobTitle: string, company: string, dateRange: string, bullets: string[]): void {
    // Create a table for job title and date - modern side-by-side layout
    const jobHeaderTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            // Left column for job title and company
            new TableCell({
              width: {
                size: 70,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Job title
                new Paragraph({
                  children: [
                    new TextRun({
                      text: jobTitle,
                      size: 24, // ~12pt font
                      bold: true,
                      color: this.colors.dark,
                      font: "Calibri",
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
                // Company
                new Paragraph({
                  children: [
                    new TextRun({
                      text: company,
                      size: 22, // ~11pt font
                      italics: true,
                      color: this.colors.medium,
                      font: "Calibri",
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                })
              ],
            }),
            
            // Right column for date range
            new TableCell({
              width: {
                size: 30,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: dateRange,
                      size: 22, // ~11pt font
                      color: this.colors.medium,
                      font: "Calibri",
                    }),
                  ],
                })
              ],
            }),
          ],
        }),
      ],
    });
    
    children.push(jobHeaderTable);

    // Add bullets with enhanced formatting and proper bullet points
    bullets.forEach(bullet => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• ",
              size: 22, // ~11pt font
              color: this.colors.primary,
              bold: true,
              font: "Calibri",
            }),
            new TextRun({
              text: bullet,
              size: 22, // ~11pt font
              color: this.colors.dark,
              font: "Calibri",
            }),
          ],
          indent: {
            left: convertInchesToTwip(0.25)
          },
          spacing: {
            before: 40,
            after: 40
          }
        })
      );
    });
  }
  
  /**
   * Add an education entry to the document with premium styling
   */
  private static addEducationToDocument(children: any[], degree: string, institution: string, year: string, details: string[]): void {
    // Create a table for education - modern side-by-side layout
    const educationHeaderTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            // Left column for institution and degree
            new TableCell({
              width: {
                size: 70,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Institution
                new Paragraph({
                  children: [
                    new TextRun({
                      text: institution,
                      size: 24, // ~12pt font
                      bold: true,
                      color: this.colors.dark,
                      font: "Calibri",
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
                // Degree
                new Paragraph({
                  children: [
                    new TextRun({
                      text: degree,
                      size: 22, // ~11pt font
                      italics: true,
                      color: this.colors.medium,
                      font: "Calibri",
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                })
              ],
            }),
            
            // Right column for year
            new TableCell({
              width: {
                size: 30,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: year,
                      size: 22, // ~11pt font
                      color: this.colors.medium,
                      font: "Calibri",
                    }),
                  ],
                })
              ],
            }),
          ],
        }),
      ],
    });
    
    children.push(educationHeaderTable);

    // Add details if any
    details.forEach(detail => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• ",
              size: 22, // ~11pt font
              color: this.colors.primary,
              bold: true,
              font: "Calibri",
            }),
            new TextRun({
              text: detail,
              size: 22, // ~11pt font
              color: this.colors.dark,
              font: "Calibri",
            }),
          ],
          indent: {
            left: convertInchesToTwip(0.25)
          },
          spacing: {
            before: 40,
            after: 40
          }
        })
      );
    });
  }

  /**
   * Creates a visual representation of language proficiency
   * @param level The language proficiency level description
   * @returns A string with visual bars representing the proficiency level
   */
  private static getLanguageLevelBar(level: string): string {
    // Normalize the level to handle variations in wording
    const normalizedLevel = level.toLowerCase().trim();
    
    // Map proficiency levels to visualization bars (5 levels)
    if (normalizedLevel.includes('native') || 
        normalizedLevel.includes('fluent') || 
        normalizedLevel.includes('c2') ||
        normalizedLevel.includes('proficient') ||
        normalizedLevel.includes('full') ||
        normalizedLevel.includes('professional') ||
        normalizedLevel === '5/5') {
      return '■■■■■'; // 5/5 - Native/Fluent
    } else if (normalizedLevel.includes('advanced') || 
              normalizedLevel.includes('c1') ||
              normalizedLevel.includes('very good') ||
              normalizedLevel.includes('high') ||
              normalizedLevel === '4/5') {
      return '■■■■□'; // 4/5 - Advanced
    } else if (normalizedLevel.includes('intermediate') || 
              normalizedLevel.includes('b2') ||
              normalizedLevel.includes('good') ||
              normalizedLevel.includes('moderate') ||
              normalizedLevel === '3/5') {
      return '■■■□□'; // 3/5 - Intermediate
    } else if (normalizedLevel.includes('limited') || 
              normalizedLevel.includes('basic') || 
              normalizedLevel.includes('b1') ||
              normalizedLevel === '2/5') {
      return '■■□□□'; // 2/5 - Basic
    } else if (normalizedLevel.includes('elementary') || 
              normalizedLevel.includes('beginner') || 
              normalizedLevel.includes('a1') ||
              normalizedLevel.includes('a2') ||
              normalizedLevel === '1/5') {
      return '■□□□□'; // 1/5 - Elementary
    }
    
    // Default to middle level if we can't determine
    return '■■■□□';
  }
} 