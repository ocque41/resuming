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
  console.log("Parsing optimized text into sections");
  
  // Handle empty text
  if (!text || text.trim().length === 0) {
    console.error("ERROR: Empty text provided to parseOptimizedText");
    return {
      leftColumnSections: [{ title: "Error", content: "No content was provided for parsing." }],
      rightColumnSections: []
    };
  }
  
  // Try to parse JSON if the text appears to be in JSON format
  let textToProcess = text;
  if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
    try {
      const jsonData = JSON.parse(text);
      if (jsonData.optimizedText) {
        console.log("Found JSON format with optimizedText property, extracting content");
        textToProcess = jsonData.optimizedText;
      }
    } catch (error) {
      console.warn("Text appears to be JSON but failed to parse:", error);
    }
  }
  
  const lines = textToProcess.split('\n');
  let currentSection: Section | null = null;
  const leftColumnSections: Section[] = [];
  const rightColumnSections: Section[] = [];
  
  // Track all section headers found for better organization
  const allSectionHeaders: string[] = [];
  
  // Count valid content lines to detect minimal content
  let validContentLines = 0;
  
  // Collect all non-marker lines as fallback content
  let fallbackContent = '';
  
  // Track which column we're in
  let inLeftColumn = false;
  let inRightColumn = false;
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Count valid content lines
    if (line.length > 0 && 
        !line.includes('[LEFT-COLUMN-START]') && 
        !line.includes('[LEFT-COLUMN-END]') && 
        !line.includes('[RIGHT-COLUMN-START]') && 
        !line.includes('[RIGHT-COLUMN-END]')) {
      validContentLines++;
      
      // Add to fallback content if not a marker
      if (!line.includes('[HEADER]') && 
          !line.includes('[SUBHEADER]') && 
          !line.includes('[BULLET]')) {
        fallbackContent += line + '\n';
      }
    }
    
    // Check for column markers
    if (line.includes('[LEFT-COLUMN-START]')) {
      inLeftColumn = true;
      inRightColumn = false;
      continue;
    } else if (line.includes('[LEFT-COLUMN-END]')) {
      inLeftColumn = false;
      continue;
    } else if (line.includes('[RIGHT-COLUMN-START]')) {
      inRightColumn = true;
      inLeftColumn = false;
      continue;
    } else if (line.includes('[RIGHT-COLUMN-END]')) {
      inRightColumn = false;
      continue;
    }
    
    // Check for section headers
    if (line.includes('[HEADER]') || line.startsWith('## ')) {
      // Extract section title
      const title = line.replace('[HEADER]', '').replace('## ', '').trim();
      
      // Save the previous section if it exists
      if (currentSection) {
        if (inLeftColumn) {
          leftColumnSections.push(currentSection);
        } else if (inRightColumn) {
          rightColumnSections.push(currentSection);
        } else {
          // If we're not in a specific column, default to right column
          rightColumnSections.push(currentSection);
        }
      }
      
      // Create a new section
      currentSection = { title, content: '' };
      allSectionHeaders.push(title);
      continue;
    }
    
    // Check for subheaders
    if (line.includes('[SUBHEADER]') || line.startsWith('### ')) {
      const subheaderText = line.replace('[SUBHEADER]', '').replace('### ', '').trim();
      
      // Add subheader to current section if it exists
      if (currentSection) {
        currentSection.content += `<strong>${subheaderText}</strong>\n`;
      } else {
        // If no current section, create one with a generic title
        currentSection = { 
          title: "Content", 
          content: `<strong>${subheaderText}</strong>\n` 
        };
      }
      continue;
    }
    
    // Check for bullet points
    if (line.includes('[BULLET]') || line.startsWith('• ') || line.startsWith('* ')) {
      const bulletText = line
        .replace('[BULLET]', '')
        .replace('• ', '')
        .replace('* ', '')
        .trim();
      
      // Add bullet point to current section if it exists
      if (currentSection) {
        currentSection.content += `• ${bulletText}\n`;
      } else {
        // If no current section, add to a generic section
        currentSection = { 
          title: "Content", 
          content: `• ${bulletText}\n` 
        };
      }
      continue;
    }
    
    // Add regular content to current section
    if (currentSection) {
      currentSection.content += `${line}\n`;
    } else {
      // If content appears before any section header, create a default section
      currentSection = { title: "Content", content: `${line}\n` };
    }
  }
  
  // Add the last section if it exists
  if (currentSection) {
    if (inLeftColumn) {
      leftColumnSections.push(currentSection);
    } else if (inRightColumn) {
      rightColumnSections.push(currentSection);
    } else {
      // If we're not in a specific column, default to right column
      rightColumnSections.push(currentSection);
    }
  }
  
  // Check if we have minimal content
  if (validContentLines < 10) {
    console.warn(`WARNING: Minimal content detected (${validContentLines} lines)`);
  }
  
  // If no sections were found, try to identify sections from fallback content
  if (leftColumnSections.length === 0 && rightColumnSections.length === 0 && fallbackContent.length > 0) {
    console.log("No sections found, attempting to identify sections from fallback content");
    
    // Common section patterns
    const sectionPatterns = [
      { name: 'Profile', regex: /\b(profile|summary|about|objective)\b/i, isLeft: false },
      { name: 'Experience', regex: /\b(experience|work|employment|career)\b/i, isLeft: false },
      { name: 'Education', regex: /\b(education|academic|qualifications|degree)\b/i, isLeft: true },
      { name: 'Skills', regex: /\b(skills|abilities|competencies|expertise)\b/i, isLeft: true },
      { name: 'Languages', regex: /\b(languages|language proficiency)\b/i, isLeft: true },
      { name: 'Certifications', regex: /\b(certifications|certificates|qualifications)\b/i, isLeft: true },
      { name: 'Contact', regex: /\b(contact|email|phone|address)\b/i, isLeft: true }
    ];
    
    // Split fallback content into potential sections
    const contentBlocks = fallbackContent.split(/\n\s*\n/);
    
    for (const block of contentBlocks) {
      if (block.trim().length === 0) continue;
      
      // Try to identify what type of section this might be
      let identifiedSection = false;
      
      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(block)) {
          // Create a section with the identified name
          const section = { title: pattern.name, content: block.trim() };
          
          if (pattern.isLeft) {
            leftColumnSections.push(section);
          } else {
            rightColumnSections.push(section);
          }
          
          identifiedSection = true;
          break;
        }
      }
      
      // If we couldn't identify the section, add it to the right column as generic content
      if (!identifiedSection) {
        rightColumnSections.push({ title: "Content", content: block.trim() });
      }
    }
  }
  
  // If we still have no sections, create a placeholder
  if (leftColumnSections.length === 0 && rightColumnSections.length === 0) {
    console.warn("WARNING: No sections found after processing");
    rightColumnSections.push({ 
      title: "Content", 
      content: textToProcess.trim() || "No structured content was found." 
    });
  }
  
  console.log(`Parsed ${leftColumnSections.length} left column sections and ${rightColumnSections.length} right column sections`);
  
  // Log section titles for debugging
  if (leftColumnSections.length > 0) {
    console.log("Left column sections:", leftColumnSections.map(s => s.title).join(", "));
  }
  
  if (rightColumnSections.length > 0) {
    console.log("Right column sections:", rightColumnSections.map(s => s.title).join(", "));
  }
  
  return { leftColumnSections, rightColumnSections };
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
    let primaryColor = rgb(0.1, 0.1, 0.1); // Default dark gray
    let accentColor = rgb(0.2, 0.4, 0.8); // Default blue
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
        
        if (colorScheme.primary) {
          // Convert hex to RGB
          const r = parseInt(colorScheme.primary.substring(1, 3), 16) / 255;
          const g = parseInt(colorScheme.primary.substring(3, 5), 16) / 255;
          const b = parseInt(colorScheme.primary.substring(5, 7), 16) / 255;
          primaryColor = rgb(r, g, b);
        }
        
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
        margin = 60;
        columnGap = 30;
        primaryColor = rgb(0.3, 0.3, 0.3); // Lighter text
        accentColor = rgb(0.5, 0.5, 0.5); // Gray accent
      } else if (template.name === 'Google Modern' || template.id === 'google-modern') {
        // Modern template has bold colors and less margin
        margin = 40;
        columnGap = 25;
        // Keep default colors which are bolder
      } else if (template.name === 'Amazon Leadership' || template.id === 'amazon-leadership') {
        // Traditional template has serif fonts and classic colors
        fontFamily = 'Times-Roman';
        primaryColor = rgb(0.05, 0.05, 0.2); // Dark blue-black
        accentColor = rgb(0.5, 0.1, 0.1); // Dark red accent
      } else if (template.name === 'Meta Impact' || template.id === 'meta-impact') {
        // Creative template has unique colors and layout
        accentColor = rgb(0.8, 0.3, 0.3); // Reddish accent
        backgroundColor = rgb(0.98, 0.98, 1); // Very light blue background
        
        // Add a decorative element for creative template
        page.drawRectangle({
          x: 0,
          y: height - 100,
          width: width,
          height: 100,
          color: rgb(0.95, 0.95, 1),
        });
        
        // Add a decorative line
        page.drawLine({
          start: { x: 0, y: height - 100 },
          end: { x: width, y: height - 100 },
          thickness: 3,
          color: accentColor,
        });
      } else if (template.name === 'Microsoft Professional' || template.id === 'microsoft-professional') {
        // Professional template has clean lines and professional colors
        primaryColor = rgb(0.05, 0.2, 0.4); // Dark blue
        accentColor = rgb(0.4, 0.6, 0.8); // Medium blue
        
        // Add a thin header bar
        page.drawRectangle({
          x: 0,
          y: height - 30,
          width: width,
          height: 30,
          color: rgb(0.05, 0.2, 0.4),
        });
      }
    }
    
    // Set text color based on primary color
    const textColor = primaryColor;
    
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
          y: height - margin - 30,
          width: width - 2 * margin,
          height: 30,
          color: accentColor,
        });
        
        // Draw name in large font
        if (name) {
          currentPage.drawText(name.toUpperCase(), {
            x: margin + 10,
            y: height - margin - 20,
            size: 18,
            font: titleFont,
            color: rgb(1, 1, 1), // White text on colored background
          });
          
          // Draw contact info below
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: margin,
              y: height - margin - 40,
              size: 9,
              font: regularFont,
              color: textColor,
            });
          }
          
          // Adjust starting positions
          leftColumnY = height - margin - 70;
          rightColumnY = height - margin - 70;
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
          start: { x: margin, y: height - margin + 10 },
          end: { x: width - margin, y: height - margin + 10 },
          thickness: 1,
          color: accentColor,
        });
        
        // Draw name in large font
        if (name) {
          currentPage.drawText(name, {
            x: margin,
            y: height - margin,
            size: 18,
            font: titleFont,
            color: textColor,
          });
          
          // Draw contact info to the right
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: width - margin - regularFont.widthOfTextAtSize(contactInfo, 9),
              y: height - margin,
              size: 9,
              font: regularFont,
              color: textColor,
            });
          }
          
          // Draw a thin line below
          currentPage.drawLine({
            start: { x: margin, y: height - margin - 10 },
            end: { x: width - margin, y: height - margin - 10 },
            thickness: 1,
            color: accentColor,
          });
          
          // Adjust starting positions
          leftColumnY = height - margin - 30;
          rightColumnY = height - margin - 30;
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
        const nameWidth = titleFont.widthOfTextAtSize(name, 20);
        const nameX = (width - nameWidth) / 2;
        
        // Draw name in large font, centered
        if (name) {
          currentPage.drawText(name, {
            x: nameX,
            y: height - margin,
            size: 20,
            font: titleFont,
            color: textColor,
          });
          
          // Center-align contact info
          const contactWidth = regularFont.widthOfTextAtSize(contactInfo, 10);
          const contactX = (width - contactWidth) / 2;
          const contactY = height - margin - 25;
          
          // Draw contact info centered below name
          if (contactInfo) {
            currentPage.drawText(contactInfo, {
              x: contactX,
              y: contactY,
              size: 10,
              font: regularFont,
              color: textColor,
            });
          }
          
          // Draw a decorative line below
          currentPage.drawLine({
            start: { x: margin, y: contactY - 15 },
            end: { x: width - margin, y: contactY - 15 },
            thickness: 1,
            color: accentColor,
          });
          
          // Adjust starting positions
          leftColumnY = contactY - 25;
          rightColumnY = contactY - 25;
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
        size: 12,
        font: boldFont,
        color: primaryColor,
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 5 },
          end: { x: margin + leftColumnWidth, y: leftColumnY - 5 },
          thickness: 1,
          color: textColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 5 },
          end: { x: margin + 50, y: leftColumnY - 5 },
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
      
      leftColumnY -= 25; // Increased space after header from 20
      
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
            size: 10,
            font: regularFont,
            color: accentColor,
          });
          
          // Draw the text after the bullet point
          const textAfterBullet = line.substring(1).trim();
          
          // Handle text wrapping for bullet points
          const wrappedLines = wrapText(textAfterBullet, regularFont, 9, leftColumnWidth - 10);
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: margin + 10, // Indent text after bullet point
              y: leftColumnY - (j * 12), // Add spacing between wrapped lines
              size: 9,
              font: regularFont,
              color: textColor,
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              leftColumnY -= (j * 12) + 18; // Increased space between lines from 15
            }
          }
        } 
        // Check if this is a subheader (bold text)
        else if (line.startsWith('**') && line.endsWith('**')) {
          const subheader = line.substring(2, line.length - 2);
          currentPage.drawText(subheader, {
            x: margin,
            y: leftColumnY,
            size: 10,
            font: boldFont,
            color: textColor,
          });
          leftColumnY -= 15;
        } 
        // Regular text
        else {
          // Handle text wrapping for regular text
          const wrappedLines = wrapText(line, regularFont, 9, leftColumnWidth);
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: margin,
              y: leftColumnY - (j * 12), // Add spacing between wrapped lines
              size: 9,
              font: regularFont,
              color: textColor,
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              leftColumnY -= (j * 12) + 18; // Increased space between lines from 15
            }
          }
        }
      }
      
      leftColumnY -= 15; // Add extra space between sections
      
      // Check if we need to add a new page
      if (leftColumnY < margin) {
        currentPage = doc.addPage([595, 842]);
        leftColumnY = height - margin;
        rightColumnY = height - margin;
        
        // Add page number
        const pageCount = doc.getPageCount();
        currentPage.drawText(`Page ${pageCount}`, {
          x: width - margin - 40,
          y: margin / 2,
          size: 9,
          font: regularFont,
          color: textColor,
        });
      }
    }
    
    // Draw a vertical divider between columns if using two-column layout
    if (layout !== "one-column" && leftColumnSections.length > 0 && rightColumnSections.length > 0) {
      const dividerX = margin + leftColumnWidth + (columnGap / 2);
      const topY = Math.max(height - margin - 50, height - 100);
      const bottomY = margin + 50;
      
      if (headerStyle === 'modern') {
        // Modern style: dotted line
        for (let y = topY; y >= bottomY; y -= 5) {
          currentPage.drawCircle({
            x: dividerX,
            y,
            size: 1,
            color: accentColor,
          });
        }
      } else if (headerStyle === 'traditional') {
        // Traditional style: solid line
        currentPage.drawLine({
          start: { x: dividerX, y: topY },
          end: { x: dividerX, y: bottomY },
          thickness: 1,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // Minimal style: no divider
      }
    }
    
    // Draw right column sections
    for (const section of rightColumnSections) {
      // Calculate x position based on layout
      const xPos = layout === "one-column" ? margin : margin + leftColumnWidth + columnGap;
      
      // Draw section header
      currentPage.drawText(section.title.toUpperCase(), {
        x: xPos,
        y: rightColumnY,
        size: 12,
        font: boldFont,
        color: primaryColor,
      });
      
      // Draw underline for section header based on header style
      if (headerStyle === 'traditional') {
        currentPage.drawLine({
          start: { x: xPos, y: rightColumnY - 5 },
          end: { x: xPos + rightColumnWidth, y: rightColumnY - 5 },
          thickness: 1,
          color: textColor,
        });
      } else if (headerStyle === 'modern') {
        currentPage.drawLine({
          start: { x: xPos, y: rightColumnY - 5 },
          end: { x: xPos + 50, y: rightColumnY - 5 },
          thickness: 2,
          color: accentColor,
        });
      } else if (headerStyle === 'minimal') {
        // For minimal style, use a dot instead of a line
        currentPage.drawCircle({
          x: xPos - 5,
          y: rightColumnY - 2,
          size: 3,
          color: accentColor,
        });
      }
      
      rightColumnY -= 25; // Increased space after header from 20
      
      // Draw section content
      const contentLines = section.content.split('\n');
      for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i].trim();
        if (!line) continue;
        
        // Check if this is a bullet point
        if (line.startsWith('•')) {
          // Draw bullet point with accent color
          currentPage.drawText('•', {
            x: xPos,
            y: rightColumnY,
            size: 10,
            font: regularFont,
            color: accentColor,
          });
          
          // Draw the text after the bullet point
          const textAfterBullet = line.substring(1).trim();
          
          // Handle text wrapping for bullet points
          const wrappedLines = wrapText(textAfterBullet, regularFont, 9, rightColumnWidth - 10);
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: xPos + 10, // Indent text after bullet point
              y: rightColumnY - (j * 12), // Add spacing between wrapped lines
              size: 9,
              font: regularFont,
              color: textColor,
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              rightColumnY -= (j * 12) + 18; // Increased space between lines from 15
            }
          }
        } 
        // Check if this is a subheader (bold text)
        else if (line.startsWith('**') && line.endsWith('**')) {
          const subheader = line.substring(2, line.length - 2);
          currentPage.drawText(subheader, {
            x: xPos,
            y: rightColumnY,
            size: 10,
            font: boldFont,
            color: textColor,
          });
          rightColumnY -= 15;
        } 
        // Regular text
        else {
          // Handle text wrapping for regular text
          const wrappedLines = wrapText(line, regularFont, 9, rightColumnWidth);
          for (let j = 0; j < wrappedLines.length; j++) {
            const wrappedLine = wrappedLines[j];
            currentPage.drawText(wrappedLine, {
              x: xPos,
              y: rightColumnY - (j * 12), // Add spacing between wrapped lines
              size: 9,
              font: regularFont,
              color: textColor,
            });
            
            // Only adjust Y position after all wrapped lines are drawn
            if (j === wrappedLines.length - 1) {
              rightColumnY -= (j * 12) + 18; // Increased space between lines from 15
            }
          }
        }
      }
      
      rightColumnY -= 15; // Add extra space between sections
      
      // Check if we need to add a new page
      if (rightColumnY < margin) {
        currentPage = doc.addPage([595, 842]);
        leftColumnY = height - margin;
        rightColumnY = height - margin;
        
        // Add page number
        const pageCount = doc.getPageCount();
        currentPage.drawText(`Page ${pageCount}`, {
          x: width - margin - 40,
          y: margin / 2,
          size: 9,
          font: regularFont,
          color: textColor,
        });
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
    
    // Add a footer with page number
    currentPage.drawText(`Page ${doc.getPageCount()}`, {
      x: width - margin - 40,
      y: margin / 2,
      size: 8,
      font: regularFont,
      color: accentColor,
    });
    
    // Serialize the PDFDocument to bytes
    const pdfBytes = await doc.save();
    console.log("PDF generation completed successfully");
    return pdfBytes;
  } catch (error: any) {
    console.error("Error generating PDF:", error.message);
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

