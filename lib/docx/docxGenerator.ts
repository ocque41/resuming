import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

interface DocxGenerationOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  description?: string;
}

/**
 * Generates a DOCX file from optimized CV text
 * @param cvText The optimized CV text to convert to DOCX
 * @param options Additional options for the DOCX document
 * @returns A Buffer containing the generated DOCX file
 */
export async function generateDocx(cvText: string, options: DocxGenerationOptions = {}): Promise<Buffer> {
  if (!cvText) {
    throw new Error('CV text is required');
  }

  try {
    // Split the text into sections based on line breaks
    const sections = cvText.split('\n\n').filter(section => section.trim().length > 0);
    
    // Create paragraphs for each section
    const paragraphs: Paragraph[] = [];
    
    // Process each section
    sections.forEach((section, index) => {
      const lines = section.split('\n');
      
      // If this is the first section, treat it as a header (name, contact info)
      if (index === 0) {
        lines.forEach((line, lineIndex) => {
          if (lineIndex === 0) {
            // First line is likely the name - make it a heading
            paragraphs.push(
              new Paragraph({
                text: line.trim(),
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 200,
                },
                border: {
                  bottom: {
                    color: "#B4916C",
                    size: 15,
                    style: BorderStyle.SINGLE,
                  },
                },
              })
            );
          } else {
            // Contact info - center aligned
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: line.trim(),
                    size: 20,
                  }),
                ],
                spacing: {
                  after: 100,
                },
              })
            );
          }
        });
        
        // Add extra space after the header
        paragraphs.push(new Paragraph({ text: "", spacing: { after: 400 } }));
      } else {
        // For other sections, check if the first line is a heading
        if (lines.length > 0) {
          // First line is likely a section heading
          paragraphs.push(
            new Paragraph({
              text: lines[0].trim(),
              heading: HeadingLevel.HEADING_2,
              thematicBreak: true,
              spacing: {
                before: 400,
                after: 200,
              },
            })
          );
          
          // Process the rest of the lines in this section
          const contentLines = lines.slice(1);
          
          contentLines.forEach(line => {
            if (line.trim().length > 0) {
              // Check if this line starts with a bullet point
              if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
                paragraphs.push(
                  new Paragraph({
                    text: line.trim().replace(/^[•\-*]\s*/, ''),
                    bullet: {
                      level: 0,
                    },
                    spacing: {
                      after: 100,
                    },
                  })
                );
              } else {
                paragraphs.push(
                  new Paragraph({
                    text: line.trim(),
                    spacing: {
                      after: 100,
                    },
                  })
                );
              }
            }
          });
        }
      }
    });
    
    // Create the document with the paragraphs
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
      creator: options.author || 'CV Optimizer',
      title: options.title || 'Optimized CV',
      description: options.description || 'CV optimized for ATS compatibility',
      subject: options.subject || 'Resume/CV',
      keywords: options.keywords?.join(', ') || 'resume, cv, job application',
    });
    
    // Generate the document as a buffer
    const buffer = await Packer.toBuffer(doc);
    
    return buffer;
  } catch (error) {
    console.error('Error generating DOCX:', error);
    throw new Error(`Failed to generate DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
} 