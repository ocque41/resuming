import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { getOverlayCoordinates } from "./templateMatching";

/**
 * Parses structured optimized text into sections
 */
function parseOptimizedText(text: string): { [key: string]: string } {
  const sections: { [key: string]: string } = {};
  let currentSection = '';
  let currentContent: string[] = [];
  
  // Add tracking for column type
  let inLeftColumn = false;
  let inRightColumn = false;
  let leftColumnContent: { [key: string]: string } = {};
  let rightColumnContent: { [key: string]: string } = {};
  
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for column markers
    if (line.includes('[LEFT-COLUMN-START]')) {
      inLeftColumn = true;
      inRightColumn = false;
      continue;
    }
    
    if (line.includes('[LEFT-COLUMN-END]')) {
      inLeftColumn = false;
      continue;
    }
    
    if (line.includes('[RIGHT-COLUMN-START]')) {
      inRightColumn = true;
      inLeftColumn = false;
      continue;
    }
    
    if (line.includes('[RIGHT-COLUMN-END]')) {
      inRightColumn = false;
      continue;
    }
    
    // Check for section headers (either ## or [HEADER])
    if (line.startsWith('## ') || line.startsWith('[HEADER]')) {
      // Save previous section if it exists
      if (currentSection && currentContent.length > 0) {
        if (inLeftColumn) {
          leftColumnContent[currentSection] = currentContent.join('\n');
        } else if (inRightColumn) {
          rightColumnContent[currentSection] = currentContent.join('\n');
        } else {
          sections[currentSection] = currentContent.join('\n');
        }
      }
      
      // Start new section
      currentSection = line.replace('## ', '').replace('[HEADER]', '').trim();
      currentContent = [];
    } else if (line.length > 0) {
      // Process subheaders, bullets, etc.
      let processedLine = line
        .replace('### ', '')
        .replace('[SUBHEADER]', '')
        .replace('[BULLET]', '• ')
        .trim();
        
      currentContent.push(processedLine);
    }
  }
  
  // Save the last section
  if (currentSection && currentContent.length > 0) {
    if (inLeftColumn) {
      leftColumnContent[currentSection] = currentContent.join('\n');
    } else if (inRightColumn) {
      rightColumnContent[currentSection] = currentContent.join('\n');
    } else {
      sections[currentSection] = currentContent.join('\n');
    }
  }
  
  // Merge column content with main sections
  // Left column sections are prefixed with "LEFT:" for proper identification
  for (const [key, value] of Object.entries(leftColumnContent)) {
    sections['LEFT:' + key] = value;
  }
  
  // Right column sections are added normally
  for (const [key, value] of Object.entries(rightColumnContent)) {
    sections[key] = value;
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
    const sidebarWidth = 180; // Width of the left sidebar
    const fontSize = 10;
    const headerFontSize = 14;
    const subheaderFontSize = 12;
    const nameSize = 24; // Larger size for the name
    const lineHeight = fontSize * 1.4; // Increased for better readability
    const maxWidth = width - margin * 2;
    const mainColumnWidth = width - margin - sidebarWidth - margin; // Width of main content area
    
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
    
    // Create a left sidebar on each page
    page.drawRectangle({
      x: 0,
      y: 0,
      width: sidebarWidth,
      height: height,
      color: rgb(245/255, 245/255, 245/255), // Light gray for sidebar
    });
    
    // Add a circular logo/initials at top of sidebar
    const logoRadius = 40;
    const logoX = sidebarWidth / 2;
    const logoY = height - 100;
    
    // Draw circle for logo
    page.drawCircle({
      x: logoX,
      y: logoY,
      size: logoRadius,
      color: primaryColor,
    });
    
    // Extract initials from name
    let initials = "M.O."; // Default initials
    if (rawText) {
      const name = sanitizeText(rawText.split('\n')[0]);
      if (name) {
        const nameParts = name.split(' ');
        if (nameParts.length >= 2) {
          initials = `${nameParts[0][0]}.${nameParts[1][0]}.`;
        }
      }
    }
    
    // Draw initials in circle
    page.drawText(initials, {
      x: logoX - (initials.length * 7 / 2), // Center approximately
      y: logoY - 6, // Slight adjustment to center vertically
      size: 16,
      font: timesBold,
      color: secondaryColor,
    });
    
    // Extract name from the first line of rawText
    let candidateName = '';
    if (rawText) {
      candidateName = sanitizeText(rawText.split('\n')[0]);
      
      // Draw name below the logo
      page.drawText(candidateName, {
        x: margin / 2,
        y: logoY - 60,
        size: 14,
        font: timesBold,
        color: textColor,
        maxWidth: sidebarWidth - margin,
      });
    }
    
    // Current position in sidebar for contact info
    let sidebarY = logoY - 90;
    
    // Extract contact information (email, phone, etc.)
    if (rawText) {
      const contactLines = rawText.split('\n').slice(1, 5);
      
      // Headers for sidebar sections
      page.drawText('CONTACT', {
        x: margin / 2,
        y: sidebarY,
        size: subheaderFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      sidebarY -= lineHeight * 1.5;
      
      // Draw contact info in sidebar
      for (const line of contactLines) {
        if (line.includes('@') || line.includes('http') || line.includes('+') || line.includes('Phone')) {
          const cleanLine = sanitizeText(line);
          const wrappedLines = wrapText(cleanLine, helveticaFont, fontSize, sidebarWidth - margin);
          
          for (const wrappedLine of wrappedLines) {
            page.drawText(wrappedLine, {
              x: margin / 2,
              y: sidebarY,
              size: fontSize,
              font: helveticaFont,
              color: textColor,
            });
            sidebarY -= lineHeight;
          }
          sidebarY -= lineHeight * 0.5;
        }
      }
    }
    
    // Add education section to sidebar if it exists
    if (optimizedSections['EDUCATION'] || optimizedSections['Education']) {
      const educationContent = optimizedSections['EDUCATION'] || optimizedSections['Education'];
      
      // Add some space before education section
      sidebarY -= lineHeight;
      
      // Draw education header
      page.drawText('EDUCATION', {
        x: margin / 2,
        y: sidebarY,
        size: subheaderFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      sidebarY -= lineHeight * 1.5;
      
      // Process education content
      if (educationContent) {
        const educationLines = educationContent.split('\n');
        
        for (const line of educationLines) {
          if (line.trim()) {
            const cleanLine = sanitizeText(line);
            const wrappedLines = wrapText(cleanLine, helveticaFont, fontSize, sidebarWidth - margin);
            
            for (const wrappedLine of wrappedLines) {
              page.drawText(wrappedLine, {
                x: margin / 2,
                y: sidebarY,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              sidebarY -= lineHeight;
            }
          }
        }
      }
    }
    
    // Add languages section to sidebar if it exists
    if (optimizedSections['LANGUAGES'] || optimizedSections['Languages']) {
      const languagesContent = optimizedSections['LANGUAGES'] || optimizedSections['Languages'];
      
      // Add some space before languages section
      sidebarY -= lineHeight;
      
      // Draw languages header
      page.drawText('LANGUAGES', {
        x: margin / 2,
        y: sidebarY,
        size: subheaderFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      sidebarY -= lineHeight * 1.5;
      
      // Process languages content
      if (languagesContent) {
        const languageLines = languagesContent.split('\n');
        
        for (const line of languageLines) {
          if (line.trim()) {
            const cleanLine = sanitizeText(line);
            const wrappedLines = wrapText(cleanLine, helveticaFont, fontSize, sidebarWidth - margin);
            
            for (const wrappedLine of wrappedLines) {
              page.drawText(wrappedLine, {
                x: margin / 2,
                y: sidebarY,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              sidebarY -= lineHeight;
            }
          }
        }
      }
    }
    
    // Start content in main column
    let mainColumnX = sidebarWidth + margin / 2;
    let currentY = height - margin * 1.5;
    
    // Collect left column and right column sections
    const leftColumnSections: Record<string, string> = {};
    const rightColumnSections: Record<string, string> = {};
    
    // Sort sections into left and right columns
    for (const [key, value] of Object.entries(optimizedSections)) {
      if (key.startsWith('LEFT:')) {
        // Add to left column without the prefix
        leftColumnSections[key.substring(5)] = value;
      } else {
        // Add to right column
        rightColumnSections[key] = value;
      }
    }
    
    // Process left column content that wasn't already handled (sidebar content)
    // We've already processed EDUCATION and LANGUAGES in the sidebar, so check for others
    for (const [sectionName, sectionContent] of Object.entries(leftColumnSections)) {
      // Skip sections we've already handled
      if (['EDUCATION', 'Languages', 'LANGUAGES', 'Education'].includes(sectionName)) {
        continue;
      }
      
      // Add some space
      sidebarY -= lineHeight;
      
      // Draw section header
      page.drawText(sectionName.toUpperCase(), {
        x: margin / 2,
        y: sidebarY,
        size: subheaderFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      sidebarY -= lineHeight * 1.5;
      
      // Process section content
      if (sectionContent) {
        const contentLines = sectionContent.split('\n');
        
        for (const line of contentLines) {
          if (line.trim()) {
            // Handle bullet points
            let cleanLine = sanitizeText(line);
            let xOffset = margin / 2;
            
            if (line.includes('• ') || line.startsWith('•')) {
              // This is a bullet point, add proper indentation
              cleanLine = cleanLine.replace('• ', '').replace('•', '');
              
              // Draw bullet point
              page.drawCircle({
                x: margin / 2 + 3,
                y: sidebarY + 3,
                size: 1.5,
                color: accentColor,
              });
              
              xOffset = margin / 2 + 10; // Indented text after bullet
            }
            
            const wrappedLines = wrapText(cleanLine, helveticaFont, fontSize, sidebarWidth - margin);
            
            for (const wrappedLine of wrappedLines) {
              // Check if we need a new page for sidebar
              if (sidebarY < margin) {
                page = newPdfDoc.addPage([width, height]);
                
                // Create sidebar on new page
                page.drawRectangle({
                  x: 0,
                  y: 0,
                  width: sidebarWidth,
                  height: height,
                  color: rgb(245/255, 245/255, 245/255), // Light gray
                });
                
                sidebarY = height - margin * 1.5;
              }
              
              page.drawText(wrappedLine, {
                x: xOffset,
                y: sidebarY,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              
              sidebarY -= lineHeight;
            }
          }
        }
      }
    }
    
    // Function to process a section for the main column
    const processMainColumnSection = (sectionName: string, sectionContent: string) => {
      if (!sectionContent) return;
      
      // Check if we need a new page
      if (currentY < margin + 50) {
        page = newPdfDoc.addPage([width, height]);
        
        // Add sidebar to new page
        page.drawRectangle({
          x: 0,
          y: 0,
          width: sidebarWidth,
          height: height,
          color: rgb(245/255, 245/255, 245/255), // Light gray
        });
        
        // Reset Y position for new page
        currentY = height - margin * 1.5;
      }
      
      // Draw section header
      page.drawText(sectionName.toUpperCase(), {
        x: mainColumnX,
        y: currentY,
        size: headerFontSize,
        font: timesBold,
        color: primaryColor,
      });
      
      // Add underline
      page.drawLine({
        start: { x: mainColumnX, y: currentY - 5 },
        end: { x: width - margin, y: currentY - 5 },
        thickness: 1,
        color: accentColor,
      });
      
      currentY -= lineHeight * 2;
      
      // Process section content
      const paragraphs = sectionContent.split('\n\n').map(p => sanitizeText(p)).filter(Boolean);
      
      for (const paragraph of paragraphs) {
        // Handle bullet points
        if (paragraph.includes('• ') || paragraph.includes('- ')) {
          const bulletPoints = paragraph
            .split(/(?:^|\s)(?:•|-)\s+/)
            .filter(Boolean)
            .map(point => sanitizeText(point));
          
          for (const point of bulletPoints) {
            // Check for new page
            if (currentY < margin + 20) {
              page = newPdfDoc.addPage([width, height]);
              
              // Add sidebar to new page
              page.drawRectangle({
                x: 0,
                y: 0,
                width: sidebarWidth,
                height: height,
                color: rgb(245/255, 245/255, 245/255), // Light gray
              });
              
              currentY = height - margin * 1.5;
            }
            
            // Draw bullet point
            page.drawCircle({
              x: mainColumnX + 4,
              y: currentY + 3,
              size: 2,
              color: accentColor,
            });
            
            // Draw bullet text
            const lines = wrapText(point, helveticaFont, fontSize, mainColumnWidth - 15);
            
            for (const line of lines) {
              page.drawText(sanitizeText(line), {
                x: mainColumnX + 15,
                y: currentY,
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
              
              currentY -= lineHeight;
            }
          }
        } else {
          // Regular paragraph
          // Check if it looks like a subheader
          const isSubheader = paragraph === paragraph.toUpperCase() || paragraph.endsWith(':');
          
          if (isSubheader) {
            // Draw as subheader
            page.drawText(sanitizeText(paragraph), {
              x: mainColumnX,
              y: currentY,
              size: subheaderFontSize,
              font: helveticaBold,
              color: accentColor,
            });
            
            currentY -= lineHeight * 1.5;
          } else {
            // Draw as normal paragraph
            const lines = wrapText(paragraph, helveticaFont, fontSize, mainColumnWidth);
            
            for (const line of lines) {
              if (currentY < margin) {
                page = newPdfDoc.addPage([width, height]);
                
                // Add sidebar to new page
                page.drawRectangle({
                  x: 0,
                  y: 0,
                  width: sidebarWidth,
                  height: height,
                  color: rgb(245/255, 245/255, 245/255), // Light gray
                });
                
                currentY = height - margin * 1.5;
              }
              
              page.drawText(sanitizeText(line), {
                x: mainColumnX,
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
      }
      
      // Add space after section
      currentY -= lineHeight * 1.5;
    };
    
    // Process main content sections in proper order
    // First, process Profile/Summary if it exists
    if (rightColumnSections['PROFILE'] || rightColumnSections['PROFESSIONAL SUMMARY']) {
      const profileContent = rightColumnSections['PROFILE'] || rightColumnSections['PROFESSIONAL SUMMARY'];
      processMainColumnSection('PROFILE', profileContent);
    }
    
    // Then Professional Experience
    if (rightColumnSections['EXPERIENCE'] || rightColumnSections['PROFESSIONAL EXPERIENCE']) {
      const experienceContent = rightColumnSections['EXPERIENCE'] || rightColumnSections['PROFESSIONAL EXPERIENCE'];
      processMainColumnSection('PROFESSIONAL EXPERIENCE', experienceContent);
    }
    
    // Process Skills section
    if (rightColumnSections['SKILLS'] || rightColumnSections['TECHNICAL SKILLS']) {
      const skillsContent = rightColumnSections['SKILLS'] || rightColumnSections['TECHNICAL SKILLS'];
      processMainColumnSection('SKILLS', skillsContent);
    }
    
    // Process other sections in the right column
    for (const [sectionName, sectionContent] of Object.entries(rightColumnSections)) {
      // Skip sections we've already processed
      if (['PROFILE', 'PROFESSIONAL SUMMARY', 'EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 
           'SKILLS', 'TECHNICAL SKILLS'].includes(sectionName.toUpperCase())) {
        continue;
      }
      
      processMainColumnSection(sectionName, sectionContent);
    }
    
    // Add a professional footer to each page
    const pageCount = newPdfDoc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const page = newPdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Draw footer line
      page.drawLine({
        start: { x: sidebarWidth + margin / 2, y: 30 },
        end: { x: width - margin, y: 30 },
        thickness: 0.5,
        color: accentColor,
      });
      
      // Add page number and date
      const currentDate = new Date().toLocaleDateString();
      page.drawText(`Page ${i + 1} of ${pageCount} | Updated: ${currentDate}`, {
        x: sidebarWidth + margin / 2,
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
