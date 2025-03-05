import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from "pdf-lib";
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
  // Remove any placeholder markers but preserve the actual content
  text = text.replace(/\[LEFT COLUMN END\]/g, '')
    .replace(/\[RIGHT COLUMN START\]/g, '')
    .replace(/CONTENT/g, '')
    .replace(/\*No previous work experience provided on the original CV\*/g, '')
    .replace(/\*No education information provided on the original CV\*/g, '')
    .replace(/\*No skills information provided on the original CV\*/g, '')
    .replace(/\*No projects information provided on the original CV\*/g, '')
    .replace(/\*No.*?provided.*?\*/g, ''); // Remove any other "No X provided" messages
  
  // Preserve NAME and CONTACT information for future use
  const nameMatch = text.match(/NAME: (.+?)(?:\n|$)/);
  const contactMatch = text.match(/CONTACT: (.+?)(?:\n|$)/);
  
  // Remove the NAME and CONTACT lines from the text as they'll be displayed in the header
  text = text.replace(/NAME: .+?\n/, '')
    .replace(/CONTACT: .+?\n/, '');
  
  const sections: Section[] = [];
  const lines = text.split('\n');
  
  let currentSection: Section | null = null;
  let currentContent = '';
  
  // Parse text into sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Enhanced section header detection
    // Check if this is a section header (all caps or surrounded by ## or uppercase or has specific formatting)
    if (
      (line === line.toUpperCase() && line.length > 2 && !/[a-z]/.test(line)) ||
      (line.startsWith('##') && line.endsWith('##')) ||
      (line.startsWith('# ')) ||
      /^[A-Z][A-Za-z\s]+:$/.test(line) || // Matches "Section Name:" format
      (i > 0 && !lines[i-1].trim() && i < lines.length - 1 && !lines[i+1].trim() && line.length < 30) || // Isolated line between empty lines
      line.startsWith('**') && line.endsWith('**') // Bold section headers
    ) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = currentContent.trim();
        sections.push(currentSection);
      }
      
      // Clean up section title
      let sectionTitle = line.replace(/^#+\s*|\s*#+$|:$/g, '').trim();
      sectionTitle = sectionTitle.replace(/^\*\*|\*\*$/g, '').trim(); // Remove ** if present
      
      // Create new section
      currentSection = {
        title: sectionTitle,
        content: ''
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
  
  // Distribute sections between left and right columns
  const leftColumnSections: Section[] = [];
  const rightColumnSections: Section[] = [];
  
  // Define which sections should go in the left column
  const leftColumnTitles = [
    'PROFILE', 'SUMMARY', 'ABOUT', 'CONTACT', 'PERSONAL',
    'SKILLS', 'TECHNICAL SKILLS', 'SOFT SKILLS', 'LANGUAGES', 'CERTIFICATIONS',
    'EDUCATION', 'TRAINING', 'INTERESTS', 'HOBBIES'
  ];
  
  // Distribute sections based on their titles
  for (const section of sections) {
    const normalizedTitle = section.title.toUpperCase();
    
    // Check if this section should go in the left column
    if (leftColumnTitles.some(title => normalizedTitle.includes(title))) {
      leftColumnSections.push(section);
    } else {
      // Default to right column for work experience, projects, etc.
      rightColumnSections.push(section);
    }
  }
  
  // Ensure content fits on a single page
  ensureSinglePage(leftColumnSections, rightColumnSections);
  
  console.log(`Estimated content length - Left: ${estimateContentLength(leftColumnSections)}, Right: ${estimateContentLength(rightColumnSections)}, Total: ${estimateContentLength(leftColumnSections) + estimateContentLength(rightColumnSections)}`);
  
  return { leftColumnSections, rightColumnSections };
}

// Helper function to estimate content length
function estimateContentLength(sections: Section[]): number {
  let length = 0;
  
  for (const section of sections) {
    // Add length for section title
    length += 20;
    
    // Count lines in content
    const lines = section.content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Bullet points and bold text take more space
      if (line.includes('•') || line.includes('-')) {
        length += 15;
      } else if (line.includes('**')) {
        length += 15;
      } else {
        length += 10;
      }
    }
  }
  
  return length;
}

// Function to ensure content fits on a single page
function ensureSinglePage(leftColumnSections: Section[], rightColumnSections: Section[]): void {
  // Estimate the total content length
  const estimateContentLength = (sections: Section[]): number => {
    let length = 0;
    for (const section of sections) {
      // Count title (headers take more space)
      length += section.title.length * 1.5;
      
      // Count content lines
      const contentLines = section.content.split('\n');
      for (const line of contentLines) {
        if (line.trim()) {
          // Bullet points and indented content take more space
          if (line.startsWith('•') || line.startsWith('-') || line.startsWith('  ')) {
            length += line.length * 1.2;
          } else {
            length += line.length;
          }
        }
      }
    }
    return length;
  };
  
  const leftLength = estimateContentLength(leftColumnSections);
  const rightLength = estimateContentLength(rightColumnSections);
  
  // Define maximum length thresholds (these values are approximate)
  const MAX_LEFT_COLUMN_LENGTH = 3000;
  const MAX_RIGHT_COLUMN_LENGTH = 3500;
  const MAX_TOTAL_LENGTH = 6000;
  
  console.log(`Estimated content length - Left: ${leftLength}, Right: ${rightLength}, Total: ${leftLength + rightLength}`);
  
  // If content is too long, trim it
  if (leftLength > MAX_LEFT_COLUMN_LENGTH || rightLength > MAX_RIGHT_COLUMN_LENGTH || (leftLength + rightLength) > MAX_TOTAL_LENGTH) {
    console.log("Content is too long, trimming to fit on one page");
    
    // Define a function to trim a section
    const trimSection = (section: Section): boolean => {
      // Don't trim important sections like contact info or summary
      if (
        section.title.toLowerCase().includes('contact') || 
        section.title.toLowerCase().includes('summary') ||
        section.title.toLowerCase().includes('profile')
      ) {
        return false;
      }
      
      const lines = section.content.split('\n');
      
      // If section has more than 5 lines, trim it
      if (lines.length > 5) {
        // Keep first 4 lines and add "..." as the last line
        section.content = lines.slice(0, 4).join('\n') + '\n...';
        return true;
      }
      
      return false;
    };
    
    // Sort sections by length to trim the longest ones first
    const sortSectionsByLength = (sections: Section[]): Section[] => {
      return [...sections].sort((a, b) => {
        return b.content.length - a.content.length;
      });
    };
    
    // Try to balance columns if one is much longer than the other
    if (leftLength > rightLength * 1.5) {
      // Move the shortest section from left to right
      const sortedLeft = sortSectionsByLength(leftColumnSections).reverse();
      if (sortedLeft.length > 1) {
        const sectionToMove = sortedLeft[0];
        leftColumnSections.splice(leftColumnSections.indexOf(sectionToMove), 1);
        rightColumnSections.push(sectionToMove);
        console.log(`Moved section "${sectionToMove.title}" from left to right column to balance length`);
      }
    } else if (rightLength > leftLength * 1.5) {
      // Move the shortest section from right to left
      const sortedRight = sortSectionsByLength(rightColumnSections).reverse();
      if (sortedRight.length > 1) {
        const sectionToMove = sortedRight[0];
        rightColumnSections.splice(rightColumnSections.indexOf(sectionToMove), 1);
        leftColumnSections.push(sectionToMove);
        console.log(`Moved section "${sectionToMove.title}" from right to left column to balance length`);
      }
    }
    
    // Trim sections if still too long
    let leftTrimmed = false;
    let rightTrimmed = false;
    
    if (leftLength > MAX_LEFT_COLUMN_LENGTH) {
      const sortedLeft = sortSectionsByLength(leftColumnSections);
      for (const section of sortedLeft) {
        if (trimSection(section)) {
          leftTrimmed = true;
          break;
        }
      }
    }
    
    if (rightLength > MAX_RIGHT_COLUMN_LENGTH) {
      const sortedRight = sortSectionsByLength(rightColumnSections);
      for (const section of sortedRight) {
        if (trimSection(section)) {
          rightTrimmed = true;
          break;
        }
      }
    }
    
    // If we trimmed any sections, recalculate length
    if (leftTrimmed || rightTrimmed) {
      const newLeftLength = estimateContentLength(leftColumnSections);
      const newRightLength = estimateContentLength(rightColumnSections);
      console.log(`After trimming - Left: ${newLeftLength}, Right: ${newRightLength}, Total: ${newLeftLength + newRightLength}`);
      
      // If still too long, recursively trim more
      if (newLeftLength > MAX_LEFT_COLUMN_LENGTH || newRightLength > MAX_RIGHT_COLUMN_LENGTH || (newLeftLength + newRightLength) > MAX_TOTAL_LENGTH) {
        ensureSinglePage(leftColumnSections, rightColumnSections);
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
  // Remove any control characters or non-printable characters
  return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
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
    
    // Load fonts
    // Use StandardFonts instead of trying to load external fonts
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
    const titleFont = boldFont;
    
    // Set default colors
    let textColor = rgb(0, 0, 0); // Black
    let accentColor = rgb(0.2, 0.4, 0.8); // Default blue
    
    // Set default layout
    let layout = 'two-column';
    let headerStyle = 'modern';
    
    // Apply template-specific styling if available
    if (template) {
      console.log(`Applying template: ${template.name}`);
      
      // Get layout from template metadata
      layout = template.metadata.layout || layout;
      
      // Get template-specific layout from templateMatching
      const templateLayout = getTemplateLayout(template.id);
      headerStyle = templateLayout.headerStyle || headerStyle;
      
      // Set accent color from template
      if (template.metadata.colorScheme && template.metadata.colorScheme.accent) {
        const accentHex = template.metadata.colorScheme.accent;
        const accentRgb = hexToRgb(accentHex);
        accentColor = rgb(accentRgb.r / 255, accentRgb.g / 255, accentRgb.b / 255);
      }
      
      // Apply template-specific styling
      if (template.name === 'Apple Minimal' || template.id === 'apple-minimal') {
        margin = 40; // Smaller margins for minimal style
        accentColor = rgb(0.5, 0.5, 0.5); // Gray accent for minimal style
        headerStyle = 'minimal';
      } else if (template.name === 'Google Modern' || template.id === 'google-modern') {
        margin = 50;
        accentColor = rgb(0.2, 0.4, 0.8); // Blue accent for Google
        headerStyle = 'modern';
      } else if (template.name === 'Amazon Leadership' || template.id === 'amazon-leadership') {
        margin = 45;
        accentColor = rgb(0.8, 0.5, 0.1); // Orange accent for Amazon
        headerStyle = 'traditional';
      } else if (template.name === 'Meta Impact' || template.id === 'meta-impact') {
        margin = 50;
        accentColor = rgb(0.1, 0.4, 0.7); // Blue accent for Meta
        headerStyle = 'modern';
      } else if (template.name === 'Microsoft Professional' || template.id === 'microsoft-professional') {
        margin = 45;
        accentColor = rgb(0.1, 0.5, 0.7); // Blue-green accent for Microsoft
        headerStyle = 'traditional';
      }
    }
    
    // Set column widths based on layout
    let leftColumnWidth = (width - 2 * margin) * 0.3;
    let rightColumnWidth = (width - 2 * margin) * 0.7;
    const columnGap = 15;
    
    // Initialize Y positions for both columns
    let leftColumnY = height - margin - 60; // Start below header
    let rightColumnY = height - margin - 60; // Start below header
    const rightColumnX = margin + leftColumnWidth + columnGap;
    
    // Reference to current page for multi-page support
    let currentPage = page;
    
    // Add header based on template style
    if (headerStyle === 'modern') {
      try {
        // Extract name and contact info
        const nameMatch = optimizedText.match(/NAME: (.+?)(?:\n|$)/);
        const contactMatch = optimizedText.match(/CONTACT: (.+?)(?:\n|$)/);
        
        let personName = "";
        if (nameMatch && nameMatch[1]) {
          personName = nameMatch[1].trim();
        }
        
        let contactInfo = "";
        if (contactMatch && contactMatch[1]) {
          contactInfo = contactMatch[1].trim();
        }
        
        // Draw a colored rectangle at the top
        currentPage.drawRectangle({
          x: margin,
          y: height - margin - 25, // Reduced from 30 to fit on one page
          width: width - 2 * margin,
          height: 25, // Reduced from 30 to fit on one page
          color: accentColor,
        });
        
        // Draw name with Resume next to it
        if (personName) {
          // Draw the name
          currentPage.drawText(personName, {
            x: margin + 10,
            y: height - margin - 18, // Adjusted for smaller header
            size: 16, // Reduced from 18 to fit on one page
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
          
          // Calculate position for "Resume" text
          const nameWidth = titleFont.widthOfTextAtSize(personName, 16);
          
          // Draw "Resume" next to the name
          currentPage.drawText(" | Resume", {
            x: margin + 10 + nameWidth,
            y: height - margin - 18, // Same y position as name
            size: 16,
            font: regularFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
        } else {
          // Fallback if name not found
          currentPage.drawText("Resume", {
            x: margin + 10,
            y: height - margin - 18,
            size: 16,
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
        }
        
        // Draw contact info below header
        if (contactInfo) {
          currentPage.drawText(contactInfo, {
            x: margin,
            y: height - margin - 40, // Adjusted for smaller header
            size: 9, // Reduced from 10 to fit on one page
            font: regularFont,
            color: textColor,
          });
        }
      } catch (error) {
        console.error("Error drawing header:", error);
      }
    } else if (headerStyle === 'minimal') {
      try {
        // Extract name and contact info
        const nameMatch = optimizedText.match(/NAME: (.+?)(?:\n|$)/);
        const contactMatch = optimizedText.match(/CONTACT: (.+?)(?:\n|$)/);
        
        let personName = "";
        if (nameMatch && nameMatch[1]) {
          personName = nameMatch[1].trim();
        }
        
        let contactInfo = "";
        if (contactMatch && contactMatch[1]) {
          contactInfo = contactMatch[1].trim();
        }
        
        // Draw a thin line at the top
        currentPage.drawLine({
          start: { x: margin, y: height - margin + 8 }, // Reduced from 10 to fit on one page
          end: { x: width - margin, y: height - margin + 8 }, // Reduced from 10 to fit on one page
          thickness: 1,
          color: accentColor,
        });
        
        // Draw name in large font
        if (personName) {
          // Draw the name
          currentPage.drawText(personName, {
            x: margin,
            y: height - margin,
            size: 16, // Reduced from 18 to fit on one page
            font: titleFont,
            color: textColor,
          });
          
          // Calculate position for "Resume" text
          const nameWidth = titleFont.widthOfTextAtSize(personName, 16);
          
          // Draw "Resume" next to the name
          currentPage.drawText(" | Resume", {
            x: margin + nameWidth,
            y: height - margin, // Same y position as name
            size: 16,
            font: regularFont,
            color: textColor,
          });
        } else {
          // Fallback if name not found
          currentPage.drawText("Resume", {
            x: margin,
            y: height - margin,
            size: 16,
            font: titleFont,
            color: textColor,
          });
        }
        
        // Draw contact info below name
        if (contactInfo) {
          currentPage.drawText(contactInfo, {
            x: margin,
            y: height - margin - 20, // Adjusted for smaller header
            size: 9, // Reduced from 10 to fit on one page
            font: regularFont,
            color: textColor,
          });
        }
      } catch (error) {
        console.error("Error drawing header:", error);
      }
    } else if (headerStyle === 'traditional') {
      try {
        // Extract name and contact info
        const nameMatch = optimizedText.match(/NAME: (.+?)(?:\n|$)/);
        const contactMatch = optimizedText.match(/CONTACT: (.+?)(?:\n|$)/);
        
        let personName = "";
        if (nameMatch && nameMatch[1]) {
          personName = nameMatch[1].trim();
        }
        
        let contactInfo = "";
        if (contactMatch && contactMatch[1]) {
          contactInfo = contactMatch[1].trim();
        }
        
        // Center-align the name
        const nameWidth = titleFont.widthOfTextAtSize(personName, 18); // Reduced from 20 to fit on one page
        const resumeText = " | Resume";
        const resumeWidth = regularFont.widthOfTextAtSize(resumeText, 18);
        const totalWidth = nameWidth + resumeWidth;
        const nameX = (width - totalWidth) / 2;
        
        // Draw name in large font, centered
        if (personName) {
          // Draw the name
          currentPage.drawText(personName, {
            x: nameX,
            y: height - margin,
            size: 18, // Reduced from 20 to fit on one page
            font: titleFont,
            color: textColor,
          });
          
          // Draw "Resume" next to the name
          currentPage.drawText(resumeText, {
            x: nameX + nameWidth,
            y: height - margin, // Same y position as name
            size: 18,
            font: regularFont,
            color: textColor,
          });
        } else {
          // Fallback if name not found
          currentPage.drawText("Resume", {
            x: (width - titleFont.widthOfTextAtSize("Resume", 18)) / 2,
            y: height - margin,
            size: 18,
            font: titleFont,
            color: textColor,
          });
        }
        
        // Draw contact info centered below name
        if (contactInfo) {
          const contactWidth = regularFont.widthOfTextAtSize(contactInfo, 9); // Reduced from 10 to fit on one page
          const contactX = (width - contactWidth) / 2;
          
          currentPage.drawText(contactInfo, {
            x: contactX,
            y: height - margin - 20, // Adjusted for smaller header
            size: 9, // Reduced from 10 to fit on one page
            font: regularFont,
            color: textColor,
          });
        }
        
        // Draw a horizontal line below contact info
        currentPage.drawLine({
          start: { x: margin, y: height - margin - 30 }, // Adjusted for smaller header
          end: { x: width - margin, y: height - margin - 30 }, // Adjusted for smaller header
          thickness: 1,
          color: accentColor,
        });
      } catch (error) {
        console.error("Error drawing header:", error);
      }
    }
    
    // Adjust column layout based on template
    if (layout === "one-column") {
      // For one-column layout, use full width
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
      // Draw section header with improved contrast
      // Add a background rectangle for the section title
      currentPage.drawRectangle({
        x: margin - 2,
        y: leftColumnY - 14,
        width: leftColumnWidth + 4,
        height: 18, // Slightly taller for better visibility
        color: rgb(0.95, 0.95, 0.98), // Very light background color
      });
      
      currentPage.drawText(section.title.toUpperCase(), {
        x: margin,
        y: leftColumnY,
        size: 12, // Slightly larger for better readability
        font: boldFont,
        color: accentColor, // Keep accent color for headers
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 4 },
          end: { x: margin + leftColumnWidth, y: leftColumnY - 4 },
          thickness: 1,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 4 },
          end: { x: margin + 50, y: leftColumnY - 4 }, // Slightly longer underline
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
      
      leftColumnY -= 22; // Slightly more space after section title
      
      // Use the new formatTextWithStyling function to draw section content
      leftColumnY = formatTextWithStyling(
        section.content,
        currentPage,
        margin,
        leftColumnY,
        leftColumnWidth,
        regularFont,
        boldFont,
        textColor,
        accentColor
      );
      
      // Add space after section
      leftColumnY -= 15; // More space between sections
    }
    
    // Draw right column sections
    for (const section of rightColumnSections) {
      // Draw section header with improved contrast
      // Add a background rectangle for the section title
      currentPage.drawRectangle({
        x: rightColumnX - 2,
        y: rightColumnY - 14,
        width: rightColumnWidth + 4,
        height: 18, // Slightly taller for better visibility
        color: rgb(0.95, 0.95, 0.98), // Very light background color
      });
      
      currentPage.drawText(section.title.toUpperCase(), {
        x: rightColumnX,
        y: rightColumnY,
        size: 12, // Slightly larger for better readability
        font: boldFont,
        color: accentColor, // Keep accent color for headers
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 4 },
          end: { x: rightColumnX + rightColumnWidth, y: rightColumnY - 4 },
          thickness: 1,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 4 },
          end: { x: rightColumnX + 50, y: rightColumnY - 4 }, // Slightly longer underline
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
      
      rightColumnY -= 22; // Slightly more space after section title
      
      // Use the new formatTextWithStyling function to draw section content
      rightColumnY = formatTextWithStyling(
        section.content,
        currentPage,
        rightColumnX,
        rightColumnY,
        rightColumnWidth,
        regularFont,
        boldFont,
        textColor,
        accentColor
      );
      
      // Add space after section
      rightColumnY -= 15; // More space between sections
    }
    
    // Save the PDF
    const pdfBytes = await doc.save();
    return pdfBytes;
  } catch (error) {
    console.error("Error modifying PDF:", error);
    throw error;
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

// Helper function to format text with bold and bullet points
function formatTextWithStyling(
  text: string,
  page: PDFPage,
  x: number,
  y: number,
  maxWidth: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
  textColor: RGB,
  accentColor: RGB
): number {
  // Sanitize text to remove control characters
  text = sanitizeText(text);
  
  // Split text into lines
  const lines = text.split('\n');
  let currentY = y;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Check if this is a bullet point
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      // Draw bullet point with accent color
      page.drawText('•', {
        x,
        y: currentY,
        size: 9,
        font: regularFont,
        color: accentColor,
      });
      
      // Get text after bullet
      const textAfterBullet = line.trim().startsWith('•') 
        ? line.substring(1).trim() 
        : line.substring(1).trim();
      
      // Check if the bullet point text contains bold markers
      if (textAfterBullet.includes('**')) {
        // Process bold text within the bullet point
        const parts = textAfterBullet.split('**');
        let currentX = x + 10; // Indent after bullet
        let isInBold = false;
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].trim() === '') {
            isInBold = !isInBold;
            continue;
          }
          
          // Choose font and size based on whether this part should be bold
          const font = isInBold ? boldFont : regularFont;
          const fontSize = isInBold ? 9 : 9; // Same size for consistency, but bold for emphasis
          
          // Draw this part of the text
          page.drawText(parts[i], {
            x: currentX,
            y: currentY,
            size: fontSize,
            font: font,
            color: textColor,
          });
          
          // Move the x position for the next part
          currentX += font.widthOfTextAtSize(parts[i], fontSize);
          isInBold = !isInBold;
        }
        
        currentY -= 14; // Space after bullet point
      } else {
        // Handle text wrapping for bullet points
        const wrappedLines = wrapText(textAfterBullet, regularFont, 9, maxWidth - 10);
        for (let i = 0; i < wrappedLines.length; i++) {
          page.drawText(wrappedLines[i], {
            x: x + 10, // Indent after bullet
            y: currentY - (i * 12),
            size: 9,
            font: regularFont,
            color: textColor,
          });
          
          // Only adjust Y position after all wrapped lines are drawn
          if (i === wrappedLines.length - 1) {
            currentY -= (i * 12) + 14;
          }
        }
      }
    }
    // Check if this is a line with ** markers (skills, etc.)
    else if (line.includes('**')) {
      // Process the line to handle ** markers
      const parts = line.split('**');
      let currentX = x;
      let isInBold = false;
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim() === '') {
          isInBold = !isInBold;
          continue;
        }
        
        // Choose font and size based on whether this part should be bold
        const font = isInBold ? boldFont : regularFont;
        const fontSize = isInBold ? 9 : 9; // Same size for consistency, but bold for emphasis
        
        // Draw this part of the text
        page.drawText(parts[i], {
          x: currentX,
          y: currentY,
          size: fontSize,
          font: font,
          color: textColor,
        });
        
        // Move the x position for the next part
        currentX += font.widthOfTextAtSize(parts[i], fontSize);
        isInBold = !isInBold;
      }
      
      currentY -= 14; // Space after line
    }
    // Regular text
    else {
      const wrappedLines = wrapText(line, regularFont, 9, maxWidth);
      for (let i = 0; i < wrappedLines.length; i++) {
        page.drawText(wrappedLines[i], {
          x,
          y: currentY - (i * 12),
          size: 9,
          font: regularFont,
          color: textColor,
        });
        
        if (i === wrappedLines.length - 1) {
          currentY -= (i * 12) + 14;
        }
      }
    }
  }
  
  return currentY;
}

