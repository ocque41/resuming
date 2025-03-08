import * as docx from 'docx';
import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  BorderStyle, 
  TableRow, 
  TableCell,
  WidthType,
  Table,
  convertInchesToTwip,
  ISectionOptions
} from 'docx';

/**
 * Generates a DOCX document from standardized CV text
 * @param standardizedCV The standardized CV text with properly formatted sections
 * @returns Promise with the DOCX document buffer
 */
export async function generateDocx(standardizedCV: string): Promise<Buffer> {
  // Split the CV by sections
  const sections = standardizedCV.split(/\n\n(?=[A-Z]+\n)/);
  
  // Define as a normal array, not a readonly array
  const docElements: Array<Paragraph> = [];
  
  // Process each section
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0];
    const content = lines.slice(1).join('\n');
    
    // Add section heading
    docElements.push(
      new Paragraph({
        text: heading,
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 240,
          after: 120
        },
        style: 'SectionHeading'
      })
    );
    
    // Process the content based on section type
    switch (heading) {
      case 'PROFILE':
      case 'CAREER GOAL':
        // Single paragraph sections
        docElements.push(
          new Paragraph({
            text: content,
            spacing: {
              after: 200
            }
          })
        );
        break;
        
      case 'ACHIEVEMENTS':
      case 'SKILLS':
      case 'LANGUAGES':
        // Bullet point sections
        const bulletPoints = content.split('\n');
        
        // Check for subsections (like "Technical Skills:")
        let currentSubsection = '';
        
        for (const point of bulletPoints) {
          if (point.endsWith(':')) {
            // This is a subsection heading
            currentSubsection = point;
            docElements.push(
              new Paragraph({
                text: point,
                spacing: {
                  before: 120,
                  after: 80
                },
                style: 'SubsectionHeading'
              })
            );
          } else if (point.startsWith('•')) {
            // This is a bullet point
            docElements.push(
              new Paragraph({
                text: point.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  after: 80
                }
              })
            );
          } else {
            // Regular text
            docElements.push(
              new Paragraph({
                text: point,
                spacing: {
                  after: 80
                }
              })
            );
          }
        }
        break;
        
      case 'WORK EXPERIENCE':
      case 'EDUCATION':
        // Experience/education entries
        const entries = content.split('\n\n');
        
        for (const entry of entries) {
          const entryLines = entry.split('\n');
          const titleLine = entryLines[0];
          const details = entryLines.slice(1);
          
          // Title line (position, company, date)
          docElements.push(
            new Paragraph({
              text: titleLine,
              style: 'ExperienceTitle',
              spacing: {
                before: 160,
                after: 80
              }
            })
          );
          
          // Details (bullet points)
          for (const detail of details) {
            if (detail.startsWith('•')) {
              docElements.push(
                new Paragraph({
                  text: detail.substring(1).trim(),
                  bullet: {
                    level: 0
                  },
                  spacing: {
                    after: 80
                  }
                })
              );
            } else {
              docElements.push(
                new Paragraph({
                  text: detail,
                  spacing: {
                    after: 80
                  }
                })
              );
            }
          }
        }
        break;
        
      default:
        // Generic content
        const contentLines = content.split('\n');
        for (const line of contentLines) {
          docElements.push(
            new Paragraph({
              text: line,
              spacing: {
                after: 80
              }
            })
          );
        }
    }
  }
  
  // Define document styles
  const styles = {
    paragraphStyles: [
      {
        id: 'SectionHeading',
        name: 'Section Heading',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          color: '4A4A4A',
          size: 28,
          bold: true,
        },
        paragraph: {
          spacing: {
            after: 120
          }
        }
      },
      {
        id: 'SubsectionHeading',
        name: 'Subsection Heading',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          color: '666666',
          size: 24,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: 120,
            after: 80
          }
        }
      },
      {
        id: 'ExperienceTitle',
        name: 'Experience Title',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          color: '333333',
          size: 24,
          bold: true,
        },
        paragraph: {
          spacing: {
            before: 160,
            after: 80
          }
        }
      }
    ]
  };
  
  // Create the document
  const doc = new Document({
    styles,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: '2.54cm',
              right: '2.54cm',
              bottom: '2.54cm',
              left: '2.54cm',
            },
          },
        },
        children: docElements,
      },
    ],
  });
  
  // Generate buffer
  return await docx.Packer.toBuffer(doc);
} 