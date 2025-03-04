import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { getOverlayCoordinates } from "./templateMatching";
import { CVTemplate } from "@/types/templates";
import { Buffer } from "buffer";

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
 * Creates a new PDF with optimized content
 */
export async function modifyPDFWithOptimizedContent(
  optimizedText: string,
  rawText: string,
  template?: CVTemplate
): Promise<Buffer> {
  console.log("Starting PDF generation with optimized content");
  
  // Debug check: verify that optimizedText is not empty
  if (!optimizedText || optimizedText.trim().length === 0) {
    console.error("ERROR: Empty optimizedText provided to modifyPDFWithOptimizedContent");
    
    // Fallback to rawText if available
    if (rawText && rawText.trim().length > 0) {
      console.log("Using rawText as fallback for PDF generation");
      optimizedText = rawText;
    } else {
      throw new Error("No content available for PDF generation");
    }
  }
  
  // Log the length of the optimizedText for debugging
  console.log(`Optimized text length: ${optimizedText.length} characters`);
  console.log(`First 200 characters: ${optimizedText.substring(0, 200)}...`);
  
  // Parse the optimizedText into sections
  const { leftColumnSections, rightColumnSections } = parseOptimizedText(optimizedText);
  
  // Log the number of sections parsed
  console.log(`Parsed ${leftColumnSections.length} left column sections and ${rightColumnSections.length} right column sections`);
  
  // Log character count for each section for debugging
  leftColumnSections.forEach(section => {
    console.log(`Left column section "${section.title}": ${section.content.length} characters`);
  });
  
  rightColumnSections.forEach(section => {
    console.log(`Right column section "${section.title}": ${section.content.length} characters`);
  });
  
  // Sanity check: if total content is minimal, use rawText as fallback
  const totalContentLength = 
    leftColumnSections.reduce((sum, section) => sum + section.content.length, 0) +
    rightColumnSections.reduce((sum, section) => sum + section.content.length, 0);
  
  if (totalContentLength < 100 && rawText && rawText.length > 0) {
    console.warn("WARNING: Minimal content detected, using rawText as fallback");
    const { leftColumnSections: fallbackLeft, rightColumnSections: fallbackRight } = parseOptimizedText(rawText);
    
    // Only use fallback if it has more content
    const fallbackContentLength = 
      fallbackLeft.reduce((sum, section) => sum + section.content.length, 0) +
      fallbackRight.reduce((sum, section) => sum + section.content.length, 0);
    
    if (fallbackContentLength > totalContentLength) {
      console.log(`Using fallback content with ${fallbackContentLength} characters`);
      return createPDFWithSections(fallbackLeft, fallbackRight, rawText, template);
    }
  }
  
  // Create PDF with the parsed sections
  return createPDFWithSections(leftColumnSections, rightColumnSections, rawText, template);
}

async function createPDFWithSections(
  leftColumnSections: Section[],
  rightColumnSections: Section[],
  rawText: string,
  template?: CVTemplate
): Promise<Buffer> {
  try {
    // Create a new PDF document
    const doc = await PDFDocument.create();
    
    // Embed fonts
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    let titleFont = boldFont;
    let bodyFont = regularFont;
    
    // Try to load template-specific fonts if available
    if (template?.metadata?.preferredFonts) {
      try {
        const preferredFonts = template.metadata.preferredFonts;
        
        // Use Times Roman for more traditional templates
        if (preferredFonts.includes('Times') || preferredFonts.includes('Serif')) {
          titleFont = await doc.embedFont(StandardFonts.TimesRomanBold);
          bodyFont = await doc.embedFont(StandardFonts.TimesRoman);
          console.log("Using Times Roman fonts for template");
        }
        
        // Use Courier for monospaced templates
        if (preferredFonts.includes('Courier') || preferredFonts.includes('Monospace')) {
          titleFont = await doc.embedFont(StandardFonts.CourierBold);
          bodyFont = await doc.embedFont(StandardFonts.Courier);
          console.log("Using Courier fonts for template");
        }
      } catch (error: any) {
        console.warn("Could not load preferred fonts:", error.message);
        // Continue with default fonts
      }
    }
    
    // Define default brand colors
    let primaryColor = rgb(0.2, 0.4, 0.6); // Default blue
    let secondaryColor = rgb(0.8, 0.8, 0.8); // Default light gray
    let textColor = rgb(0.1, 0.1, 0.1); // Near black
    let accentColor = rgb(0.4, 0.6, 0.8); // Light blue
    
    // If template is provided, try to apply template-specific colors
    if (template && template.metadata && template.metadata.colorScheme) {
      try {
        const colorScheme = template.metadata.colorScheme;
        
        if (colorScheme.primary) {
          const { r, g, b } = hexToRgb(colorScheme.primary);
          primaryColor = rgb(r/255, g/255, b/255);
        }
        
        if (colorScheme.secondary) {
          const { r, g, b } = hexToRgb(colorScheme.secondary);
          secondaryColor = rgb(r/255, g/255, b/255);
        }
        
        if (colorScheme.text) {
          const { r, g, b } = hexToRgb(colorScheme.text);
          textColor = rgb(r/255, g/255, b/255);
        }
        
        if (colorScheme.accent) {
          const { r, g, b } = hexToRgb(colorScheme.accent);
          accentColor = rgb(r/255, g/255, b/255);
        }
        
        console.log(`Applied color scheme from template: ${template.name}`);
      } catch (error: any) {
        console.error("Error applying template colors:", error.message);
        // Continue with default colors
      }
    }
    
    // Determine layout based on template
    let layout = "two-column"; // Default layout
    if (template?.metadata?.layout) {
      layout = template.metadata.layout;
      console.log(`Using template layout: ${layout}`);
    }
    
    // Add a page to the document
    let currentPage = doc.addPage([595, 842]); // A4 size
    const { width, height } = currentPage.getSize();
    
    // Define margins - increase for more whitespace
    const margin = 60; // Increased from 50
    const columnGap = 30; // Increased from 20
    
    // Define starting positions
    let leftColumnY = height - margin;
    let rightColumnY = height - margin;
    
    // Add a modern header bar
    if (layout !== "traditional") {
      // Add a colored header bar at the top
      currentPage.drawRectangle({
        x: 0,
        y: height - 20,
        width: width,
        height: 20,
        color: primaryColor,
      });
      
      // Try to extract name and contact info for a modern header
      try {
        // Extract name from first line of raw text
        const lines = rawText.split('\n');
        const name = lines[0].trim();
        
        // Look for contact info in the first few lines
        let contactInfo = '';
        for (let i = 1; i < Math.min(10, lines.length); i++) {
          const line = lines[i].trim();
          if (line.includes('@') || line.includes('phone') || line.includes('tel') || 
              /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)) { // Simple phone regex
            contactInfo += line + ' | ';
          }
        }
        
        if (contactInfo.endsWith(' | ')) {
          contactInfo = contactInfo.substring(0, contactInfo.length - 3);
        }
        
        // Draw name in large font below the header bar
        if (name) {
          const nameWidth = titleFont.widthOfTextAtSize(name.toUpperCase(), 20);
          currentPage.drawText(name.toUpperCase(), {
            x: (width - nameWidth) / 2,
            y: height - margin,
            size: 20,
            font: titleFont,
            color: primaryColor,
          });
          
          // Draw contact info below name
          if (contactInfo) {
            const contactWidth = regularFont.widthOfTextAtSize(contactInfo, 10);
            currentPage.drawText(contactInfo, {
              x: (width - contactWidth) / 2,
              y: height - margin - 25,
              size: 10,
              font: regularFont,
              color: textColor,
            });
            
            // Adjust starting positions
            leftColumnY = height - margin - 50;
            rightColumnY = height - margin - 50;
          } else {
            // Adjust starting positions
            leftColumnY = height - margin - 30;
            rightColumnY = height - margin - 30;
          }
        }
      } catch (error: any) {
        console.warn("Error adding modern header:", error.message);
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
      rightColumnSections = [...leftColumnSections, ...rightColumnSections];
      leftColumnSections = [];
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
        size: 14, // Increased from 12
        font: titleFont,
        color: primaryColor,
      });
      
      // Add underline or background for section header
      if (layout === "traditional") {
        currentPage.drawLine({
          start: { x: margin, y: leftColumnY - 5 },
          end: { x: margin + leftColumnWidth * 0.8, y: leftColumnY - 5 },
          thickness: 1.5, // Increased from 1
          color: accentColor,
        });
      } else {
        // Modern style: add a subtle background rectangle for the header
        currentPage.drawRectangle({
          x: margin - 5,
          y: leftColumnY - 15,
          width: leftColumnWidth + 5,
          height: 20,
          color: rgb(primaryColor.red * 0.95, primaryColor.green * 0.95, primaryColor.blue * 0.95),
          borderColor: accentColor,
          borderWidth: 0.5,
          borderOpacity: 0.3,
        });
      }
      
      leftColumnY -= 25; // Increased space after header from 20
      
      // Draw section content
      const contentLines = section.content.split('\n');
      for (const line of contentLines) {
        if (line.trim().length === 0) continue;
        
        // Check if line is a bullet point
        if (line.trim().startsWith('•')) {
          // Draw bullet point with improved styling
          currentPage.drawText('•', {
            x: margin,
            y: leftColumnY,
            size: 10,
            font: bodyFont,
            color: accentColor, // Use accent color for bullets
          });
          
          // Draw the text after the bullet
          const bulletText = line.trim().substring(1).trim();
          currentPage.drawText(bulletText, {
            x: margin + 10, // Indent bullet points
            y: leftColumnY,
            size: 10,
            font: bodyFont,
            color: textColor,
            maxWidth: leftColumnWidth - 10,
          });
        } else if (line.trim().startsWith('<strong>') && line.trim().endsWith('</strong>')) {
          // Draw subheader (bold text) with improved styling
          const subheaderText = line.replace('<strong>', '').replace('</strong>', '').trim();
          
          // Add a subtle highlight for subheaders
          if (layout === "modern") {
            currentPage.drawRectangle({
              x: margin - 2,
              y: leftColumnY - 12,
              width: leftColumnWidth,
              height: 14,
              color: rgb(accentColor.red * 0.95, accentColor.green * 0.95, accentColor.blue * 0.95),
              opacity: 0.1,
            });
          }
          
          currentPage.drawText(subheaderText, {
            x: margin,
            y: leftColumnY,
            size: 11,
            font: titleFont,
            color: primaryColor, // Use primary color for subheaders
            maxWidth: leftColumnWidth,
          });
        } else {
          // Draw regular text
          currentPage.drawText(line, {
            x: margin,
            y: leftColumnY,
            size: 10,
            font: bodyFont,
            color: textColor,
            maxWidth: leftColumnWidth,
          });
        }
        
        leftColumnY -= 18; // Increased space between lines from 15
        
        // Add a new page if we're near the bottom
        if (leftColumnY < margin) {
          // Add column divider if using two-column layout
          if (layout !== "one-column") {
            currentPage.drawLine({
              start: { x: margin + leftColumnWidth + columnGap/2, y: height - margin },
              end: { x: margin + leftColumnWidth + columnGap/2, y: margin },
              thickness: 1,
              color: secondaryColor,
            });
          }
          
          // Add new page
          currentPage = doc.addPage([595, 842]);
          leftColumnY = height - margin;
          rightColumnY = height - margin;
        }
      }
      
      leftColumnY -= 15; // Add extra space between sections
    }
    
    // Draw right column sections
    for (const section of rightColumnSections) {
      const xPosition = margin + (layout === "one-column" ? 0 : leftColumnWidth + columnGap);
      
      // Draw section header
      currentPage.drawText(section.title.toUpperCase(), {
        x: xPosition,
        y: rightColumnY,
        size: 14, // Increased from 12
        font: titleFont,
        color: primaryColor,
      });
      
      // Add underline or background for section header
      if (layout === "traditional") {
        currentPage.drawLine({
          start: { x: xPosition, y: rightColumnY - 5 },
          end: { x: xPosition + rightColumnWidth * 0.8, y: rightColumnY - 5 },
          thickness: 1.5, // Increased from 1
          color: accentColor,
        });
      } else {
        // Modern style: add a subtle background rectangle for the header
        currentPage.drawRectangle({
          x: xPosition - 5,
          y: rightColumnY - 15,
          width: rightColumnWidth + 5,
          height: 20,
          color: rgb(primaryColor.red * 0.95, primaryColor.green * 0.95, primaryColor.blue * 0.95),
          borderColor: accentColor,
          borderWidth: 0.5,
          borderOpacity: 0.3,
        });
      }
      
      rightColumnY -= 25; // Increased space after header from 20
      
      // Draw section content
      const contentLines = section.content.split('\n');
      for (const line of contentLines) {
        if (line.trim().length === 0) continue;
        
        // Check if line is a bullet point
        if (line.trim().startsWith('•')) {
          // Draw bullet point with improved styling
          currentPage.drawText('•', {
            x: xPosition,
            y: rightColumnY,
            size: 10,
            font: bodyFont,
            color: accentColor, // Use accent color for bullets
          });
          
          // Draw the text after the bullet
          const bulletText = line.trim().substring(1).trim();
          currentPage.drawText(bulletText, {
            x: xPosition + 10, // Indent bullet points
            y: rightColumnY,
            size: 10,
            font: bodyFont,
            color: textColor,
            maxWidth: rightColumnWidth - 10,
          });
        } else if (line.trim().startsWith('<strong>') && line.trim().endsWith('</strong>')) {
          // Draw subheader (bold text) with improved styling
          const subheaderText = line.replace('<strong>', '').replace('</strong>', '').trim();
          
          // Add a subtle highlight for subheaders
          if (layout === "modern") {
            currentPage.drawRectangle({
              x: xPosition - 2,
              y: rightColumnY - 12,
              width: rightColumnWidth,
              height: 14,
              color: rgb(accentColor.red * 0.95, accentColor.green * 0.95, accentColor.blue * 0.95),
              opacity: 0.1,
            });
          }
          
          currentPage.drawText(subheaderText, {
            x: xPosition,
            y: rightColumnY,
            size: 11,
            font: titleFont,
            color: primaryColor, // Use primary color for subheaders
            maxWidth: rightColumnWidth,
          });
        } else {
          // Draw regular text
          currentPage.drawText(line, {
            x: xPosition,
            y: rightColumnY,
            size: 10,
            font: bodyFont,
            color: textColor,
            maxWidth: rightColumnWidth,
          });
        }
        
        rightColumnY -= 18; // Increased space between lines from 15
        
        // Add a new page if we're near the bottom
        if (rightColumnY < margin) {
          // Add column divider if using two-column layout
          if (layout !== "one-column") {
            currentPage.drawLine({
              start: { x: margin + leftColumnWidth + columnGap/2, y: height - margin },
              end: { x: margin + leftColumnWidth + columnGap/2, y: margin },
              thickness: 1,
              color: secondaryColor,
            });
          }
          
          // Add new page
          currentPage = doc.addPage([595, 842]);
          leftColumnY = height - margin;
          rightColumnY = height - margin;
        }
      }
      
      rightColumnY -= 15; // Add extra space between sections
    }
    
    // Draw a line between columns on the last page if using two-column layout
    if (layout !== "one-column") {
      currentPage.drawLine({
        start: { x: margin + leftColumnWidth + columnGap/2, y: height - margin },
        end: { x: margin + leftColumnWidth + columnGap/2, y: margin },
        thickness: 1,
        color: secondaryColor,
      });
    }
    
    // Add column divider if using two-column layout
    if (layout !== "one-column") {
      // Draw a more stylish column divider
      if (layout === "modern") {
        // For modern layout, use a gradient-like effect with multiple lines
        const dividerX = margin + leftColumnWidth + columnGap/2;
        const dividerColors = [
          { color: secondaryColor, opacity: 0.2 },
          { color: secondaryColor, opacity: 0.5 },
          { color: secondaryColor, opacity: 0.8 },
          { color: accentColor, opacity: 0.5 },
          { color: secondaryColor, opacity: 0.8 },
          { color: secondaryColor, opacity: 0.5 },
          { color: secondaryColor, opacity: 0.2 },
        ];
        
        dividerColors.forEach((style, index) => {
          const offset = (index - 3) * 0.5; // Center the accent color
          currentPage.drawLine({
            start: { x: dividerX + offset, y: height - margin },
            end: { x: dividerX + offset, y: margin },
            thickness: 0.5,
            color: style.color,
            opacity: style.opacity,
          });
        });
      } else {
        // For traditional layout, use a simple line
        currentPage.drawLine({
          start: { x: margin + leftColumnWidth + columnGap/2, y: height - margin },
          end: { x: margin + leftColumnWidth + columnGap/2, y: margin },
          thickness: 1,
          color: secondaryColor,
        });
      }
    }
    
    // Add page number at the bottom
    const pageCount = doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      
      // Add page number
      const pageText = `Page ${i + 1} of ${pageCount}`;
      const textWidth = regularFont.widthOfTextAtSize(pageText, 8);
      
      page.drawText(pageText, {
        x: (width - textWidth) / 2,
        y: margin / 3,
        size: 8,
        font: regularFont,
        color: textColor,
        opacity: 0.7,
      });
    }
    
    // Serialize the PDFDocument to bytes
    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
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
