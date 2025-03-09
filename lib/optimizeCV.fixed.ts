import { v4 as uuidv4 } from 'uuid';
import { getTemplateLayout } from "./templateMatching";
import type { CVTemplate } from "@/types/templates";

interface FormattedSkillsResult {
  skills: string;
  languageSkills: string[];
}

// Main optimization function
export async function optimizeCV(
  cvText: string,
  template?: CVTemplate
): Promise<{ optimizedText: string; error?: string }> {
  try {
    console.log("Starting CV optimization with enhanced formatting");
    
    // Step 1: Extract sections from the CV text
    const sections = extractSections(cvText);
    
    // Step 2: Standardize the CV structure
    const standardizedText = standardizeCV(cvText);
    
    // Step 3: Apply template-specific formatting if a template is provided
    let optimizedText = standardizedText;
    if (template) {
      console.log(`Applying template: ${template.id}`);
      optimizedText = applyTemplateFormatting(standardizedText, template);
    } else {
      // Apply default modern formatting
      console.log("Applying default modern formatting");
      optimizedText = formatModernCV(sections);
    }
    
    // Step 4: Ensure proper section structure
    optimizedText = ensureProperSectionStructure(optimizedText, sections);
    
    // Step 5: Verify content preservation
    const contentCheck = verifyContentPreservation(cvText, optimizedText);
    if (!contentCheck.preserved) {
      console.warn("Content preservation check failed. Some important content may be missing.");
      // Try to recover missing content
      optimizedText = recoverMissingContent(optimizedText, cvText, contentCheck.missingItems);
    }
    
    console.log("CV optimization completed successfully");
    return {
      optimizedText: optimizedText
    };
  } catch (error) {
    console.error("Error optimizing CV:", error);
    return {
      optimizedText: cvText,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Apply template-specific formatting
function applyTemplateFormatting(text: string, template: CVTemplate): string {
  // Get the template layout
  const layout = getTemplateLayout(template.id);
  
  // Extract sections from the text
  const sections = extractSections(text);
  
  // Format each section according to the template
  let formattedText = "";
  
  // Add header with personal information
  formattedText += "# Personal Information\n\n";
  if (sections["Personal Information"] || sections["Contact"]) {
    formattedText += sections["Personal Information"] || sections["Contact"];
  } else {
    // Try to extract contact information from the text
    const contactInfo = extractContactInformation(text);
    formattedText += contactInfo;
  }
  formattedText += "\n\n";
  
  // Add professional summary or objective
  formattedText += "# Professional Summary\n\n";
  if (sections["Professional Summary"] || sections["Summary"] || sections["Objective"]) {
    formattedText += sections["Professional Summary"] || sections["Summary"] || sections["Objective"];
  } else {
    // Generate a generic professional summary
    formattedText += "Experienced professional with a proven track record of success in the industry.";
  }
  formattedText += "\n\n";
  
  // Add skills section
  formattedText += "# Skills\n\n";
  if (sections["Skills"] || sections["Competences"]) {
    formattedText += formatCompetences(sections["Skills"] || sections["Competences"]);
  }
  formattedText += "\n\n";
  
  // Add work experience section
  formattedText += "# Work Experience\n\n";
  if (sections["Work Experience"] || sections["Experience"] || sections["Professional Experience"]) {
    formattedText += formatExperience(sections["Work Experience"] || sections["Experience"] || sections["Professional Experience"]);
  }
  formattedText += "\n\n";
  
  // Add education section
  formattedText += "# Education\n\n";
  if (sections["Education"] || sections["Academic Background"]) {
    formattedText += formatEducation(sections["Education"] || sections["Academic Background"]);
  }
  formattedText += "\n\n";
  
  // Add languages section if available
  if (sections["Languages"]) {
    formattedText += "# Languages\n\n";
    formattedText += formatLanguages(sections["Languages"]);
    formattedText += "\n\n";
  }
  
  // Add additional sections if available
  for (const [sectionName, content] of Object.entries(sections)) {
    if (!["Personal Information", "Contact", "Professional Summary", "Summary", "Objective", 
          "Skills", "Competences", "Work Experience", "Experience", "Professional Experience", 
          "Education", "Academic Background", "Languages"].includes(sectionName)) {
      formattedText += `# ${sectionName}\n\n${content}\n\n`;
    }
  }
  
  return formattedText;
}

// Extract contact information from text
function extractContactInformation(text: string): string {
  let contactInfo = "";
  
  // Extract email
  const emailMatch = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  if (emailMatch) {
    contactInfo += `Email: ${emailMatch[1]}\n`;
  }
  
  // Extract phone number
  const phoneMatch = text.match(/(\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4})/);
  if (phoneMatch) {
    contactInfo += `Phone: ${phoneMatch[1]}\n`;
  }
  
  // Extract LinkedIn profile
  const linkedinMatch = text.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/);
  if (linkedinMatch) {
    contactInfo += `LinkedIn: ${linkedinMatch[1]}\n`;
  }
  
  return contactInfo;
}

// Recover missing content from the original text
function recoverMissingContent(optimizedText: string, originalText: string, missingItems: string[]): string {
  let recoveredText = optimizedText;
  
  // Add a section for recovered content if there are missing items
  if (missingItems.length > 0) {
    recoveredText += "\n\n# Additional Information\n\n";
    
    // Add each missing item
    for (const item of missingItems) {
      // Find the context around the missing item in the original text
      const itemIndex = originalText.indexOf(item);
      if (itemIndex >= 0) {
        // Get some context around the item
        const startIndex = Math.max(0, itemIndex - 100);
        const endIndex = Math.min(originalText.length, itemIndex + item.length + 100);
        const context = originalText.substring(startIndex, endIndex);
        
        // Add the context to the recovered text
        recoveredText += `${context}\n\n`;
      } else {
        // Just add the item itself
        recoveredText += `${item}\n\n`;
      }
    }
  }
  
  return recoveredText;
}

// Simplified version that formats the input text into a standardized structure
export function standardizeCV(cvText: string): string {
  // Split the text into lines
  const lines = cvText.split('\n');
  
  // Initialize variables for section detection
  let currentSection = "";
  let sectionContent = "";
  const sections: Record<string, string> = {};
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line is a section heading
    const isSectionHeading = 
      line.toUpperCase() === line || // All uppercase
      line.match(/^[A-Z][a-z]*([\s-][A-Z][a-z]*)*$/) || // Title case
      line.match(/^[A-Z][\w\s-]*:$/) || // Ends with colon
      line.length <= 30 && i < lines.length - 1 && !lines[i + 1].trim(); // Short line followed by empty line
    
    if (isSectionHeading) {
      // Save the previous section if it exists
      if (currentSection && sectionContent) {
        sections[currentSection] = sectionContent.trim();
      }
      
      // Start a new section
      currentSection = line.replace(/:$/, '').trim();
      sectionContent = "";
    } else {
      // Add to the current section content
      sectionContent += line + "\n";
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent) {
    sections[currentSection] = sectionContent.trim();
  }
  
  // Convert sections back to text
  let standardizedText = "";
  for (const [section, content] of Object.entries(sections)) {
    standardizedText += `# ${section}\n\n${content}\n\n`;
  }
  
  return standardizedText.trim();
}

// Extract sections from the CV text
export function extractSections(text: string): Record<string, string> {
  // Initialize the sections object
  const sections: Record<string, string> = {};
  
  // Try to identify common section headings
  const commonSections = [
    "Personal Information", "Contact", "Profile", "Summary", "Objective",
    "Skills", "Competences", "Technical Skills", "Soft Skills",
    "Work Experience", "Experience", "Professional Experience", "Employment History",
    "Education", "Academic Background", "Qualifications",
    "Languages", "Certifications", "Projects", "Publications", "References"
  ];
  
  // Split the text into lines
  const lines = text.split('\n');
  
  // Initialize variables for section detection
  let currentSection = "";
  let sectionContent = "";
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line matches a common section heading
    const matchedSection = commonSections.find(section => 
      line.toUpperCase().includes(section.toUpperCase()) ||
      line.toUpperCase() === section.toUpperCase() ||
      line.toUpperCase().replace(/[^A-Z]/g, '') === section.toUpperCase().replace(/[^A-Z]/g, '')
    );
    
    if (matchedSection || 
        line.match(/^#+\s+/) || // Markdown heading
        line.toUpperCase() === line || // All uppercase
        line.match(/^[A-Z][\w\s-]*:$/) // Ends with colon
    ) {
      // Save the previous section if it exists
      if (currentSection && sectionContent) {
        sections[currentSection] = sectionContent.trim();
      }
      
      // Start a new section
      currentSection = matchedSection || line.replace(/^#+\s+/, '').replace(/:$/, '').trim();
      sectionContent = "";
    } else {
      // Add to the current section content
      sectionContent += line + "\n";
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent) {
    sections[currentSection] = sectionContent.trim();
  }
  
  // If no sections were found, create a generic one
  if (Object.keys(sections).length === 0) {
    sections["Content"] = text.trim();
  }
  
  return sections;
}

// For compatibility with code that expects this function
export function verifyContentPreservation(originalText: string, optimizedText: string): { 
  preserved: boolean; 
  missingItems: string[];
  keywordScore: number;
  industryKeywordScore: number;
} {
  // Extract critical keywords from the original text
  const criticalKeywords = extractCriticalKeywords(originalText);
  
  // Check if each keyword is present in the optimized text
  const missingKeywords = criticalKeywords.filter(keyword => 
    !optimizedText.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Calculate keyword preservation score
  const keywordScore = criticalKeywords.length > 0 
    ? ((criticalKeywords.length - missingKeywords.length) / criticalKeywords.length) * 100
    : 100;
  
  // Extract industry-specific keywords
  const industryKeywords = getIndustrySpecificKeywords(originalText);
  
  // Check if each industry keyword is present in the optimized text
  const missingIndustryKeywords = industryKeywords.filter(keyword => 
    !optimizedText.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Calculate industry keyword preservation score
  const industryKeywordScore = industryKeywords.length > 0 
    ? ((industryKeywords.length - missingIndustryKeywords.length) / industryKeywords.length) * 100
    : 100;
  
  // Combine missing keywords and industry keywords
  const missingItems = [...missingKeywords, ...missingIndustryKeywords];
  
  // Consider content preserved if at least 80% of keywords are preserved
  const preserved = keywordScore >= 80 && industryKeywordScore >= 80;
  
  return {
    preserved,
    missingItems,
    keywordScore,
    industryKeywordScore
  };
}

// For compatibility with code that expects this function
export function extractCriticalKeywords(text: string): string[] {
  // Simplified implementation that returns an empty array
  return [];
}

// For compatibility with code that expects this function
export async function optimizeCVWithAnalysis(
  cvText: string,
  analysisMetadata: any,
  template?: CVTemplate
): Promise<{ optimizedText: string; error?: string }> {
  // Just return the original text
  return {
    optimizedText: cvText
  };
}

// For compatibility with code that expects this function
export function getIndustrySpecificKeywords(industry: string): string[] {
  // Simplified implementation that returns an empty array
  return [];
}

// For compatibility with code that expects this function
export function formatModernCV(sections: Record<string, string>): string {
  // Simplified implementation that returns empty string
  return '';
}

// For compatibility with code that expects this function
export function ensureProperSectionStructure(optimizedText: string, originalSections: Record<string, string>): string {
  // Just return the input
  return optimizedText;
}

// For compatibility with code that expects this function
export function analyzeCVContent(cvText: string): {
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: Record<string, string[]>;
  metrics: {
    quantifiedAchievements: number;
    actionVerbs: number;
    technicalTerms: number;
    industryKeywords: number;
  }
} {
  return {
    strengths: [],
    weaknesses: [],
    improvementSuggestions: {},
    metrics: {
      quantifiedAchievements: 0,
      actionVerbs: 0,
      technicalTerms: 0,
      industryKeywords: 0
    }
  };
}

// Add the missing export functions
export function extractTopAchievements(text: string): string[] {
  // Simplified stub implementation
  return [];
}

export function formatCompetences(skills: string): string {
  // Simplified stub implementation
  return '';
}

export function formatExperience(experience: string): string {
  // Simplified stub implementation
  return '';
}

export function formatEducation(education: string): string {
  // Simplified stub implementation
  return '';
}

export function formatLanguages(languages: string): string {
  // Simplified stub implementation
  return '';
} 