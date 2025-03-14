import { Document, Paragraph, HeadingLevel, AlignmentType, TextRun, Packer, BorderStyle } from 'docx';

/**
 * Generates a structured document from optimized text
 * @param text The optimized text to convert to a document
 * @param documentName The name of the document
 * @returns A Promise that resolves to a Blob containing the document
 */
export const generateStructuredDocument = async (text: string, documentName: string): Promise<Blob> => {
  console.log("Starting structured document generation...");
  
  // Parse the text into sections
  const sections: Record<string, string[]> = {};
  let currentSection = 'GENERAL';
  sections[currentSection] = [];
  
  // Split the text into lines
  const lines = text.split('\n');
  
  // Process each line
  for (const line of lines) {
    // Check if this is a section header (all caps followed by a colon)
    const sectionMatch = line.match(/^([A-Z][A-Z\s]+):/);
    
    if (sectionMatch) {
      // This is a new section
      currentSection = sectionMatch[1].trim();
      sections[currentSection] = [];
      console.log(`Found section: ${currentSection}`);
    } else if (line.trim()) {
      // Add non-empty lines to the current section
      sections[currentSection].push(line);
    }
  }
  
  console.log(`Parsed ${Object.keys(sections).length} sections`);
  
  // Create the document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: documentName,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          },
          alignment: AlignmentType.CENTER
        }),
        
        // Process each section
        ...Object.entries(sections).flatMap(([sectionName, sectionLines]) => {
          if (sectionName === 'GENERAL' && sectionLines.length === 0) {
            return [];
          }
          
          const paragraphs = [];
          
          // Add section header if not GENERAL
          if (sectionName !== 'GENERAL') {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: sectionName,
                    bold: true,
                    size: 28
                  })
                ],
                spacing: {
                  before: 200,
                  after: 100
                },
                border: {
                  bottom: {
                    color: "#000000",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6
                  }
                }
              })
            );
          }
          
          // Add section content
          for (const line of sectionLines) {
            // Check if this is a bullet point
            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              paragraphs.push(
                new Paragraph({
                  text: line.trim().substring(1).trim(),
                  bullet: {
                    level: 0
                  },
                  spacing: {
                    before: 80,
                    after: 80
                  },
                  indent: {
                    left: 720
                  }
                })
              );
            } else {
              paragraphs.push(
                new Paragraph({
                  text: line,
                  spacing: {
                    before: 100,
                    after: 100
                  }
                })
              );
            }
          }
          
          return paragraphs;
        })
      ]
    }]
  });
  
  // Convert to blob
  console.log("Converting document to blob...");
  return await Packer.toBlob(doc);
};

/**
 * Generates a simple document from text
 * @param text The text to convert to a document
 * @param documentName The name of the document
 * @returns A Promise that resolves to a Blob containing the document
 */
export const generateSimpleDocument = async (text: string, documentName: string): Promise<Blob> => {
  console.log("Starting simple document generation...");
  
  // Create a basic document with the text
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: documentName,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          },
          alignment: AlignmentType.CENTER
        }),
        
        // Content - split by lines and create paragraphs
        ...text.split('\n').map(line => 
          new Paragraph({
            text: line,
            spacing: {
              before: 100,
              after: 100
            }
          })
        )
      ]
    }]
  });
  
  // Convert to blob
  console.log("Converting document to blob...");
  return await Packer.toBlob(doc);
};

/**
 * Creates a text file from the given text
 * @param text The text to convert to a file
 * @returns A Blob containing the text
 */
export const createTextFile = (text: string): Blob => {
  console.log("Creating text file...");
  return new Blob([text], { type: 'text/plain' });
};

/**
 * Creates a test document to verify DOCX generation capabilities
 * @returns A Promise that resolves to a Blob containing the test document
 */
export const createTestDocument = async (): Promise<Blob> => {
  console.log("Creating test document...");
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Test Document",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: "This is a test document to verify DOCX generation capabilities.",
          spacing: {
            before: 200,
            after: 200
          }
        }),
        new Paragraph({
          text: "If you can see this document, DOCX generation is working correctly.",
          spacing: {
            before: 200
          }
        })
      ]
    }]
  });
  
  return await Packer.toBlob(doc);
}; 