import { PDFDocument } from "pdf-lib";

/**
 * Extracts text from a PDF document.
 * @param pdfBytes - The PDF file as a byte array.
 * @returns The extracted text.
 */
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  // This is a placeholder. In a real implementation, you would use a PDF text extraction library.
  // For example, pdf.js or a server-side solution.
  return "Sample extracted text with Experience section";
}

/**
 * Identifies key section coordinates based on a dynamic template analysis.
 * @param extractedText - The full extracted text from the PDF.
 * @returns An object with section-specific coordinates.
 */
export function identifySectionCoordinates(extractedText: string): Record<string, number> | null {
  if (!extractedText || extractedText.trim().length === 0) {
    console.error("No text extracted from PDF for section coordinate identification");
    return null;
  }
  
  console.log("Identifying section coordinates from extracted text");
  
  // Initialize coordinates object with default positions
  const coordinates: Record<string, number> = {};
  
  // Define common section names to look for
  const sectionPatterns = [
    { name: 'Profile', regex: /\b(profile|summary|about|objective)\b/i, defaultY: 700 },
    { name: 'Experience', regex: /\b(experience|work|employment|career)\b/i, defaultY: 550 },
    { name: 'Education', regex: /\b(education|academic|qualifications|degree)\b/i, defaultY: 400 },
    { name: 'Skills', regex: /\b(skills|abilities|competencies|expertise)\b/i, defaultY: 300 },
    { name: 'Languages', regex: /\b(languages|language proficiency)\b/i, defaultY: 200 },
    { name: 'Contact', regex: /\b(contact|email|phone|address)\b/i, defaultY: 650 },
    { name: 'Projects', regex: /\b(projects|portfolio|achievements)\b/i, defaultY: 250 },
    { name: 'Certifications', regex: /\b(certifications|certificates|qualifications)\b/i, defaultY: 150 }
  ];
  
  // Split text into lines for analysis
  const lines = extractedText.split('\n');
  
  // Track the vertical position (approximate)
  let currentY = 750; // Start near the top of the page
  const lineHeight = 15; // Approximate line height
  
  // Analyze each line to find section headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // Decrement Y position for each line (simulating moving down the page)
    currentY -= lineHeight;
    
    // Check if this line looks like a section header
    if (line.length < 40 && (line === line.toUpperCase() || line.endsWith(':'))) {
      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(line)) {
          // Found a section header, store its approximate Y position
          coordinates[pattern.name] = currentY;
          console.log(`Found "${pattern.name}" section at approximate Y: ${currentY}`);
          break;
        }
      }
    }
  }
  
  // If we didn't find any sections, use default positions
  if (Object.keys(coordinates).length === 0) {
    console.log("No sections found in text, using default positions");
    sectionPatterns.forEach(pattern => {
      coordinates[pattern.name] = pattern.defaultY;
    });
  }
  
  return coordinates;
}

/**
 * Combines text extraction and template matching to determine where to overlay content.
 * @param pdfBytes - The original PDF bytes.
 * @returns An object with section-specific overlay coordinates.
 */
export async function getOverlayCoordinates(pdfBytes: Uint8Array): Promise<Record<string, number> | null> {
  try {
    const text = await extractTextFromPdf(pdfBytes);
    return identifySectionCoordinates(text);
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return null;
  }
}

/**
 * Gets template-specific layout information based on the template ID.
 * @param templateId - The ID of the CV template.
 * @returns Layout information for the template.
 */
export function getTemplateLayout(templateId: string): {
  sidebarWidth: number;
  mainColumnWidth: number;
  sectionSpacing: number;
  headerStyle: 'modern' | 'traditional' | 'minimal';
} {
  // Default layout
  const defaultLayout = {
    sidebarWidth: 180,
    mainColumnWidth: 380,
    sectionSpacing: 20,
    headerStyle: 'modern' as 'modern' | 'traditional' | 'minimal'
  };
  
  // Template-specific layouts
  const templateLayouts: Record<string, typeof defaultLayout> = {
    // Company templates (new format)
    'google-modern': {
      sidebarWidth: 180,
      mainColumnWidth: 380,
      sectionSpacing: 20,
      headerStyle: 'modern'
    },
    'meta-impact': {
      sidebarWidth: 160,
      mainColumnWidth: 400,
      sectionSpacing: 25,
      headerStyle: 'modern'
    },
    'apple-minimal': {
      sidebarWidth: 180,
      mainColumnWidth: 380,
      sectionSpacing: 20,
      headerStyle: 'minimal'
    },
    'amazon-leadership': {
      sidebarWidth: 190,
      mainColumnWidth: 370,
      sectionSpacing: 15,
      headerStyle: 'traditional'
    },
    'microsoft-professional': {
      sidebarWidth: 170,
      mainColumnWidth: 390,
      sectionSpacing: 20,
      headerStyle: 'modern'
    },
    'jpmorgan-finance': {
      sidebarWidth: 160,
      mainColumnWidth: 400,
      sectionSpacing: 15,
      headerStyle: 'traditional'
    },
    'netflix-creative': {
      sidebarWidth: 150,
      mainColumnWidth: 410,
      sectionSpacing: 25,
      headerStyle: 'modern'
    },

    // Legacy templates (old format) - for backward compatibility
    'professional': {
      sidebarWidth: 180,
      mainColumnWidth: 380,
      sectionSpacing: 20,
      headerStyle: 'traditional'
    },
    'modern': {
      sidebarWidth: 160,
      mainColumnWidth: 400,
      sectionSpacing: 25,
      headerStyle: 'modern'
    },
    'creative': {
      sidebarWidth: 150,
      mainColumnWidth: 410,
      sectionSpacing: 30,
      headerStyle: 'minimal'
    },
    'executive': {
      sidebarWidth: 190,
      mainColumnWidth: 370,
      sectionSpacing: 15,
      headerStyle: 'traditional'
    },
    'technical': {
      sidebarWidth: 170,
      mainColumnWidth: 390,
      sectionSpacing: 20,
      headerStyle: 'modern'
    }
  };
  
  // If the template doesn't exist, try to use a closest match based on the name
  if (!templateLayouts[templateId]) {
    console.warn(`Template ID "${templateId}" not found. Looking for closest match...`);
    
    // Check if it contains certain keywords
    if (templateId.includes('google') || templateId.includes('modern')) {
      return templateLayouts['google-modern'];
    } else if (templateId.includes('amazon') || templateId.includes('leadership')) {
      return templateLayouts['amazon-leadership'];
    } else if (templateId.includes('apple') || templateId.includes('minimal')) {
      return templateLayouts['apple-minimal'];
    } else if (templateId.includes('meta') || templateId.includes('facebook') || templateId.includes('impact')) {
      return templateLayouts['meta-impact'];
    } else if (templateId.includes('microsoft') || templateId.includes('professional')) {
      return templateLayouts['microsoft-professional'];
    } else if (templateId.includes('jp') || templateId.includes('morgan') || templateId.includes('finance')) {
      return templateLayouts['jpmorgan-finance'];
    } else if (templateId.includes('netflix') || templateId.includes('creative')) {
      return templateLayouts['netflix-creative'];
    }
  }
  
  console.log(`Using template layout for: ${templateId in templateLayouts ? templateId : 'default'}`);
  return templateLayouts[templateId] || defaultLayout;
}
