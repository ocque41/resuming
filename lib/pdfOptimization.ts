import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { getOverlayCoordinates } from "./templateMatching";
import { CVTemplate } from "@/types/templates";
import { Buffer } from "buffer";
import { getTemplateLayout } from './templateMatching';

// Add Section interface at the top of the file
export interface Section {
  title: string;
  content: string;
}

/**
 * Parses structured optimized text into sections
 */
export function parseOptimizedText(text: string): { leftColumnSections: Section[]; rightColumnSections: Section[] } {
  // Remove any placeholder markers
  text = text.replace(/\[LEFT COLUMN END\]/g, '')
    .replace(/\[RIGHT COLUMN START\]/g, '')
    .replace(/CONTENT/g, '')
    .replace(/\*No previous work experience provided on the original CV\*/g, '')
    .replace(/\*No education information provided on the original CV\*/g, '')
    .replace(/\*No skills information provided on the original CV\*/g, '')
    .replace(/\*No projects information provided on the original CV\*/g, '')
    .replace(/\*No.*?provided.*?\*/g, ''); // Remove any other "No X provided" messages
  
  const sections: Section[] = [];
  const lines = text.split('\n');
  
  let currentSection: Section | null = null;
  let currentContent = '';
  
  // Parse text into sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this is a section header (all caps or surrounded by ## or uppercase)
    if (
      (line === line.toUpperCase() && line.length > 2 && !/[a-z]/.test(line)) ||
      (line.startsWith('##') && line.endsWith('##')) ||
      (line.startsWith('# '))
    ) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = currentContent.trim();
        sections.push(currentSection);
      }
      
      // Create new section
      let title = line;
      if (title.startsWith('##')) title = title.substring(2, title.length - 2);
      if (title.startsWith('# ')) title = title.substring(2);
      
      currentSection = {
        title,
        content: '',
      };
      currentContent = '';
    } else if (currentSection) {
      // Add line to current section content
      currentContent += line + '\n';
    }
  }
  
  // Add the last section
  if (currentSection) {
    currentSection.content = currentContent.trim();
    sections.push(currentSection);
  }
  
  // Distribute sections between columns
  const leftColumnSections: Section[] = [];
  const rightColumnSections: Section[] = [];
  
  // Determine which sections go to which column
  // Education, Skills, Languages, Certifications typically go to left column
  // Work Experience, Projects, Summary typically go to right column
  for (const section of sections) {
    const title = section.title.toLowerCase();
    
    // Skip empty sections
    if (!section.content.trim()) {
      continue;
    }
    
    if (
      title.includes('education') ||
      title.includes('skill') ||
      title.includes('language') ||
      title.includes('certification') ||
      title.includes('reference') ||
      title.includes('contact')
    ) {
      leftColumnSections.push(section);
    } else {
      rightColumnSections.push(section);
    }
  }
  
  // Log sections for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log("Left column sections:", leftColumnSections.map(s => s.title).join(", "));
    console.log("Right column sections:", rightColumnSections.map(s => s.title).join(", "));
  }
  
  // Ensure content fits on a single page by trimming if necessary
  ensureSinglePage(leftColumnSections, rightColumnSections);
  
  return { leftColumnSections, rightColumnSections };
}

// Function to ensure content fits on a single page
function ensureSinglePage(leftColumnSections: Section[], rightColumnSections: Section[]): void {
  // Estimate the total content length
  const estimateContentLength = (sections: Section[]): number => {
    let length = 0;
    for (const section of sections) {
      // Add space for section title
      length += 30;
      
      // Count lines in content
      const lines = section.content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Estimate how many lines this will take when wrapped
        const estimatedWrappedLines = Math.ceil(line.length / 50);
        length += estimatedWrappedLines * 10;
        
        // Add extra space for bullet points
        if (line.trim().startsWith('•')) {
          length += 5;
        }
      }
      
      // Add space between sections
      length += 15;
    }
    return length;
  };
  
  const leftColumnLength = estimateContentLength(leftColumnSections);
  const rightColumnLength = estimateContentLength(rightColumnSections);
  
  // A4 page height is about 842 points, with margins around 50 points
  // and header taking about 60-80 points
  const maxColumnHeight = 650;
  
  // If either column is too long, trim content
  if (leftColumnLength > maxColumnHeight || rightColumnLength > maxColumnHeight) {
    console.warn("Content may not fit on a single page, trimming...");
    
    // Trim bullet points from the bottom of longer sections
    const trimSection = (section: Section): boolean => {
      const lines = section.content.split('\n');
      // Find bullet points from the bottom
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('•')) {
          // Remove this bullet point
          lines.splice(i, 1);
          section.content = lines.join('\n');
          return true;
        }
      }
      return false;
    };
    
    // First try to trim bullet points from the longest sections
    let trimmed = false;
    
    // Sort sections by content length (descending)
    const sortSectionsByLength = (sections: Section[]): Section[] => {
      return [...sections].sort((a, b) => b.content.length - a.content.length);
    };
    
    // Try to trim left column if it's too long
    if (leftColumnLength > maxColumnHeight) {
      const sortedSections = sortSectionsByLength(leftColumnSections);
      for (const section of sortedSections) {
        trimmed = trimSection(section);
        if (trimmed) break;
      }
    }
    
    // Try to trim right column if it's too long
    if (rightColumnLength > maxColumnHeight) {
      const sortedSections = sortSectionsByLength(rightColumnSections);
      for (const section of sortedSections) {
        trimmed = trimSection(section);
        if (trimmed) break;
      }
    }
    
    // If we couldn't trim bullet points, try to reduce content in other ways
    if (!trimmed) {
      // Reduce the number of bullet points in the longest sections
      for (const section of sortSectionsByLength(rightColumnSections)) {
        const lines = section.content.split('\n');
        let bulletCount = 0;
        
        // Count bullet points
        for (const line of lines) {
          if (line.trim().startsWith('•')) bulletCount++;
        }
        
        // If there are more than 5 bullet points, keep only the first 5
        if (bulletCount > 5) {
          const newLines = [];
          let bulletsSeen = 0;
          
          for (const line of lines) {
            if (line.trim().startsWith('•')) {
              bulletsSeen++;
              if (bulletsSeen <= 5) {
                newLines.push(line);
              }
            } else {
              newLines.push(line);
            }
          }
          
          section.content = newLines.join('\n');
          break;
        }
      }
    }
  }
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

// Helper function to wrap text to fit within a given width
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
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

// Helper function to split text into lines that fit within a given width
function splitTextIntoLines(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Creates a new PDF with optimized content
 */
export async function modifyPDFWithOptimizedContent(
  optimizedText: string,
  rawText: string,
  template?: CVTemplate
): Promise<Uint8Array> {
  try {
    console.log("Starting PDF generation with optimized content");
    
    // Create a new PDF document
    const doc = await PDFDocument.create();
    
    // Add a page to the document
    const page = doc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    // Set default margin
    const defaultMargin = 50;
    let margin = defaultMargin;
    
    // Parse the optimized text into sections
    const { leftColumnSections, rightColumnSections } = parseOptimizedText(optimizedText);
    
    // Get template layout if available
    let layout = 'two-column';
    let headerStyle = 'modern';
    let fontFamily = 'Helvetica';
    let primaryColor = rgb(0, 0, 0); // Default black for text
    let accentColor = rgb(0.2, 0.4, 0.8); // Default blue for accents only
    let backgroundColor = rgb(1, 1, 1); // Default white
    let columnGap = 20;
    
    if (template) {
      console.log(`Applying template: ${template.name}`);
      
      // Get layout from template metadata
      layout = template.metadata.layout || layout;
      
      // Get template-specific layout from templateMatching
      const templateLayout = getTemplateLayout(template.id);
      headerStyle = templateLayout.headerStyle || headerStyle;
      
      // Set colors based on template metadata
      if (template.metadata.colorScheme) {
        const colorScheme = template.metadata.colorScheme;
        
        // Only use accent color for headers and decorative elements
        if (colorScheme.accent) {
          // Convert hex to RGB
          const r = parseInt(colorScheme.accent.substring(1, 3), 16) / 255;
          const g = parseInt(colorScheme.accent.substring(3, 5), 16) / 255;
          const b = parseInt(colorScheme.accent.substring(5, 7), 16) / 255;
          accentColor = rgb(r, g, b);
        }
        
        if (colorScheme.background) {
          // Convert hex to RGB
          const r = parseInt(colorScheme.background.substring(1, 3), 16) / 255;
          const g = parseInt(colorScheme.background.substring(3, 5), 16) / 255;
          const b = parseInt(colorScheme.background.substring(5, 7), 16) / 255;
          backgroundColor = rgb(r, g, b);
        }
      }
      
      // Apply template-specific styling
      if (template.name === 'Apple Minimal' || template.id === 'apple-minimal') {
        // Minimal template has more whitespace and lighter colors
        margin = 45; // Reduced from 60 to fit on one page
        columnGap = 20; // Reduced from 30 to fit on one page
        accentColor = rgb(0.5, 0.5, 0.5); // Gray accent
      } else if (template.name === 'Google Modern' || template.id === 'google-modern') {
        // Modern template has bold colors and less margin
        margin = 35; // Reduced from 40 to fit on one page
        columnGap = 20; // Reduced from 25 to fit on one page
      } else if (template.name === 'Amazon Leadership' || template.id === 'amazon-leadership') {
        // Traditional template has serif fonts and classic colors
        fontFamily = 'Times-Roman';
        accentColor = rgb(0.5, 0.1, 0.1); // Dark red accent
        margin = 40; // Adjusted to fit on one page
      } else if (template.name === 'Meta Impact' || template.id === 'meta-impact') {
        // Creative template has unique colors and layout
        accentColor = rgb(0.8, 0.3, 0.3); // Reddish accent
        backgroundColor = rgb(0.98, 0.98, 1); // Very light blue background
        margin = 40; // Adjusted to fit on one page
        
        // Add a decorative element for creative template
        page.drawRectangle({
          x: 0,
          y: height - 80, // Reduced from 100 to fit on one page
          width: width,
          height: 80, // Reduced from 100 to fit on one page
          color: rgb(0.95, 0.95, 1),
        });
        
        // Add a decorative line
        page.drawLine({
          start: { x: 0, y: height - 80 }, // Adjusted to match the rectangle
          end: { x: width, y: height - 80 }, // Adjusted to match the rectangle
          thickness: 3,
          color: accentColor,
        });
      } else if (template.name === 'Microsoft Professional' || template.id === 'microsoft-professional') {
        // Professional template has clean lines and professional colors
        accentColor = rgb(0.4, 0.6, 0.8); // Medium blue
        margin = 40; // Adjusted to fit on one page
        
        // Add a thin header bar
        page.drawRectangle({
          x: 0,
          y: height - 25, // Reduced from 30 to fit on one page
          width: width,
          height: 25, // Reduced from 30 to fit on one page
          color: rgb(0.05, 0.2, 0.4),
        });
      }
    }
    
    // Set text color to black for all content
    const textColor = rgb(0, 0, 0);
    
    // Load fonts
    let regularFont;
    let boldFont;
    let titleFont;
    
    // Select fonts based on template
    if (fontFamily === 'Times-Roman') {
      regularFont = await doc.embedFont(StandardFonts.TimesRoman);
      boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
      titleFont = await doc.embedFont(StandardFonts.TimesRomanBold);
    } else if (fontFamily === 'Courier') {
      regularFont = await doc.embedFont(StandardFonts.Courier);
      boldFont = await doc.embedFont(StandardFonts.CourierBold);
      titleFont = await doc.embedFont(StandardFonts.CourierBold);
    } else {
      // Default to Helvetica
      regularFont = await doc.embedFont(StandardFonts.Helvetica);
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
    }
    
    // Fill background if not white
    const isWhiteBackground = 
      backgroundColor.toString() === rgb(1, 1, 1).toString();
 
    if (!isWhiteBackground) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: backgroundColor,
      });
    }
    
    // Set starting positions for columns
    let leftColumnY = height - margin;
    let rightColumnY = height - margin;
    const rightColumnX = margin + (width - 2 * margin) * 0.3 + columnGap;
    
    // Reference to current page for multi-page support
    let currentPage = page;
    
    // Add header based on template style
    if (headerStyle === 'modern') {
      try {
        // Extract name and contact info from the first few lines
        const lines = rawText.split('\n').slice(0, 5);
        let name = lines[0]?.trim() || 'Name';
        let contactInfo = '';
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]?.trim();
          if (line && (line.includes('@') || line.includes('phone') || line.includes('linkedin'))) {
            contactInfo += line + ' · ';
          }
        }
        
        if (contactInfo.endsWith(' · ')) {
          contactInfo = contactInfo.substring(0, contactInfo.length - 3);
        }
        
        // Draw a colored rectangle at the top
        currentPage.drawRectangle({
          x: margin,
          y: height - margin - 25, // Reduced from 30 to fit on one page
          width: width - 2 * margin,
          height: 25, // Reduced from 30 to fit on one page
          color: accentColor,
        });
        
        // Draw name in large font
        if (name) {
          currentPage.drawText(name.toUpperCase(), {
            x: margin + 10,
            y: height - margin - 18, // Adjusted for smaller header
            size: 16, // Reduced from 18 to fit on one page
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
          
          // Draw contact info below
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: margin,
              y: height - margin - 35, // Adjusted for smaller header
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor,
            });
          }
          
          // Adjust starting positions
          leftColumnY = height - margin - 60; // Reduced from 70 to fit on one page
          rightColumnY = height - margin - 60; // Reduced from 70 to fit on one page
        }
      } catch (error: any) {
        console.warn("Error adding modern header:", error.message);
      }
    } else if (headerStyle === 'minimal') {
      try {
        // Extract name and contact info from the first few lines
        const lines = rawText.split('\n').slice(0, 5);
        let name = lines[0]?.trim() || 'Name';
        let contactInfo = '';
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]?.trim();
          if (line && (line.includes('@') || line.includes('phone') || line.includes('linkedin'))) {
            contactInfo += line + ' · ';
          }
        }
        
        if (contactInfo.endsWith(' · ')) {
          contactInfo = contactInfo.substring(0, contactInfo.length - 3);
        }
        
        // Draw a thin line at the top
        currentPage.drawLine({
          start: { x: margin, y: height - margin + 8 }, // Reduced from 10 to fit on one page
          end: { x: width - margin, y: height - margin + 8 }, // Reduced from 10 to fit on one page
          thickness: 1,
          color: accentColor,
        });
        
        // Draw name in large font
        if (name) {
          currentPage.drawText(name, {
            x: margin,
            y: height - margin,
            size: 16, // Reduced from 18 to fit on one page
            font: titleFont,
            color: textColor,
          });
          
          // Draw contact info to the right
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: width - margin - regularFont.widthOfTextAtSize(contactInfo, 8), // Reduced from 9 to fit on one page
              y: height - margin,
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor,
            });
          }
          
          // Draw a thin line below
          currentPage.drawLine({
            start: { x: margin, y: height - margin - 8 }, // Reduced from 10 to fit on one page
            end: { x: width - margin, y: height - margin - 8 }, // Reduced from 10 to fit on one page
            thickness: 1,
            color: accentColor,
          });
          
          // Adjust starting positions
          leftColumnY = height - margin - 25; // Reduced from 30 to fit on one page
          rightColumnY = height - margin - 25; // Reduced from 30 to fit on one page
        }
      } catch (error: any) {
        console.warn("Error adding minimal header:", error.message);
      }
    } else if (headerStyle === 'traditional') {
      try {
        // Extract name and contact info from the first few lines
        const lines = rawText.split('\n').slice(0, 5);
        let name = lines[0]?.trim() || 'Name';
        let contactInfo = '';
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]?.trim();
          if (line && (line.includes('@') || line.includes('phone') || line.includes('linkedin'))) {
            contactInfo += line + ' | ';
          }
        }
        
        if (contactInfo.endsWith(' | ')) {
          contactInfo = contactInfo.substring(0, contactInfo.length - 3);
        }
        
        // Center-align the name
        const nameWidth = titleFont.widthOfTextAtSize(name, 18); // Reduced from 20 to fit on one page
        const nameX = (width - nameWidth) / 2;
        
        // Draw name in large font, centered
        if (name) {
          currentPage.drawText(name, {
            x: nameX,
            y: height - margin,
            size: 18, // Reduced from 20 to fit on one page
            font: titleFont,
            color: textColor,
          });
          
          // Center-align contact info
          const contactWidth = regularFont.widthOfTextAtSize(contactInfo, 9); // Reduced from 10 to fit on one page
          const contactX = (width - contactWidth) / 2;
          const contactY = height - margin - 22; // Reduced from 25 to fit on one page
          
          // Draw contact info centered below name
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: contactX,
              y: contactY,
              size: 9, // Reduced from 10 to fit on one page
              font: regularFont,
              color: textColor,
            });
          }
          
          // Draw a decorative line below
          currentPage.drawLine({
            start: { x: margin, y: contactY - 12 }, // Reduced from 15 to fit on one page
            end: { x: width - margin, y: contactY - 12 }, // Reduced from 15 to fit on one page
            thickness: 1,
            color: accentColor,
          });
          
          // Adjust starting positions
          leftColumnY = contactY - 22; // Reduced from 25 to fit on one page
          rightColumnY = contactY - 22; // Reduced from 25 to fit on one page
        }
      } catch (error: any) {
        console.warn("Error adding traditional header:", error.message);
      }
    }
    
    // Calculate column widths based on layout
    let leftColumnWidth = (width - 2 * margin - columnGap) * 0.3; // Default: 30% of available width
    let rightColumnWidth = (width - 2 * margin - columnGap) * 0.7; // Default: 70% of available width
    
    // Adjust column widths based on layout
    if (layout === "one-column") {
      leftColumnWidth = 0;
      rightColumnWidth = width - 2 * margin;
      
      // For one-column layout, move left column sections to right column
      const combinedSections = [...leftColumnSections, ...rightColumnSections];
      // Clear the original arrays
      while (leftColumnSections.length) leftColumnSections.pop();
      while (rightColumnSections.length) rightColumnSections.pop();
      // Add all sections to right column
      combinedSections.forEach(section => rightColumnSections.push(section));
    } else if (layout === "traditional") {
      // More balanced columns for traditional layout
      leftColumnWidth = (width - 2 * margin - columnGap) * 0.4;
      rightColumnWidth = (width - 2 * margin - columnGap) * 0.6;
    }
    
    // Draw left column sections
    for (const section of leftColumnSections) {
      // Draw section header
      currentPage.drawText(section.title.toUpperCase(), {
        x: margin,
        y: leftColumnY,
        size: 11, // Reduced from 12 to fit on one page
        font: boldFont,
        color: accentColor, // Only headers use accent color
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 4 }, // Reduced from 5 to fit on one page
          end: { x: margin + leftColumnWidth, y: leftColumnY - 4 }, // Reduced from 5 to fit on one page
          thickness: 1,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 4 }, // Reduced from 5 to fit on one page
          end: { x: margin + 40, y: leftColumnY - 4 }, // Reduced from 50 to fit on one page
          thickness: 2,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // For minimal style, use a dot instead of a line
        currentPage.drawCircle({
          x: margin - 5,
          y: leftColumnY - 2,
          size: 3,
          color: accentColor,
        });
      }
      
      leftColumnY -= 20; // Reduced from 25 to fit on one page
      
      // Draw section content
      const contentLines = section.content.split('\n');
      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i].trim();
        if (!line) continue;
        
        // Check if this is a bullet point
        if (line.startsWith('•')) {
          // Draw bullet point with accent color
          currentPage.drawText('•', {
            x: margin,
            y: leftColumnY,
            size: 9, // Reduced from 10 to fit on one page
            font: regularFont,
            color: accentColor, // Bullet points use accent color
          });
          
          // Draw the text after the bullet point
          const textAfterBullet = line.substring(1).trim();
          
          // Handle text wrapping for bullet points
          const wrappedLines = wrapText(textAfterBullet, regularFont, 8, leftColumnWidth - 10); // Reduced from 9 to fit on one page
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: margin + 10, // Indent text after bullet point
              y: leftColumnY - (j * 10), // Reduced from 12 to fit on one page
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor, // Regular text is black
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              leftColumnY -= (j * 10) + 14; // Reduced from 18 to fit on one page
            }
          }
        } 
        // Check if this is a subheader (bold text)
        else if (line.startsWith('**') && line.endsWith('**')) {
          const subheader = line.substring(2, line.length - 2);
          currentPage.drawText(subheader, {
            x: margin,
            y: leftColumnY,
            size: 9, // Reduced from 10 to fit on one page
            font: boldFont,
            color: textColor, // Regular text is black
          });
          leftColumnY -= 12; // Reduced from 15 to fit on one page
        } 
        // Regular text
        else {
          // Handle text wrapping for regular text
          const wrappedLines = wrapText(line, regularFont, 8, leftColumnWidth); // Reduced from 9 to fit on one page
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: margin,
              y: leftColumnY - (j * 10), // Reduced from 12 to fit on one page
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor, // Regular text is black
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              leftColumnY -= (j * 10) + 14; // Reduced from 18 to fit on one page
            }
          }
        }
      }
      
      leftColumnY -= 12; // Reduced from 15 to fit on one page
      
      // Check if we need to add a new page - but we're trying to keep it to one page
      if (leftColumnY < margin) {
        console.warn("Content exceeds one page - adjusting font sizes to fit");
        // Instead of adding a new page, we'll just stop here
        break;
      }
    }
    
    // Draw right column sections
    for (const section of rightColumnSections) {
      // Draw section header
      currentPage.drawText(section.title.toUpperCase(), {
        x: rightColumnX,
        y: rightColumnY,
        size: 11, // Reduced from 12 to fit on one page
        font: boldFont,
        color: accentColor, // Only headers use accent color
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 4 }, // Reduced from 5 to fit on one page
          end: { x: rightColumnX + rightColumnWidth, y: rightColumnY - 4 }, // Reduced from 5 to fit on one page
          thickness: 1,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 4 }, // Reduced from 5 to fit on one page
          end: { x: rightColumnX + 40, y: rightColumnY - 4 }, // Reduced from 50 to fit on one page
          thickness: 2,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // For minimal style, use a dot instead of a line
        currentPage.drawCircle({
          x: rightColumnX - 5,
          y: rightColumnY - 2,
          size: 3,
          color: accentColor,
        });
      }
      
      rightColumnY -= 20; // Reduced from 25 to fit on one page
      
      // Draw section content
      const contentLines = section.content.split('\n');
      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i].trim();
        if (!line) continue;
        
        // Check if this is a bullet point
        if (line.startsWith('•')) {
          // Draw bullet point with accent color
          currentPage.drawText('•', {
            x: rightColumnX,
            y: rightColumnY,
            size: 9, // Reduced from 10 to fit on one page
            font: regularFont,
            color: accentColor, // Bullet points use accent color
          });
          
          // Draw the text after the bullet point
          const textAfterBullet = line.substring(1).trim();
          
          // Handle text wrapping for bullet points
          const wrappedLines = wrapText(textAfterBullet, regularFont, 8, rightColumnWidth - 10); // Reduced from 9 to fit on one page
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: rightColumnX + 10, // Indent text after bullet point
              y: rightColumnY - (j * 10), // Reduced from 12 to fit on one page
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor, // Regular text is black
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              rightColumnY -= (j * 10) + 14; // Reduced from 18 to fit on one page
            }
          }
        } 
        // Check if this is a subheader (bold text)
        else if (line.startsWith('**') && line.endsWith('**')) {
          const subheader = line.substring(2, line.length - 2);
          currentPage.drawText(subheader, {
            x: rightColumnX,
            y: rightColumnY,
            size: 9, // Reduced from 10 to fit on one page
            font: boldFont,
            color: textColor, // Regular text is black
          });
          rightColumnY -= 12; // Reduced from 15 to fit on one page
        } 
        // Regular text
        else {
          // Handle text wrapping for regular text
          const wrappedLines = wrapText(line, regularFont, 8, rightColumnWidth); // Reduced from 9 to fit on one page
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: rightColumnX,
              y: rightColumnY - (j * 10), // Reduced from 12 to fit on one page
              size: 8, // Reduced from 9 to fit on one page
              font: regularFont,
              color: textColor, // Regular text is black
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              rightColumnY -= (j * 10) + 14; // Reduced from 18 to fit on one page
            }
          }
        }
      }
      
      rightColumnY -= 12; // Reduced from 15 to fit on one page
      
      // Check if we need to add a new page - but we're trying to keep it to one page
      if (rightColumnY < margin) {
        console.warn("Content exceeds one page - adjusting font sizes to fit");
        // Instead of adding a new page, we'll just stop here
        break;
      }
    }
    
    // Draw a vertical line between columns if using two-column layout
    if (layout !== 'one-column') {
      currentPage.drawLine({
        start: { x: margin + leftColumnWidth + columnGap / 2, y: height - margin },
        end: { x: margin + leftColumnWidth + columnGap / 2, y: margin },
        thickness: 0.5,
        color: accentColor,
      });
    }
    
    // Serialize the PDFDocument to bytes
    const pdfBytes = await doc.save();
    return pdfBytes;
  } catch (error: any) {
    console.error("Error in modifyPDFWithOptimizedContent:", error.message);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex values
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  
  return { r, g, b };
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

