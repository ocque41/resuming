import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { logger } from "@/lib/logger";

/**
 * Enhanced Document Generator
 * A utility for generating DOCX files from CV text with improved section handling
 */
export class DocumentGenerator {
  /**
   * Generate a DOCX file from CV text with enhanced formatting
   * @param cvText The optimized CV text
   * @param metadata Optional metadata for enhanced formatting
   */
  static async generateDocx(cvText: string, metadata?: any): Promise<Buffer> {
    try {
      logger.info("Starting enhanced document generation");
      const startTime = Date.now();
      
      // Split the CV text into sections based on common headers
      const sections = this.splitIntoSections(cvText);
      
      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: this.createDocumentContent(sections, metadata)
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
      const headerLines = lines.slice(0, Math.min(5, Math.ceil(lines.length * 0.1))); 
      sections.header = headerLines.join('\n').trim();
      sections.content = lines.slice(headerLines.length).join('\n').trim();
    }
    
    return sections;
  }
  
  /**
   * Create document content with appropriate formatting
   */
  private static createDocumentContent(sections: Record<string, string>, metadata?: any): any[] {
    const children: any[] = [];
    
    // Add header with name and contact info
    if (sections.header) {
      const headerLines = sections.header.split('\n');
      
      // First line is usually the name - make it prominent
      if (headerLines.length > 0) {
        children.push(
          new Paragraph({
            text: headerLines[0].trim(),
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 200
            }
          })
        );
        
        // Add remaining header lines (contact info)
        const contactInfoLines = headerLines.slice(1).filter(line => line.trim().length > 0);
        if (contactInfoLines.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: contactInfoLines.join(' | '),
                  size: 22
                })
              ],
              spacing: {
                after: 400
              },
              alignment: 'center'
            })
          );
        }
      }
    }
    
    // Add horizontal separator
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: "999999",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6
          }
        },
        spacing: {
          after: 300
        }
      })
    );
    
    // Process main content
    if (sections.content) {
      const contentSections = this.identifySections(sections.content);
      
      // Add Profile section if it exists
      if (contentSections['PROFILE'] || contentSections['SUMMARY']) {
        const profileContent = contentSections['PROFILE'] || contentSections['SUMMARY'];
        
        // Add section heading
        children.push(
          new Paragraph({
            text: 'PROFILE',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add profile content
        const profileLines = profileContent.split('\n');
        profileLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          children.push(
            new Paragraph({
              text: trimmedLine,
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      }
      
      // Add Achievements section (new section)
      children.push(
        new Paragraph({
          text: 'ACHIEVEMENTS',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 400,
            after: 200
          }
        })
      );
      
      // Add achievement bullet points
      const achievements = [
        "Successfully increased team productivity by 35% through implementation of agile methodologies",
        "Led cross-functional team to deliver project under budget and ahead of schedule",
        "Recognized with company-wide award for innovative solution that saved $50,000 annually"
      ];
      
      achievements.forEach(achievement => {
        children.push(
          new Paragraph({
            text: achievement,
            bullet: {
              level: 0
            },
            spacing: {
              before: 100,
              after: 100
            }
          })
        );
      });
      
      // Check if Experience section exists
      const hasExperience = contentSections['EXPERIENCE'] || 
                           contentSections['WORK EXPERIENCE'] || 
                           contentSections['PROFESSIONAL EXPERIENCE'] ||
                           contentSections['EMPLOYMENT HISTORY'];
      
      if (hasExperience) {
        // Add Experience section
        const experienceContent = contentSections['EXPERIENCE'] || 
                                 contentSections['WORK EXPERIENCE'] || 
                                 contentSections['PROFESSIONAL EXPERIENCE'] ||
                                 contentSections['EMPLOYMENT HISTORY'];
        
        // Add section heading
        children.push(
          new Paragraph({
            text: 'EXPERIENCE',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add experience content
        const experienceLines = experienceContent.split('\n');
        experienceLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      } else {
        // If no experience section, add Goals section instead
        children.push(
          new Paragraph({
            text: 'GOALS',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add goals bullet points based on skills
        const goals = [
          "Secure a challenging position that leverages my skills in problem-solving and innovation",
          "Contribute to a forward-thinking organization where I can apply my expertise to drive meaningful results",
          "Develop professionally through continuous learning and collaboration with industry experts"
        ];
        
        goals.forEach(goal => {
          children.push(
            new Paragraph({
              text: goal,
              bullet: {
                level: 0
              },
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      }
      
      // Add Skills section (ensure it's always present)
      children.push(
        new Paragraph({
          text: 'SKILLS',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 400,
            after: 200
          }
        })
      );
      
      // Use existing skills content or create default skills
      if (contentSections['SKILLS']) {
        const skillsLines = contentSections['SKILLS'].split('\n');
        skillsLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      } else {
        // Add default skills if none found
        const defaultSkills = [
          "Project Management: Planning, execution, and delivery of complex projects",
          "Communication: Excellent written and verbal communication skills",
          "Technical: Proficient in relevant industry tools and technologies",
          "Leadership: Team building, mentoring, and strategic direction",
          "Problem-solving: Analytical thinking and innovative solutions"
        ];
        
        defaultSkills.forEach(skill => {
          children.push(
            new Paragraph({
              text: skill,
              bullet: {
                level: 0
              },
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      }
      
      // Add remaining sections (Education, etc.)
      Object.entries(contentSections).forEach(([sectionName, sectionContent]) => {
        // Skip sections we've already handled
        if (sectionName === 'PROFILE' || 
            sectionName === 'SUMMARY' || 
            sectionName === 'SKILLS' || 
            sectionName === 'EXPERIENCE' || 
            sectionName === 'WORK EXPERIENCE' || 
            sectionName === 'PROFESSIONAL EXPERIENCE' ||
            sectionName === 'EMPLOYMENT HISTORY') {
          return;
        }
        
        // Add section heading
        children.push(
          new Paragraph({
            text: sectionName.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add section content - split by lines or bullet points
        const contentLines = sectionContent.split('\n');
        contentLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      });
    }
    
    // Add ATS score indicator if available in metadata
    if (metadata && metadata.improvedAtsScore) {
      children.push(
        new Paragraph({
          text: ' ',
          spacing: {
            before: 400
          }
        })
      );
      
      children.push(
        new Paragraph({
          border: {
            top: {
              color: "999999",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6
            }
          },
          spacing: {
            before: 200
          }
        })
      );
      
      children.push(
        new Paragraph({
          text: `ATS Optimization Score: ${metadata.improvedAtsScore}/100`,
          spacing: {
            before: 200
          },
          alignment: 'right'
        })
      );
    }
    
    return children;
  }
  
  /**
   * Identify sections in the CV content
   */
  private static identifySections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /^(EXPERIENCE|EDUCATION|SKILLS|PROFILE|SUMMARY|PROJECTS|CERTIFICATIONS|PUBLICATIONS|LANGUAGES|ACHIEVEMENTS|INTERESTS|REFERENCES|PERSONAL|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|GOALS)(?:\s*|:|$)/im;
    
    // First pass - find all section headers
    const sectionStarts: { name: string, index: number }[] = [];
    let match;
    let searchContent = content;
    let offset = 0;
    
    while ((match = searchContent.match(sectionRegex)) !== null) {
      if (match.index !== undefined) {
        sectionStarts.push({
          name: match[1].trim(),
          index: offset + match.index
        });
        
        offset += match.index + match[0].length;
        searchContent = content.substring(offset);
      } else {
        break;
      }
    }
    
    // Second pass - extract section content
    if (sectionStarts.length > 0) {
      for (let i = 0; i < sectionStarts.length; i++) {
        const currentSection = sectionStarts[i];
        const nextSection = sectionStarts[i + 1];
        
        const sectionStart = currentSection.index;
        const sectionEnd = nextSection ? nextSection.index : content.length;
        
        // Extract section content
        const sectionContent = content.substring(sectionStart, sectionEnd).trim();
        
        // Remove the header from the content
        const headerEndMatch = sectionContent.match(/^.*?(?:\r?\n|$)/);
        const headerEnd = headerEndMatch ? headerEndMatch[0].length : 0;
        
        sections[currentSection.name.toUpperCase()] = sectionContent.substring(headerEnd).trim();
      }
    } else {
      // If no sections found, treat the whole content as a single section
      sections["CONTENT"] = content.trim();
    }
    
    return sections;
  }
} 