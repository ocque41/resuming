// lib/optimizeCV.ts
import { CVTemplate } from "@/types/templates";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";
import { PDFDocument } from "pdf-lib";
import { getTemplateLayout } from "./templateMatching";

export async function optimizeCV(
  cvText: string,
  template?: CVTemplate
): Promise<{ optimizedText: string; error?: string }> {
  try {
    console.log("Starting CV optimization process");
    
    // Input validation - address possible issues early
    if (!cvText || cvText.trim().length === 0) {
      console.error("Empty CV text provided to optimization");
      return { 
        optimizedText: "", 
        error: "Empty CV text provided" 
      };
    }
    
    // Get template layout if available
    let layout = 'two-column';
    let headerStyle = 'modern';
    
    if (template) {
      console.log(`Using template: ${template.name}`);
      
      // Get layout from template metadata
      layout = template.metadata?.layout || layout;
      
      // Get template-specific layout from templateMatching
      const templateLayout = getTemplateLayout(template.id);
      headerStyle = templateLayout.headerStyle || headerStyle;
    }
    
    // Customize prompt based on template
    let formattingInstructions = "";
    
    if (layout === 'one-column') {
      formattingInstructions = `
        Format the CV as a single-column document with clear section headers.
        Use bullet points for achievements and responsibilities.
        Keep all text black.
        Ensure the CV fits on a single page.
      `;
    } else if (layout === 'two-column') {
      formattingInstructions = `
        Format the CV with a main column and a sidebar.
        Put contact information, skills, languages, and education in the sidebar.
        Put professional experience, projects, and other details in the main column.
        Use bullet points for achievements and responsibilities.
        Keep all text black.
        Ensure the CV fits on a single page.
      `;
    }
    
    console.log("Calling OpenAI API for CV optimization");
    
    // For testing purposes, create a dummy result if the API isn't available
    // Remove this in production
    if (process.env.NODE_ENV === 'development' && process.env.MOCK_API === 'true') {
      console.log("Using mock data for development");
      return {
        optimizedText: createOptimizedCV(cvText, template?.name || 'default'),
      };
    }
    
    try {
      // This is where you'd call your AI service (OpenAI, etc.)
      // For this implementation, we'll create an optimized version locally
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvText,
          templateId: template?.id || 'default',
          formattingInstructions,
        }),
        signal: AbortSignal.timeout(30000), // 30-second timeout
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Optimization API error: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.optimizedCV) {
        throw new Error("No optimized CV in API response");
      }
      
      return {
        optimizedText: result.optimizedCV,
      };
    } catch (apiError) {
      console.error("API error during optimization:", apiError);
      
      // As a fallback for demo purposes, create a simple optimized version
      console.log("Using fallback optimization method");
      return {
        optimizedText: createOptimizedCV(cvText, template?.name || 'default'),
        error: `API error: ${(apiError as Error).message}. Using fallback optimization.`
      };
    }
  } catch (error) {
    console.error("Error in optimization process:", error);
    
    // Always return something, even in error cases
    return {
      optimizedText: cvText, // Return original text as fallback
      error: `Optimization failed: ${(error as Error).message}`
    };
  }
}

// Fallback function to create an optimized CV when API fails
// This ensures the process doesn't get stuck
function createOptimizedCV(originalText: string, templateName: string): string {
  const sections = extractSections(originalText);
  
  // Create a more structured CV
  let optimizedCV = `# PROFESSIONAL CV
## Updated with ${templateName.toUpperCase()} template

`;

  // Add contact section if found
  if (sections.contact) {
    optimizedCV += `## CONTACT INFORMATION
${sections.contact.trim()}

`;
  }

  // Add profile/summary if found
  if (sections.profile) {
    optimizedCV += `## PROFESSIONAL SUMMARY
${improveSection(sections.profile, 'summary')}

`;
  }

  // Add experience if found
  if (sections.experience) {
    optimizedCV += `## PROFESSIONAL EXPERIENCE
${improveSection(sections.experience, 'experience')}

`;
  }

  // Add education if found
  if (sections.education) {
    optimizedCV += `## EDUCATION
${improveSection(sections.education, 'education')}

`;
  }

  // Add skills if found
  if (sections.skills) {
    optimizedCV += `## SKILLS
${improveSection(sections.skills, 'skills')}

`;
  }

  // Add any additional sections
  for (const [key, value] of Object.entries(sections)) {
    if (!['contact', 'profile', 'experience', 'education', 'skills'].includes(key) && value.trim()) {
      optimizedCV += `## ${key.toUpperCase()}
${value.trim()}

`;
    }
  }

  return optimizedCV;
}

// Helper functions for the fallback optimization
function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {
    contact: '',
    profile: '',
    experience: '',
    education: '',
    skills: ''
  };
  
  // Simple parsing logic - in real app would be more sophisticated
  const lines = text.split('\n');
  let currentSection = 'profile';
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('email') || lowerLine.includes('phone') || lowerLine.includes('address')) {
      sections.contact += line + '\n';
    } else if (lowerLine.includes('experience') || lowerLine.includes('work')) {
      currentSection = 'experience';
    } else if (lowerLine.includes('education') || lowerLine.includes('university')) {
      currentSection = 'education';
    } else if (lowerLine.includes('skills') || lowerLine.includes('abilities')) {
      currentSection = 'skills';
    } else if (lowerLine.includes('profile') || lowerLine.includes('summary') || lowerLine.includes('objective')) {
      currentSection = 'profile';
    } else {
      sections[currentSection] += line + '\n';
    }
  }
  
  return sections;
}

function improveSection(text: string, sectionType: string): string {
  // Simple enhancements
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Add bullets to lines that don't have them
  const bulletedLines = lines.map(line => {
    if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      return line;
    }
    return '• ' + line;
  });
  
  return bulletedLines.join('\n');
}

// Process any formatting markers in the optimized text
function processFormattingMarkers(text: string): string {
  // Remove any "CONTENT" title
  text = text.replace(/^CONTENT\s*$/m, '');
  
  // Remove any column markers
  text = text.replace(/\[LEFT COLUMN END\]/g, '')
    .replace(/\[RIGHT COLUMN START\]/g, '')
    .replace(/\[LEFT-COLUMN-START\]/g, '')
    .replace(/\[LEFT-COLUMN-END\]/g, '')
    .replace(/\[RIGHT-COLUMN-START\]/g, '')
    .replace(/\[RIGHT-COLUMN-END\]/g, '');
  
  // Remove placeholder text for missing sections
  text = text.replace(/\*No previous work experience provided on the original CV\*/g, '')
    .replace(/\*No education information provided on the original CV\*/g, '')
    .replace(/\*No skills information provided on the original CV\*/g, '')
    .replace(/\*No projects information provided on the original CV\*/g, '')
    .replace(/\*No.*?provided.*?\*/g, ''); // Remove any other "No X provided" messages
  
  return text;
}

// Helper function to extract potential sections from raw CV text
function extractPotentialSections(rawText: string): string[] {
  // Common section headers in CVs
  const commonSectionHeaders = [
    "EDUCATION", "EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT", "SKILLS",
    "TECHNICAL SKILLS", "PROFESSIONAL EXPERIENCE", "PROJECTS", "CERTIFICATIONS",
    "ACHIEVEMENTS", "LANGUAGES", "INTERESTS", "SUMMARY", "PROFILE", "OBJECTIVE",
    "PROFESSIONAL SUMMARY", "QUALIFICATIONS", "PUBLICATIONS", "REFERENCES"
  ];
  
  // Split the text into lines
  const lines = rawText.split('\n');
  const potentialSections: string[] = [];
  
  // Look for lines that might be section headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if the line is all uppercase or matches common section headers
    if (
      line === line.toUpperCase() || 
      commonSectionHeaders.some(header => 
        line.toUpperCase().includes(header) || 
        line.toUpperCase().startsWith(header)
      )
    ) {
      // Get the content of this section (until the next potential section header)
      let sectionContent = line;
      let j = i + 1;
      
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        
        // Stop if we hit another potential section header
        if (
          nextLine === nextLine.toUpperCase() && 
          nextLine.length > 3 && 
          commonSectionHeaders.some(header => 
            nextLine.toUpperCase().includes(header) || 
            nextLine.toUpperCase().startsWith(header)
          )
        ) {
          break;
        }
        
        sectionContent += '\n' + nextLine;
        j++;
      }
      
      potentialSections.push(sectionContent);
    }
  }
  
  return potentialSections;
}

// Helper function to verify that key content has been preserved
function verifyContentPreservation(originalText: string, optimizedText: string): { 
  preserved: boolean; 
  missingItems: string[] 
} {
  const missingItems: string[] = [];
  
  // Extract key information from the original text
  const originalLines = originalText.split('\n');
  
  // Check for name (usually at the top)
  const potentialName = originalLines[0]?.trim();
  if (potentialName && potentialName.length > 0 && !optimizedText.includes(potentialName)) {
    missingItems.push('Name');
  }
  
  // Check for contact information (email, phone)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
  
  const originalEmails = originalText.match(emailRegex) || [];
  const originalPhones = originalText.match(phoneRegex) || [];
  
  const optimizedEmails = optimizedText.match(emailRegex) || [];
  const optimizedPhones = optimizedText.match(phoneRegex) || [];
  
  if (originalEmails.length > 0 && optimizedEmails.length === 0) {
    missingItems.push('Email');
  }
  
  if (originalPhones.length > 0 && optimizedPhones.length === 0) {
    missingItems.push('Phone');
  }
  
  // Check for key sections
  const keySections = ['education', 'experience', 'skills'];
  
  for (const section of keySections) {
    const sectionRegex = new RegExp(`\\b${section}\\b`, 'i');
    if (sectionRegex.test(originalText) && !sectionRegex.test(optimizedText)) {
      missingItems.push(`${section.charAt(0).toUpperCase() + section.slice(1)} section`);
    }
  }
  
  // Check for company names and job titles (more complex, simplified approach)
  const potentialCompanies = extractPotentialSections(originalText)
    .filter(section => /experience|employment/i.test(section))
    .flatMap(section => {
      const lines = section.split('\n');
      return lines.filter(line => 
        line.length > 0 && 
        !line.match(/^\s*•/) && // Not a bullet point
        !line.match(/^\d{4}/) && // Not a year
        line !== line.toUpperCase() // Not all uppercase (likely not a section header)
      );
    });
  
  // Check if at least some company names are preserved
  if (potentialCompanies.length > 0) {
    let companiesFound = false;
    for (const company of potentialCompanies) {
      if (optimizedText.includes(company)) {
        companiesFound = true;
        break;
      }
    }
    
    if (!companiesFound) {
      missingItems.push('Company names');
    }
  }
  
  return {
    preserved: missingItems.length === 0,
    missingItems
  };
}

// Helper function to create a formatted fallback from raw text
function createFormattedFallbackFromRawText(rawText: string): string {
  // Split the text into lines
  const lines = rawText.split('\n');
  let formattedText = '';
  
  // Identify potential sections
  const sections = extractPotentialSections(rawText);
  
  // If we couldn't identify sections, apply basic formatting
  if (sections.length === 0) {
    // Assume the first line is the name
    if (lines.length > 0) {
      formattedText += `**${lines[0].trim()}**\n\n`;
    }
    
    // Look for contact information
    const contactLines = lines.slice(1, 5).filter(line => 
      line.includes('@') || // Email
      line.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/) || // Phone
      line.includes('linkedin.com') // LinkedIn
    );
    
    if (contactLines.length > 0) {
      formattedText += contactLines.join('\n') + '\n\n';
    }
    
    // Add a summary section
    formattedText += "**Professional Summary**\n\n";
    
    // Add an experience section
    formattedText += "**Work Experience**\n\n";
    
    // Add remaining content with some basic formatting
    const remainingLines = lines.slice(5);
    let inBulletSection = false;
    
    for (const line of remainingLines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.length === 0) {
        formattedText += '\n';
        inBulletSection = false;
      } else if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
        // Potential section header
        formattedText += `\n**${trimmedLine}**\n`;
        inBulletSection = false;
      } else if (trimmedLine.match(/^\d{4}/) || trimmedLine.includes(' - ')) {
        // Potential date range or job title
        formattedText += `\n**${trimmedLine}**\n`;
        inBulletSection = false;
      } else {
        // Regular content, add bullet points for readability
        if (!inBulletSection) {
          formattedText += '• ' + trimmedLine + '\n';
          inBulletSection = true;
        } else {
          formattedText += '• ' + trimmedLine + '\n';
        }
      }
    }
    
    return formattedText;
  }
  
  // Process identified sections
  for (const section of sections) {
    const sectionLines = section.split('\n');
    const sectionHeader = sectionLines[0].trim();
    
    // Add formatted section header
    formattedText += `**${sectionHeader}**\n\n`;
    
    // Process section content
    let inBulletSection = false;
    
    for (let i = 1; i < sectionLines.length; i++) {
      const line = sectionLines[i].trim();
      
      if (line.length === 0) {
        formattedText += '\n';
        inBulletSection = false;
      } else if (line.match(/^\d{4}/) || line.includes(' - ')) {
        // Potential date range or job title
        formattedText += `\n**${line}**\n`;
        inBulletSection = false;
      } else {
        // Regular content, add bullet points for readability
        if (!inBulletSection) {
          formattedText += '• ' + line + '\n';
          inBulletSection = true;
        } else {
          formattedText += '• ' + line + '\n';
        }
      }
    }
    
    formattedText += '\n\n';
  }
  
  return formattedText;
}
  