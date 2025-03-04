import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { getOverlayCoordinates } from "./templateMatching";

/**
 * Parses structured optimized text into sections
 */
function parseOptimizedText(optimizedText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Split by section headers (assuming they're marked with ## or similar)
  const sectionRegex = /##\s*([^#\n]+)\s*\n([\s\S]*?)(?=##\s*[^#\n]+\s*\n|$)/g;
  let match;
  
  while ((match = sectionRegex.exec(optimizedText)) !== null) {
    const sectionName = match[1].trim();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }
  
  // If no sections found, treat the whole text as one section
  if (Object.keys(sections).length === 0) {
    sections["Content"] = optimizedText;
  }
  
  return sections;
}

/**
 * Identifies sections in the original CV text
 */
function identifyOriginalSections(rawText: string): Record<string, { text: string, startIndex: number, endIndex: number }> {
  const sections: Record<string, { text: string, startIndex: number, endIndex: number }> = {};
  
  // Common section headers in CVs
  const sectionHeaders = [
    "PROFILE", "OBJECTIVE", "SUMMARY", "EXPERIENCE", "WORK EXPERIENCE", 
    "EDUCATION", "SKILLS", "LANGUAGES", "CERTIFICATIONS", "PROJECTS",
    "INTERESTS", "REFERENCES", "PUBLICATIONS", "AWARDS", "VOLUNTEER"
  ];
  
  // Find potential section boundaries
  for (const header of sectionHeaders) {
    const regex = new RegExp(`(^|\\s)${header}[\\s:]*`, 'i');
    const match = regex.exec(rawText);
    
    if (match) {
      const startIndex = match.index;
      let endIndex = rawText.length;
      
      // Find the next section header to determine the end of this section
      for (const nextHeader of sectionHeaders) {
        if (nextHeader === header) continue;
        
        const nextRegex = new RegExp(`(^|\\s)${nextHeader}[\\s:]*`, 'i');
        const nextMatch = nextRegex.exec(rawText.substring(startIndex + match[0].length));
        
        if (nextMatch) {
          const potentialEndIndex = startIndex + match[0].length + nextMatch.index;
          if (potentialEndIndex < endIndex) {
            endIndex = potentialEndIndex;
          }
        }
      }
      
      sections[header.toUpperCase()] = {
        text: rawText.substring(startIndex, endIndex),
        startIndex,
        endIndex
      };
    }
  }
  
  // If no sections were found, treat the entire text as one section
  if (Object.keys(sections).length === 0) {
    sections["CONTENT"] = {
      text: rawText,
      startIndex: 0,
      endIndex: rawText.length
    };
  }
  
  return sections;
}

/**
 * Maps optimized sections to original sections for replacement
 */
function mapSectionsForReplacement(
  optimizedSections: Record<string, string>,
  originalSections: Record<string, { text: string, startIndex: number, endIndex: number }>
): Array<{ 
  originalSection: string, 
  optimizedSection: string,
  startIndex: number, 
  endIndex: number 
}> {
  const mappings = [];
  
  // Try to match optimized sections to original sections
  for (const [optimizedSectionName, optimizedContent] of Object.entries(optimizedSections)) {
    // Normalize section name for comparison
    const normalizedName = optimizedSectionName.toUpperCase().trim();
    
    // Try to find a direct match
    let matched = false;
    for (const [originalSectionName, originalData] of Object.entries(originalSections)) {
      if (originalSectionName.includes(normalizedName) || normalizedName.includes(originalSectionName)) {
        mappings.push({
          originalSection: originalSectionName,
          optimizedSection: optimizedSectionName,
          startIndex: originalData.startIndex,
          endIndex: originalData.endIndex
        });
        matched = true;
        break;
      }
    }
    
    // If no direct match, try fuzzy matching
    if (!matched) {
      // Check for common section aliases
      const aliases: Record<string, string[]> = {
        "PROFILE": ["OBJECTIVE", "SUMMARY", "ABOUT ME"],
        "EXPERIENCE": ["WORK EXPERIENCE", "EMPLOYMENT", "PROFESSIONAL EXPERIENCE"],
        "SKILLS": ["TECHNICAL SKILLS", "COMPETENCIES", "EXPERTISE"],
        "EDUCATION": ["ACADEMIC BACKGROUND", "QUALIFICATIONS", "TRAINING"]
      };
      
      for (const [aliasGroup, aliasList] of Object.entries(aliases)) {
        if (aliasList.some(alias => normalizedName.includes(alias)) || normalizedName.includes(aliasGroup)) {
          for (const [originalSectionName, originalData] of Object.entries(originalSections)) {
            if (originalSectionName.includes(aliasGroup) || 
                aliasList.some(alias => originalSectionName.includes(alias))) {
              mappings.push({
                originalSection: originalSectionName,
                optimizedSection: optimizedSectionName,
                startIndex: originalData.startIndex,
                endIndex: originalData.endIndex
              });
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
    }
    
    // If still no match, add to the end
    if (!matched) {
      // Find the last section's end index
      let lastEndIndex = 0;
      for (const originalData of Object.values(originalSections)) {
        if (originalData.endIndex > lastEndIndex) {
          lastEndIndex = originalData.endIndex;
        }
      }
      
      mappings.push({
        originalSection: "NEW_SECTION",
        optimizedSection: optimizedSectionName,
        startIndex: lastEndIndex,
        endIndex: lastEndIndex
      });
    }
  }
  
  // Sort mappings by startIndex to maintain document order
  return mappings.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Wraps the given text into lines that do not exceed maxWidth.
 *
 * @param text - The text to wrap.
 * @param font - The PDF font used.
 * @param fontSize - The font size.
 * @param maxWidth - The maximum width in points.
 * @returns An array of lines.
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  // Replace newlines with spaces to avoid encoding issues
  const sanitizedText = text.replace(/\n/g, ' ');
  const words = sanitizedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    // Skip empty words that might result from multiple spaces
    if (!word) continue;
    
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    try {
      const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testLineWidth > maxWidth && currentLine !== "") {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    } catch (error) {
      console.warn(`Error measuring text width for "${testLine}": ${error}`);
      // If we can't measure, just add the word and move on
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = word;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Update the sanitizeText function to be more aggressive
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\r?\n/g, ' ')         // Replace all newlines with spaces
    .replace(/\u000a/g, ' ')        // Explicitly target the 0x000a character
    .replace(/[\u0000-\u001F]/g, ' ')  // Replace all control characters
    .replace(/\s+/g, ' ')           // Replace multiple spaces with a single space
    .trim();                        // Trim leading/trailing whitespace
}

/**
 * Creates a new PDF with the optimized content rather than trying to modify the original
 */
export async function modifyPDFWithOptimizedContent(
  originalPdfBytes: Uint8Array,
  optimizedText: string,
  rawText?: string
): Promise<string> {
  try {
    // Sanitize the optimized text first - be extra careful
    optimizedText = sanitizeText(optimizedText);
    
    // Load the original PDF document to get its dimensions
    const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
    const firstPage = originalPdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    
    // Create a new PDF document with the same dimensions
    const newPdfDoc = await PDFDocument.create();
    let page = newPdfDoc.addPage([width, height]);
    
    // Embed fonts
    const helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await newPdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Default margins and styling
    const margin = 50;
    const fontSize = 10;
    const headerFontSize = 12;
    const lineHeight = fontSize * 1.2;
    const maxWidth = width - margin * 2;
    
    // Parse the optimized text into sections - sanitize again to be safe
    const optimizedSections = parseOptimizedText(sanitizeText(optimizedText));
    
    // Start at the top of the page
    let currentY = height - margin;
    
    // Add contact information at the top (assuming it's in the first few lines of rawText)
    if (rawText) {
      // Extra sanitization for contact info
      const contactLines = sanitizeText(rawText.split('\n').slice(0, 3).join(' '));
      
      // Draw contact info
      page.drawText(contactLines, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      currentY -= lineHeight * 4; // Move down after contact info
    }
    
    // Process each section with extra sanitization
    for (const [sectionName, sectionContent] of Object.entries(optimizedSections)) {
      // Sanitize the section name
      const sanitizedSectionName = sanitizeText(sectionName);
      
      // Draw section header
      page.drawText(sanitizedSectionName.toUpperCase(), {
        x: margin,
        y: currentY,
        size: headerFontSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      currentY -= lineHeight * 1.5;
      
      // Process section content with proper paragraph breaks
      // Use double spaces as paragraph delimiters instead of newlines
      const sanitizedContent = sanitizeText(sectionContent);
      const paragraphs = sanitizedContent.split('  ').map(p => sanitizeText(p)).filter(Boolean);
      
      for (const paragraph of paragraphs) {
        // Extra sanitization for each paragraph
        const cleanParagraph = sanitizeText(paragraph);
        
        // Handle bullet points
        if (cleanParagraph.includes('• ') || cleanParagraph.includes('- ')) {
          // Split by bullet points, being careful with the regex
          const bulletPoints = cleanParagraph
            .split(/(?:^|\s)(?:•|-)\s+/)
            .filter(Boolean)
            .map(point => sanitizeText(point));
          
          for (const point of bulletPoints) {
            try {
              // Extra sanitization for each bullet point
              const cleanPoint = sanitizeText(point);
              const lines = wrapText(cleanPoint, helveticaFont, fontSize, maxWidth - 15);
              
              // Draw bullet
              page.drawText('•', {
                x: margin,
                y: currentY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
              });
              
              // Draw bullet point text
              for (const line of lines) {
                // Check if we need a new page
                if (currentY < margin) {
                  // Add a new page
                  const newPage = newPdfDoc.addPage([width, height]);
                  page = newPage;
                  currentY = height - margin;
                }
                
                // Final sanitization before drawing
                const cleanLine = sanitizeText(line);
                page.drawText(cleanLine, {
                  x: margin + 15, // Indent for bullets
                  y: currentY,
                  size: fontSize,
                  font: helveticaFont,
                  color: rgb(0, 0, 0),
                });
                currentY -= lineHeight;
              }
              
              // Add space between bullet points
              currentY -= lineHeight * 0.3;
            } catch (error: any) {
              console.error(`Error processing bullet point: ${error}`);
              // Continue with next bullet point
            }
          }
        } else {
          // Regular paragraph
          try {
            const lines = wrapText(cleanParagraph, helveticaFont, fontSize, maxWidth);
            
            for (const line of lines) {
              // Check if we need a new page
              if (currentY < margin) {
                // Add a new page
                const newPage = newPdfDoc.addPage([width, height]);
                page = newPage;
                currentY = height - margin;
              }
              
              // Final sanitization before drawing
              const cleanLine = sanitizeText(line);
              page.drawText(cleanLine, {
                x: margin,
                y: currentY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
              });
              currentY -= lineHeight;
            }
          } catch (error) {
            console.error(`Error processing paragraph: ${error}`);
            // Continue with next paragraph
          }
        }
        
        // Add space between paragraphs
        currentY -= lineHeight * 0.5;
      }
      
      // Add space between sections
      currentY -= lineHeight;
    }
    
    // Embed the full text content as metadata in the PDF for easier extraction later
    const metadata = {
      fullText: sanitizeText(optimizedText),
      generatedAt: new Date().toISOString(),
      isOptimized: true
    };

    // Set PDF metadata using the methods that are available in pdf-lib
    newPdfDoc.setTitle("Optimized CV");
    newPdfDoc.setSubject("CV optimized with AI");
    newPdfDoc.setKeywords(["CV", "resume", "optimized"]);
    newPdfDoc.setProducer("CV Optimizer");
    newPdfDoc.setCreator("CV Optimizer AI");

    // Store the full text in the Subject field since custom metadata isn't available
    newPdfDoc.setSubject(JSON.stringify(metadata));

    // Serialize the PDF with metadata
    const newPdfBytes = await newPdfDoc.save();
    return Buffer.from(newPdfBytes).toString("base64");
  } catch (error) {
    console.error("Error in PDF modification:", error);
    throw new Error(`PDF modification failed: ${(error as Error).message}`);
  }
}

// Helper function to get section-specific coordinates
function getSectionCoordinates(sectionName: string, coordinates: any): number | null {
  if (!coordinates) return null;
  
  const sectionMap: Record<string, number | undefined> = {
    "Experience": coordinates.experienceY,
    "Education": coordinates.educationY,
    "Skills": coordinates.skillsY,
    // Add more mappings as needed
  };
  
  return sectionMap[sectionName] || null;
}
