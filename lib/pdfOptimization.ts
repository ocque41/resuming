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
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testLineWidth > maxWidth && currentLine !== "") {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Overlays the optimized CV text onto the original PDF by replacing content in place.
 *
 * @param originalPdfBytes - The original PDF as a Uint8Array.
 * @param optimizedText - The optimized CV text generated by GPT-3.5-turbo.
 * @param rawText - The original CV text.
 * @returns A Promise that resolves with the modified PDF as a Base64-encoded string.
 */
export async function modifyPDFWithOptimizedContent(
  originalPdfBytes: Uint8Array,
  optimizedText: string,
  rawText?: string
): Promise<string> {
  // Load the original PDF document
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  
  // Parse the optimized text into sections
  const optimizedSections = parseOptimizedText(optimizedText);
  
  // Get the first page
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Default margins and styling
  const margin = 50;
  const fontSize = 10;
  const headerFontSize = 12;
  const lineHeight = fontSize * 1.2;
  const maxWidth = width - margin * 2;
  
  // If we have the raw text, try to identify and replace sections
  if (rawText) {
    const originalSections = identifyOriginalSections(rawText);
    const sectionMappings = mapSectionsForReplacement(optimizedSections, originalSections);
    
    // Cover original content with white rectangles and draw new content
    for (const mapping of sectionMappings) {
      // Calculate approximate position on the page based on text position
      // This is a simplified approach - in a real implementation, you'd need more sophisticated text position detection
      const textPosition = mapping.startIndex / rawText.length;
      const yPosition = height - (textPosition * (height - 2 * margin)) - margin;
      
      // Cover the original section with a white rectangle
      if (mapping.originalSection !== "NEW_SECTION") {
        const sectionHeight = (mapping.endIndex - mapping.startIndex) / rawText.length * (height - 2 * margin);
        page.drawRectangle({
          x: margin,
          y: yPosition - sectionHeight,
          width: width - 2 * margin,
          height: sectionHeight + lineHeight,
          color: rgb(1, 1, 1), // White
        });
      }
      
      // Draw the new section header
      page.drawText(mapping.optimizedSection, {
        x: margin,
        y: yPosition,
        size: headerFontSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      // Draw the section content
      const sectionContent = optimizedSections[mapping.optimizedSection];
      const paragraphs = sectionContent.split('\n\n');
      
      let currentY = yPosition - lineHeight * 1.5;
      
      for (const paragraph of paragraphs) {
        const lines = wrapText(paragraph, helveticaFont, fontSize, maxWidth);
        
        for (const line of lines) {
          page.drawText(line, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          currentY -= lineHeight;
        }
        
        // Add space between paragraphs
        currentY -= lineHeight * 0.5;
      }
    }
  } else {
    // Fallback to the simpler approach if we don't have raw text
    let currentY = height - margin;
    
    // Process each section
    for (const [sectionName, sectionContent] of Object.entries(optimizedSections)) {
      // Draw section header
      page.drawText(sectionName, {
        x: margin,
        y: currentY,
        size: headerFontSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      currentY -= lineHeight * 1.5;
      
      // Process section content with proper paragraph breaks
      const paragraphs = sectionContent.split('\n\n');
      for (const paragraph of paragraphs) {
        const lines = wrapText(paragraph, helveticaFont, fontSize, maxWidth);
        
        for (const line of lines) {
          // If we're running out of space on this page, add a new page
          if (currentY < margin) {
            const newPage = pdfDoc.addPage([width, height]);
            page = newPage;
            currentY = height - margin;
          }
          
          page.drawText(line, {
            x: margin,
            y: currentY,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          currentY -= lineHeight;
        }
        
        // Add space between paragraphs
        currentY -= lineHeight * 0.5;
      }
      
      // Add space between sections
      currentY -= lineHeight;
    }
  }
  
  // Serialize the modified PDF
  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes).toString("base64");
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
