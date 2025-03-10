import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { logger } from "@/lib/logger";

/**
 * Fast Document Generator
 * A lightweight utility for generating DOCX files from CV text
 */
export class DocumentGenerator {
  /**
   * Generate a DOCX file from CV text with minimal processing
   * @param cvText The optimized CV text
   * @param metadata Optional metadata for enhanced formatting
   */
  static async generateDocx(cvText: string, metadata?: any): Promise<Buffer> {
    try {
      logger.info("Starting fast document generation");
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
      
      // Add each content section
      Object.entries(contentSections).forEach(([sectionName, sectionContent]) => {
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
    const sectionRegex = /^(EXPERIENCE|EDUCATION|SKILLS|PROFILE|SUMMARY|PROJECTS|CERTIFICATIONS|PUBLICATIONS|LANGUAGES|ACHIEVEMENTS|INTERESTS|REFERENCES|PERSONAL|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY)(?:\s*|:|$)/im;
    
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
    
    // Second pass - extract sections based on starts
    for (let i = 0; i < sectionStarts.length; i++) {
      const currentSection = sectionStarts[i];
      const nextSection = sectionStarts[i + 1];
      
      const sectionStart = currentSection.index;
      const sectionEnd = nextSection ? nextSection.index : content.length;
      
      // Extract the section content (excluding the header)
      const sectionNameEndIndex = content.indexOf('\n', sectionStart);
      const sectionContentStart = sectionNameEndIndex !== -1 ? sectionNameEndIndex + 1 : sectionStart + currentSection.name.length;
      
      sections[currentSection.name] = content.substring(sectionContentStart, sectionEnd).trim();
    }
    
    // Handle case where no sections were found
    if (Object.keys(sections).length === 0) {
      sections["Content"] = content;
    }
    
    return sections;
  }
} 