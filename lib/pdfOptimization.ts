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
    'EDUCATION', 'TRAINING', 'INTERESTS', 'HOBBIES', 'SOFTWARE', 'PROFICIENCY'
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
  
  // Balance columns if needed
  balanceColumns(leftColumnSections, rightColumnSections);
  
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
      length += section.title.length * 2;
      
      // Count content lines
      const contentLines = section.content.split('\n');
      for (const line of contentLines) {
        if (line.trim()) {
          // Bullet points and indented content take more space
          if (line.startsWith('•') || line.startsWith('-') || line.startsWith('  ')) {
            length += line.length * 1.2;
          } else if (line.includes('**')) {
            // Bold text takes more space
            length += line.length * 1.3;
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
  const MAX_LEFT_COLUMN_LENGTH = 3200;
  const MAX_RIGHT_COLUMN_LENGTH = 3800;
  const MAX_TOTAL_LENGTH = 6500;
  
  console.log(`Estimated content length - Left: ${leftLength}, Right: ${rightLength}, Total: ${leftLength + rightLength}`);
  
  // If content is too long, trim it
  if (leftLength > MAX_LEFT_COLUMN_LENGTH || rightLength > MAX_RIGHT_COLUMN_LENGTH || (leftLength + rightLength) > MAX_TOTAL_LENGTH) {
    console.log("Content is too long, trimming to fit on one page");
    
    // Define a function to trim a section
    const trimSection = (section: Section): boolean => {
      // Don't trim important sections like contact info, summary, or education
      if (
        section.title.toLowerCase().includes('contact') || 
        section.title.toLowerCase().includes('summary') ||
        section.title.toLowerCase().includes('profile') ||
        section.title.toLowerCase().includes('education')
      ) {
        return false;
      }
      
      const lines = section.content.split('\n');
      
      // If section has more than 6 bullet points, trim it
      let bulletPointCount = 0;
      for (const line of lines) {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          bulletPointCount++;
        }
      }
      
      if (bulletPointCount > 6) {
        // Keep only the first 6 bullet points
        let newContent = '';
        let currentBulletCount = 0;
        
        for (const line of lines) {
          if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            currentBulletCount++;
            if (currentBulletCount <= 6) {
              newContent += line + '\n';
            }
          } else if (!line.trim().startsWith('-') && !line.trim().startsWith('•')) {
            // Keep non-bullet point lines
            newContent += line + '\n';
          }
        }
        
        section.content = newContent.trim();
        console.log(`Trimmed section "${section.title}" from ${bulletPointCount} to 6 bullet points`);
        return true;
      }
      
      // If section has more than 10 lines, trim it
      if (lines.length > 10) {
        section.content = lines.slice(0, 10).join('\n');
        console.log(`Trimmed section "${section.title}" from ${lines.length} to 10 lines`);
        return true;
      }
      
      return false;
    };
    
    // First, try to trim sections in the right column (usually contains work experience)
    let trimmed = false;
    for (const section of rightColumnSections) {
      if (trimSection(section)) {
        trimmed = true;
      }
    }
    
    // If right column is still too long, try more aggressive trimming
    if (estimateContentLength(rightColumnSections) > MAX_RIGHT_COLUMN_LENGTH && rightColumnSections.length > 1) {
      // Sort sections by length (descending)
      rightColumnSections.sort((a, b) => {
        const aLength = a.content.split('\n').length;
        const bLength = b.content.split('\n').length;
        return bLength - aLength;
      });
      
      // Trim the longest section more aggressively
      const longestSection = rightColumnSections[0];
      if (!longestSection.title.toLowerCase().includes('summary') && 
          !longestSection.title.toLowerCase().includes('profile')) {
        const lines = longestSection.content.split('\n');
        if (lines.length > 5) {
          longestSection.content = lines.slice(0, 5).join('\n');
          console.log(`Aggressively trimmed section "${longestSection.title}" to 5 lines`);
          trimmed = true;
        }
      }
    }
    
    // If left column is too long, trim it as well
    if (estimateContentLength(leftColumnSections) > MAX_LEFT_COLUMN_LENGTH) {
      for (const section of leftColumnSections) {
        if (trimSection(section)) {
          trimmed = true;
        }
      }
    }
    
    // If we've trimmed content, check if we need to balance columns
    if (trimmed) {
      balanceColumns(leftColumnSections, rightColumnSections);
    }
    
    console.log(`After trimming - Left: ${estimateContentLength(leftColumnSections)}, Right: ${estimateContentLength(rightColumnSections)}, Total: ${estimateContentLength(leftColumnSections) + estimateContentLength(rightColumnSections)}`);
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
  // Remove control characters and non-printable characters
  return text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
    let leftColumnWidth = (width - 2 * margin) * 0.38; // Increase left column width for better balance
    let rightColumnWidth = (width - 2 * margin) * 0.62; // Adjust right column accordingly
    const columnGap = 15;
    
    // Initialize Y positions for both columns
    let leftColumnY = height - margin - 70; // Start further below header for more space
    let rightColumnY = height - margin - 70; // Start further below header for more space
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
          y: height - margin - 35, // Increased height for better visibility
          width: width - 2 * margin,
          height: 35, // Increased for better visibility
          color: accentColor,
        });
        
        // Draw name with Resume next to it
        if (personName) {
          // Draw the name
          currentPage.drawText(personName, {
            x: margin + 10,
            y: height - margin - 22, // Adjusted for better vertical centering
            size: 20, // Increased for better visibility
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
          
          // Calculate position for "Resume" text
          const nameWidth = titleFont.widthOfTextAtSize(personName, 20);
          
          // Draw "Resume" next to the name
          currentPage.drawText(" Resume", {
            x: margin + 10 + nameWidth,
            y: height - margin - 22, // Same y position as name
            size: 20, // Same size as name
            font: regularFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
        } else {
          // Fallback if name not found
          currentPage.drawText("Resume", {
            x: margin + 10,
            y: height - margin - 22,
            size: 20,
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
        }
        
        // Draw contact info below the header if available
        if (contactInfo) {
          currentPage.drawText(contactInfo, {
            x: margin,
            y: height - margin - 45, // Position below the header
            size: 10,
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
        
        // Draw a subtle line below the header
        currentPage.drawLine({
          start: { x: margin, y: height - margin - 35 },
          end: { x: width - margin, y: height - margin - 35 },
          thickness: 1,
          color: accentColor,
        });
        
        // Center the name and Resume title at the top
        if (personName) {
          // Calculate center position
          const nameText = personName + " Resume";
          const nameWidth = titleFont.widthOfTextAtSize(nameText, 20);
          const centerX = (width - nameWidth) / 2;
          
          // Draw the name and Resume centered
          currentPage.drawText(nameText, {
            x: centerX,
            y: height - margin - 22,
            size: 20,
            font: titleFont,
            color: accentColor,
          });
        } else {
          // Fallback if name not found
          const resumeText = "Resume";
          const resumeWidth = titleFont.widthOfTextAtSize(resumeText, 20);
          const centerX = (width - resumeWidth) / 2;
          
          currentPage.drawText(resumeText, {
            x: centerX,
            y: height - margin - 22,
            size: 20,
            font: titleFont,
            color: accentColor,
          });
        }
        
        // Draw contact info below the header if available
        if (contactInfo) {
          const contactWidth = regularFont.widthOfTextAtSize(contactInfo, 10);
          const centerX = (width - contactWidth) / 2;
          
          currentPage.drawText(contactInfo, {
            x: centerX,
            y: height - margin - 45, // Position below the header
            size: 10,
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
        
        // Draw name with Resume next to it
        if (personName) {
          // Draw the name
          currentPage.drawText(personName, {
            x: margin,
            y: height - margin - 20,
            size: 22, // Larger for traditional style
            font: titleFont,
            color: accentColor,
          });
          
          // Calculate position for "Resume" text
          const nameWidth = titleFont.widthOfTextAtSize(personName, 22);
          
          // Draw "Resume" next to the name
          currentPage.drawText(" Resume", {
            x: margin + nameWidth,
            y: height - margin - 20, // Same y position as name
            size: 22, // Same size as name
            font: regularFont,
            color: textColor,
          });
          
          // Draw a line below the name
          currentPage.drawLine({
            start: { x: margin, y: height - margin - 30 },
            end: { x: width - margin, y: height - margin - 30 },
            thickness: 2,
            color: accentColor,
          });
        } else {
          // Fallback if name not found
          currentPage.drawText("Resume", {
            x: margin,
            y: height - margin - 20,
            size: 22,
            font: titleFont,
            color: accentColor,
          });
          
          // Draw a line below the title
          currentPage.drawLine({
            start: { x: margin, y: height - margin - 30 },
            end: { x: width - margin, y: height - margin - 30 },
            thickness: 2,
            color: accentColor,
          });
        }
        
        // Draw contact info below the header if available
        if (contactInfo) {
          currentPage.drawText(contactInfo, {
            x: margin,
            y: height - margin - 45, // Position below the header
            size: 10,
            font: regularFont,
            color: textColor,
          });
        }
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
      // Add a background rectangle for the section title with better contrast
      currentPage.drawRectangle({
        x: margin - 2,
        y: leftColumnY - 14,
        width: leftColumnWidth + 4,
        height: 22, // Taller for better visibility
        color: rgb(0.95, 0.95, 0.98), // Very light background color
      });
      
      currentPage.drawText(section.title.toUpperCase(), {
        x: margin,
        y: leftColumnY,
        size: 13, // Larger for better readability
        font: boldFont,
        color: accentColor, // Keep accent color for headers
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 5 },
          end: { x: margin + leftColumnWidth, y: leftColumnY - 5 },
          thickness: 1.8,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 5 },
          end: { x: margin + 80, y: leftColumnY - 5 }, // Longer underline
          thickness: 2.2,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // For minimal style, use a dot instead of a line
        currentPage.drawCircle({
          x: margin - 5,
          y: leftColumnY - 2,
          size: 4,
          color: accentColor,
        });
      }
      
      leftColumnY -= 28; // More space after section title
      
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
      leftColumnY -= 25; // More space between sections
    }
    
    // Draw right column sections
    for (const section of rightColumnSections) {
      // Draw section header with improved contrast
      // Add a background rectangle for the section title with better contrast
      currentPage.drawRectangle({
        x: rightColumnX - 2,
        y: rightColumnY - 14,
        width: rightColumnWidth + 4,
        height: 22, // Taller for better visibility
        color: rgb(0.95, 0.95, 0.98), // Very light background color
      });
      
      currentPage.drawText(section.title.toUpperCase(), {
        x: rightColumnX,
        y: rightColumnY,
        size: 13, // Larger for better readability
        font: boldFont,
        color: accentColor, // Keep accent color for headers
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 5 },
          end: { x: rightColumnX + rightColumnWidth, y: rightColumnY - 5 },
          thickness: 1.8,
          color: accentColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: rightColumnX, y: rightColumnY - 5 },
          end: { x: rightColumnX + 80, y: rightColumnY - 5 }, // Longer underline
          thickness: 2.2,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // For minimal style, use a dot instead of a line
        currentPage.drawCircle({
          x: rightColumnX - 5,
          y: rightColumnY - 2,
          size: 4,
          color: accentColor,
        });
      }
      
      rightColumnY -= 28; // More space after section title
      
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
      rightColumnY -= 25; // More space between sections
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

// Function to format text with styling (bullet points and bold text)
const formatTextWithStyling = (
  text: string,
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  boldFont: PDFFont,
  color: RGB,
  accentColor: RGB
) => {
  // Sanitize text to remove control characters
  text = sanitizeText(text);
  
  const fontSize = 10; // Increased from 9 to 10 for better readability
  const lineHeight = fontSize * 1.5; // Increased line spacing for better readability
  const bulletIndent = 10;
  let currentY = y;
  
  // Split text into lines
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      // Add space for empty lines
      currentY -= lineHeight * 0.7;
      continue;
    }
    
    // Check if line is a bullet point
    const isBulletPoint = line.startsWith('- ') || line.startsWith('• ');
    
    if (isBulletPoint) {
      // Remove the bullet marker for processing
      let bulletText = line.startsWith('- ') ? line.substring(2) : line.substring(2);
      
      // Draw the bullet point with accent color
      page.drawCircle({
        x: x + 3,
        y: currentY - fontSize / 3,
        size: 2.5, // Slightly larger bullet
        color: accentColor,
      });
      
      const xOffset = bulletIndent;
      
      // Check if bullet text contains bold markers
      if (bulletText.includes('**')) {
        // Handle bold text in bullet points
        const parts = bulletText.split(/\*\*(.*?)\*\*/g);
        let currentX = x + xOffset;
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === "") continue;
          
          const currentFont = i % 2 === 1 ? boldFont : font;
          const textWidth = currentFont.widthOfTextAtSize(parts[i], fontSize);
          
          // Check if text will overflow
          if (currentX + textWidth > x + width) {
            // Move to next line
            currentY -= lineHeight;
            currentX = x + xOffset;
          }
          
          // Draw text
          page.drawText(parts[i], {
            x: currentX,
            y: currentY,
            size: fontSize,
            font: currentFont,
            color: color,
          });
          
          currentX += textWidth;
        }
        
        currentY -= lineHeight * 1.2; // Add more space after bullet points
      } else {
        // Handle regular bullet point text with wrapping
        const words = bulletText.split(" ");
        let line = "";
        let currentX = x + xOffset;
        
        for (const word of words) {
          const testLine = line ? line + " " + word : word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (currentX + testWidth <= x + width) {
            line = testLine;
          } else {
            // Draw current line
            page.drawText(line, {
              x: currentX,
              y: currentY,
              size: fontSize,
              font: font,
              color: color,
            });
            
            // Move to next line
            currentY -= lineHeight;
            currentX = x + xOffset;
            line = word;
          }
        }
        
        // Draw remaining text
        if (line) {
          page.drawText(line, {
            x: currentX,
            y: currentY,
            size: fontSize,
            font: font,
            color: color,
          });
          
          currentY -= lineHeight * 1.2; // Add more space after bullet points
        }
      }
    } else if (line.includes("**")) {
      // Handle bold text in regular lines
      const parts = line.split(/\*\*(.*?)\*\*/g);
      let currentX = x;
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "") continue;
        
        const currentFont = i % 2 === 1 ? boldFont : font;
        const textWidth = currentFont.widthOfTextAtSize(parts[i], fontSize);
        
        // Check if text will overflow
        if (currentX + textWidth > x + width) {
          // Move to next line
          currentY -= lineHeight;
          currentX = x;
        }
        
        // Draw text
        page.drawText(parts[i], {
          x: currentX,
          y: currentY,
          size: fontSize,
          font: currentFont,
          color: color,
        });
        
        currentX += textWidth;
      }
      
      currentY -= lineHeight * 1.1; // Slightly more space after lines with bold text
    } else {
      // Handle regular text with wrapping
      const words = line.split(" ");
      let currentLine = "";
      let currentX = x;
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (currentX + testWidth <= x + width) {
          currentLine = testLine;
        } else {
          // Draw current line
          page.drawText(currentLine, {
            x: currentX,
            y: currentY,
            size: fontSize,
            font: font,
            color: color,
          });
          
          // Move to next line
          currentY -= lineHeight;
          currentX = x;
          currentLine = word;
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        page.drawText(currentLine, {
          x: currentX,
          y: currentY,
          size: fontSize,
          font: font,
          color: color,
        });
        
        currentY -= lineHeight * 1.1; // Slightly more space after regular text
      }
    }
  }
  
  return currentY;
};

// Helper function to balance columns if one is significantly longer than the other
function balanceColumns(leftColumnSections: Section[], rightColumnSections: Section[]): void {
  const leftLength = estimateContentLength(leftColumnSections);
  const rightLength = estimateContentLength(rightColumnSections);
  
  console.log(`Before balancing - Left column: ${leftLength}, Right column: ${rightLength}`);
  
  // If right column is significantly longer than left column
  if (rightLength > leftLength * 1.3 && rightColumnSections.length > 1) {
    // Find the shortest section from right column that's not a key section
    const movableSections = rightColumnSections
      .map((section, index) => ({ 
        section, 
        index, 
        length: estimateContentLength([section]),
        isKeySectionTitle: /EXPERIENCE|PROJECT|ACHIEVEMENT/i.test(section.title)
      }))
      .filter(item => !item.isKeySectionTitle) // Don't move key sections
      .sort((a, b) => a.length - b.length);
    
    if (movableSections.length > 0) {
      const sectionToMove = movableSections[0];
      console.log(`Moving section "${rightColumnSections[sectionToMove.index].title}" from right to left column`);
      const section = rightColumnSections.splice(sectionToMove.index, 1)[0];
      leftColumnSections.push(section);
    }
  }
  
  // If left column is significantly longer than right column
  if (leftLength > rightLength * 1.3 && leftColumnSections.length > 1) {
    // Find the shortest section from left column that's not a key section
    const movableSections = leftColumnSections
      .map((section, index) => ({ 
        section, 
        index, 
        length: estimateContentLength([section]),
        isKeySectionTitle: /EDUCATION|SKILL|LANGUAGE|CERTIFICATION/i.test(section.title)
      }))
      .filter(item => !item.isKeySectionTitle) // Don't move key sections
      .sort((a, b) => a.length - b.length);
    
    if (movableSections.length > 0) {
      const sectionToMove = movableSections[0];
      console.log(`Moving section "${leftColumnSections[sectionToMove.index].title}" from left to right column`);
      const section = leftColumnSections.splice(sectionToMove.index, 1)[0];
      rightColumnSections.push(section);
    }
  }
  
  // Check if we need a second pass to balance further
  const newLeftLength = estimateContentLength(leftColumnSections);
  const newRightLength = estimateContentLength(rightColumnSections);
  
  // If still significantly imbalanced, try one more adjustment
  if ((newRightLength > newLeftLength * 1.4 || newLeftLength > newRightLength * 1.4) && 
      (leftColumnSections.length > 1 && rightColumnSections.length > 1)) {
    balanceColumns(leftColumnSections, rightColumnSections);
  }
  
  console.log(`After balancing - Left column: ${estimateContentLength(leftColumnSections)}, Right column: ${estimateContentLength(rightColumnSections)}`);
}

