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
    
    // Embed professional fonts
    const helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await newPdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await newPdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await newPdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    // Brand colors from the design system
    const primaryColor = rgb(88/255, 66/255, 53/255); // Rich Walnut: #584235
    const secondaryColor = rgb(232/255, 220/255, 196/255); // Aged Paper: #E8DCC4
    const accentColor = rgb(180/255, 145/255, 108/255); // Bamboo: #B4916C
    const backgroundColor = rgb(250/255, 246/255, 237/255); // Rice Paper: #FAF6ED
    const textColor = rgb(44/255, 36/255, 32/255); // Ink Stone: #2C2420
    
    // Enhanced styling and layout
    const margin = 50;
    const fontSize = 10;
    const headerFontSize = 14;
    const subheaderFontSize = 12;
    const nameSize = 24; // Larger size for the name
    const lineHeight = fontSize * 1.4; // Increased for better readability
    const maxWidth = width - margin * 2;
    
    // Parse the optimized text into sections
    const optimizedSections = parseOptimizedText(sanitizeText(optimizedText));
    
    // Fill page with subtle background color
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: height,
      color: backgroundColor,
    });
    
    // Add header bar at the top
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: primaryColor,
    });
    
    // Start at the top of the page
    let currentY = height - 70;
    
    // Extract name from the first line of rawText if available
    let candidateName = '';
    if (rawText) {
      candidateName = sanitizeText(rawText.split('\n')[0]);
      
      // Draw the name prominently in the header bar
      page.drawText(candidateName.toUpperCase(), {
        x: margin,
        y: height - 80,
        size: nameSize,
        font: timesBold,
        color: secondaryColor,
      });
      
      // Extract contact information (email, phone, etc.)
      const contactInfo = sanitizeText(rawText.split('\n').slice(1, 3).join(' '));
      
      // Draw contact info below the name
      page.drawText(contactInfo, {
        x: margin,
        y: height - 110,
        size: fontSize,
        font: helveticaFont,
        color: secondaryColor,
      });
    }
    
    // Start content below the header bar
    currentY = height - 140;
    
    // Process each section with enhanced styling
    for (const [sectionName, sectionContent] of Object.entries(optimizedSections)) {
      // Sanitize the section name
      const sanitizedSectionName = sanitizeText(sectionName);
      
      // Check if we need a new page
      if (currentY < margin + 50) {
        page = newPdfDoc.addPage([width, height]);
        
        // Add subtle background color to new page
        page.drawRectangle({
          x: 0,
          y: 0,
          width: width,
          height: height,
          color: backgroundColor,
        });
        
        currentY = height - margin;
      }
      
      // Draw decorative element before section header
      page.drawLine({
        start: { x: margin, y: currentY + 5 },
        end: { x: margin + 20, y: currentY + 5 },
        thickness: 3,
        color: accentColor,
      });
      
      // Draw section header with modern styling
      page.drawText(sanitizedSectionName.toUpperCase(), {
        x: margin + 30,
        y: currentY,
        size: headerFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      // Add thin line after the header
      page.drawLine({
        start: { x: margin + 30 + sanitizedSectionName.length * (headerFontSize/2), y: currentY + 5 },
        end: { x: width - margin, y: currentY + 5 },
        thickness: 1,
        color: accentColor,
      });
      
      currentY -= lineHeight * 2;
      
      // Process section content with proper paragraph breaks
      const sanitizedContent = sanitizeText(sectionContent);
      const paragraphs = sanitizedContent.split('  ').map(p => sanitizeText(p)).filter(Boolean);
      
      for (const paragraph of paragraphs) {
        // Extra sanitization for each paragraph
        const cleanParagraph = sanitizeText(paragraph);
        
        // Handle bullet points with enhanced styling
        if (cleanParagraph.includes('• ') || cleanParagraph.includes('- ')) {
          // Split by bullet points, being careful with the regex
          const bulletPoints = cleanParagraph
            .split(/(?:^|\s)(?:•|-)\s+/)
            .filter(Boolean)
            .map(point => sanitizeText(point));
          
          for (const point of bulletPoints) {
            try {
              // Check if we need a new page
              if (currentY < margin + 20) {
                page = newPdfDoc.addPage([width, height]);
                
                // Add subtle background color to new page
                page.drawRectangle({
                  x: 0,
                  y: 0,
                  width: width,
                  height: height,
                  color: backgroundColor,
                });
                
                currentY = height - margin;
              }
              
              // Extra sanitization for each bullet point
              const cleanPoint = sanitizeText(point);
              const lines = wrapText(cleanPoint, helveticaFont, fontSize, maxWidth - 20);
              
              // Draw stylized bullet
              page.drawCircle({
                x: margin + 4,
                y: currentY + 3,
                size: 2.5,
                color: accentColor,
              });
              
              // Draw bullet point text
              for (const line of lines) {
                // Draw text with slight indent for bullets
                page.drawText(sanitizeText(line), {
                  x: margin + 15,
                  y: currentY,
                  size: fontSize,
                  font: helveticaFont,
                  color: textColor,
                });
                
                currentY -= lineHeight;
                
                // Check if we need a new page
                if (currentY < margin) {
                  page = newPdfDoc.addPage([width, height]);
                  
                  // Add subtle background color to new page
                  page.drawRectangle({
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                    color: backgroundColor,
                  });
                  
                  currentY = height - margin;
                }
              }
            } catch (error) {
              console.error("Error processing bullet point:", error);
              // Continue with next point even if there's an error
              currentY -= lineHeight;
            }
          }
        } else {
          // Regular paragraph text (not a bullet point)
          // Check if this looks like a subheader (all caps, or ends with a colon)
          const isSubheader = paragraph === paragraph.toUpperCase() || paragraph.endsWith(':');
          
          if (isSubheader) {
            // Check if we need a new page
            if (currentY < margin + 30) {
              page = newPdfDoc.addPage([width, height]);
              
              // Add subtle background color to new page
              page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: height,
                color: backgroundColor,
              });
              
              currentY = height - margin;
            }
            
            // Draw as subheader with accent color
            page.drawText(sanitizeText(paragraph), {
              x: margin,
              y: currentY,
              size: subheaderFontSize,
              font: helveticaBold,
              color: accentColor,
            });
            
            currentY -= lineHeight * 1.5;
          } else {
            // Wrap the paragraph text
            const lines = wrapText(paragraph, helveticaFont, fontSize, maxWidth);
            
            for (const line of lines) {
              // Check if we need a new page
              if (currentY < margin) {
                page = newPdfDoc.addPage([width, height]);
                
                // Add subtle background color to new page
                page.drawRectangle({
                  x: 0,
                  y: 0,
                  width: width,
                  height: height,
                  color: backgroundColor,
                });
                
                currentY = height - margin;
              }
              
              // Draw the line of text
              page.drawText(sanitizeText(line), {
                x: margin,
                y: currentY,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              
              currentY -= lineHeight;
            }
            
            // Add extra space after paragraphs
            currentY -= lineHeight * 0.5;
          }
        }
        
        // Add a subtle divider after each section (except the last one)
        if (Object.keys(optimizedSections).indexOf(sectionName) < Object.keys(optimizedSections).length - 1) {
          // Check if we need a new page
          if (currentY < margin + 20) {
            page = newPdfDoc.addPage([width, height]);
            
            // Add subtle background color to new page
            page.drawRectangle({
              x: 0,
              y: 0,
              width: width,
              height: height,
              color: backgroundColor,
            });
            
            currentY = height - margin;
          }
          
          // Draw a subtle divider line
          page.drawLine({
            start: { x: margin, y: currentY - 10 },
            end: { x: width - margin, y: currentY - 10 },
            thickness: 0.5,
            color: accentColor,
          });
          
          currentY -= lineHeight * 2;
        }
      }
    }
    
    // Add a professional footer to each page
    const pageCount = newPdfDoc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const page = newPdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Draw subtle footer line
      page.drawLine({
        start: { x: margin, y: 30 },
        end: { x: width - margin, y: 30 },
        thickness: 0.5,
        color: accentColor,
      });
      
      // Add page number and date
      const currentDate = new Date().toLocaleDateString();
      page.drawText(`Page ${i + 1} of ${pageCount} | Updated: ${currentDate}`, {
        x: margin,
        y: 15,
        size: 8,
        font: helveticaFont,
        color: primaryColor,
      });
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
    console.error("Error in PDF generation:", error);
    throw new Error(`Failed to modify PDF: ${error}`);
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
