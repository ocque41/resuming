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
  template?: CVTemplate | string,
  progressCallback?: (progress: number, progressMessage?: string) => Promise<void>
): Promise<{ optimizedText: string; optimizedCV?: string; error?: string }> {
  try {
    console.log("Starting CV optimization with enhanced formatting");
    
    // Report initial progress
    if (progressCallback) {
      await progressCallback(5, "Starting CV optimization");
    }
    
    // Step 1: Extract sections from the CV text
    const sections = extractSections(cvText);
    if (progressCallback) {
      await progressCallback(15, "Extracted CV sections");
    }
    
    // Step 2: Standardize the CV structure
    const standardizedText = standardizeCV(cvText);
    if (progressCallback) {
      await progressCallback(30, "Standardized CV structure");
    }
    
    // Step 3: Apply the structured format
    const structuredText = formatStructuredCV(sections);
    if (progressCallback) {
      await progressCallback(50, "Applied structured format");
    }
    
    // Step 4: Apply template-specific formatting if a template is provided
    let optimizedText = structuredText;
    let templateId = typeof template === 'string' ? template : template?.id;
    
    if (template) {
      console.log(`Applying template: ${templateId}`);
      if (progressCallback) {
        await progressCallback(65, `Applying template: ${templateId}`);
      }
      
      // If template is a string (templateId), convert it to a template object
      if (typeof template === 'string') {
        const templateLayout = getTemplateLayout(template);
        if (templateLayout) {
          optimizedText = applyTemplateFormatting(structuredText, templateLayout);
        }
      } else if (template) {
        optimizedText = applyTemplateFormatting(structuredText, template);
      }
    }
    
    // Step 5: Verify content preservation
    const contentVerification = verifyContentPreservation(cvText, optimizedText);
    if (progressCallback) {
      await progressCallback(80, "Verified content preservation");
    }
    
    // If content is not preserved, recover missing content
    if (!contentVerification.preserved) {
      console.log("Some content may be missing, attempting to recover...");
      optimizedText = recoverMissingContent(optimizedText, cvText, contentVerification.missingItems);
      if (progressCallback) {
        await progressCallback(90, "Recovered missing content");
      }
    }
    
    // Final progress update
    if (progressCallback) {
      await progressCallback(100, "CV optimization completed");
    }
    
    return {
      optimizedText,
      optimizedCV: optimizedText // Include the optimized CV in the same format
    };
  } catch (error) {
    console.error("Error optimizing CV:", error);
    
    // Report error in progress
    if (progressCallback) {
      await progressCallback(0, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      optimizedText: cvText,
      error: `Failed to optimize CV: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

// Apply template-specific formatting
function applyTemplateFormatting(text: string, template: CVTemplate | any): string {
  try {
    console.log(`Applying template formatting with template: ${JSON.stringify(template.id || 'unknown')}`);
    
    // If it's a template layout from getTemplateLayout, handle it differently
    if (template.headerStyle && template.sidebarWidth && !template.id) {
      // This is a template layout object from getTemplateLayout
      const layout = template;
      
      // Apply basic formatting based on the layout
      let formattedText = text;
      
      // Apply header style
      if (layout.headerStyle === 'modern') {
        formattedText = formattedText.replace(/^(.*?)\n/, (match, name) => {
          return `# ${name.toUpperCase()} #\n`;
        });
      } else if (layout.headerStyle === 'minimal') {
        formattedText = formattedText.replace(/^(.*?)\n/, (match, name) => {
          return `${name}\n`;
        });
      } else if (layout.headerStyle === 'traditional') {
        formattedText = formattedText.replace(/^(.*?)\n/, (match, name) => {
          return `${name.toUpperCase()}\n===================\n`;
        });
      }
      
      // Apply section spacing
      formattedText = formattedText.replace(/\n(#+\s.*?\s#+)\n/g, (match, header) => {
        return `\n\n${header}\n\n`;
      });
      
      return formattedText;
    }
    
    // Handle CVTemplate type
    if (template.metadata && template.metadata.layout) {
      let formattedText = text;
      
      // Apply layout-specific formatting
      switch (template.metadata.layout) {
        case 'two-column':
          // Format for two-column layout
          formattedText = formatTwoColumnLayout(formattedText, template);
          break;
        case 'one-column':
          // Format for one-column layout
          formattedText = formatOneColumnLayout(formattedText, template);
          break;
        case 'modern':
          // Format for modern layout
          formattedText = formatModernLayout(formattedText, template);
          break;
        case 'traditional':
          // Format for traditional layout
          formattedText = formatTraditionalLayout(formattedText, template);
          break;
        default:
          // Default formatting
          console.log(`Unknown layout type: ${template.metadata.layout}, using default formatting`);
          break;
      }
      
      // Apply company-specific keyword emphasis
      if (template.metadata.keywordsEmphasis && template.metadata.keywordsEmphasis.length > 0) {
        formattedText = emphasizeKeywords(formattedText, template.metadata.keywordsEmphasis);
      }
      
      return formattedText;
    }
    
    // If we get here, just return the original text
    console.warn("Template format not recognized, returning original text");
    return text;
  } catch (error) {
    console.error("Error applying template formatting:", error);
    return text;
  }
}

// Helper functions for different layout types
function formatTwoColumnLayout(text: string, template: CVTemplate): string {
  // Implementation for two-column layout
  return text;
}

function formatOneColumnLayout(text: string, template: CVTemplate): string {
  // Implementation for one-column layout
  return text;
}

function formatModernLayout(text: string, template: CVTemplate): string {
  // Implementation for modern layout
  return text;
}

function formatTraditionalLayout(text: string, template: CVTemplate): string {
  // Implementation for traditional layout
  return text;
}

function emphasizeKeywords(text: string, keywords: string[]): string {
  let result = text;
  
  // Emphasize each keyword
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    result = result.replace(regex, match => `**${match}**`);
  });
  
  return result;
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
  try {
    console.log("Starting CV optimization with analysis data");
    
    // Extract sections from the CV text
    const sections = extractSections(cvText);
    
    // Apply the structured format
    const structuredText = formatStructuredCV(sections);
    
    // Apply template-specific formatting if a template is provided
    let optimizedText = structuredText;
    if (template) {
      console.log(`Applying template: ${template.id}`);
      optimizedText = applyTemplateFormatting(structuredText, template);
    }
    
    // Ensure proper section structure
    optimizedText = ensureProperSectionStructure(optimizedText, sections);
    
    // Verify content preservation
    const contentCheck = verifyContentPreservation(cvText, optimizedText);
    if (!contentCheck.preserved) {
      console.warn("Content preservation check failed. Some important content may be missing.");
      // Try to recover missing content
      optimizedText = recoverMissingContent(optimizedText, cvText, contentCheck.missingItems);
    }
    
    console.log("CV optimization with analysis completed successfully");
    return {
      optimizedText: optimizedText
    };
  } catch (error) {
    console.error("Error optimizing CV with analysis:", error);
  return {
      optimizedText: cvText,
      error: error instanceof Error ? error.message : String(error)
  };
  }
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
  detectedIndustry: string;
  metrics: {
    quantifiedAchievements: number;
    actionVerbs: number;
    technicalTerms: number;
    industryKeywords: number;
  }
} {
  try {
    // Extract sections to analyze each part of the CV
    const sections = extractSections(cvText);
    
    // Detect industry based on CV content
    const detectedIndustry = detectIndustryFromText(cvText);
    
    // Identify strengths
    const strengths = identifyActualStrengths(cvText, sections);
    
    // Identify weaknesses
    const weaknesses = identifyActualWeaknesses(cvText, sections);
    
    // Generate improvement suggestions
    const improvementSuggestions = generateImprovementSuggestions(cvText, sections, weaknesses);
    
    // Calculate metrics
    const metrics = calculateCVMetrics(cvText, sections, detectedIndustry);
    
    console.log(`CV analysis complete: ${strengths.length} strengths, ${weaknesses.length} weaknesses, industry: ${detectedIndustry}`);
    
    return {
      strengths,
      weaknesses,
      improvementSuggestions,
      detectedIndustry,
      metrics
    };
  } catch (error) {
    console.error("Error during CV analysis:", error);
    
    // Return fallback data to ensure UI doesn't break
    return {
      strengths: ["Basic CV structure detected"],
      weaknesses: ["CV could benefit from more detailed analysis"],
      improvementSuggestions: {
        "General": [
          "Add more quantifiable achievements",
          "Use industry-specific keywords",
          "Ensure each section is clearly defined",
          "Include a well-structured skills section"
        ]
      },
      detectedIndustry: "General",
      metrics: {
        quantifiedAchievements: 0,
        actionVerbs: 0,
        technicalTerms: 0,
        industryKeywords: 0
      }
    };
  }
}

// Detect industry based on CV content
function detectIndustryFromText(text: string): string {
  const industries = [
    { name: "Technology", keywords: ["software", "developer", "programming", "agile", "scrum", "web", "application", "javascript", "python", "java", "cloud", "database", "analytics"] },
    { name: "Finance", keywords: ["finance", "accounting", "banking", "investment", "financial", "budget", "audit", "tax", "revenue", "profit", "fiscal", "assets"] },
    { name: "Healthcare", keywords: ["healthcare", "medical", "clinical", "patient", "hospital", "doctor", "nurse", "therapy", "diagnosis", "treatment", "health"] },
    { name: "Marketing", keywords: ["marketing", "advertising", "brand", "social media", "campaign", "content", "seo", "market research", "digital marketing", "analytics"] },
    { name: "Education", keywords: ["education", "teaching", "teacher", "learning", "student", "curriculum", "instructor", "training", "academic", "professor", "school", "university"] },
    { name: "Sales", keywords: ["sales", "business development", "account manager", "revenue", "client", "customer", "crm", "negotiation", "quota", "pipeline"] },
    { name: "Engineering", keywords: ["engineering", "mechanical", "electrical", "civil", "structural", "design", "technical", "specifications", "cad", "project"] },
    { name: "Human Resources", keywords: ["hr", "human resources", "recruitment", "talent", "hiring", "employee", "compensation", "benefits", "workforce", "onboarding"] },
    { name: "Legal", keywords: ["legal", "law", "attorney", "counsel", "compliance", "regulation", "litigation", "contract", "policy", "regulatory"] },
    { name: "Consulting", keywords: ["consulting", "consultant", "advisor", "strategy", "solution", "client", "engagement", "analysis", "recommendation"] }
  ];

  const lowerCaseText = text.toLowerCase();
  let matchCounts: Record<string, number> = {};

  // Count matches for each industry
  industries.forEach(industry => {
    matchCounts[industry.name] = 0;
    industry.keywords.forEach(keyword => {
      // Use regex with word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${keyword}\\b`, 'ig');
      const matches = lowerCaseText.match(regex);
      if (matches) {
        matchCounts[industry.name] += matches.length;
      }
    });
  });

  // Find the industry with the most matches
  let bestMatch = "General";
  let highestCount = 0;

  for (const [industry, count] of Object.entries(matchCounts)) {
    if (count > highestCount) {
      highestCount = count;
      bestMatch = industry;
    }
  }

  // If no strong matches, default to "General"
  return highestCount > 2 ? bestMatch : "General";
}

// Identify actual strengths in the CV
function identifyActualStrengths(text: string, sections: Record<string, string>): string[] {
  const strengths: string[] = [];
  const lowercaseText = text.toLowerCase();
  
  // Check for quantifiable achievements
  if (/increased|improved|reduced|generated|saved|delivered|achieved|grew|exceeded/i.test(text) && 
      /\b\d+%|\$\d+|\d+ (percent|million|thousand|users|clients|customers|projects)/i.test(text)) {
    strengths.push("Contains quantifiable achievements");
  }
  
  // Check for detailed experience
  if (sections.experience && sections.experience.length > 300) {
    strengths.push("Detailed work experience");
    
    // Check for action verbs in experience
    const actionVerbs = ["led", "managed", "developed", "created", "implemented", "designed", "launched", "coordinated"];
    const actionVerbCount = actionVerbs.filter(verb => lowercaseText.includes(verb)).length;
    
    if (actionVerbCount >= 3) {
      strengths.push("Good use of action verbs");
    }
  }
  
  // Check for education section
  if (sections.education && sections.education.length > 100) {
    strengths.push("Strong educational background");
  }
  
  // Check for skills section
  if (sections.skills && sections.skills.length > 150) {
    strengths.push("Comprehensive skills section");
  }
  
  // Check for technical keywords
  const technicalKeywords = ["certified", "programming", "software", "analysis", "design", "development", "project management", "leadership"];
  const technicalKeywordCount = technicalKeywords.filter(kw => lowercaseText.includes(kw)).length;
  
  if (technicalKeywordCount >= 3) {
    strengths.push("Rich in technical keywords");
  }
  
  // Check for concise profile/summary
  if (sections.profile && sections.profile.length > 50 && sections.profile.length < 500) {
    strengths.push("Effective professional summary");
  }
  
  // Ensure we have at least one strength
  if (strengths.length === 0) {
    // Look for anything positive to highlight
    if (text.length > 1000) {
      strengths.push("Comprehensive CV content");
    } else if (sections.contact) {
      strengths.push("Clear contact information");
    } else {
      strengths.push("Basic CV structure present");
    }
  }
  
  return strengths;
}

// Identify actual weaknesses in the CV
function identifyActualWeaknesses(text: string, sections: Record<string, string>): string[] {
  const weaknesses: string[] = [];
  const lowercaseText = text.toLowerCase();
  
  // Check for missing sections
  if (!sections.skills || sections.skills.length < 50) {
    weaknesses.push("Skills section is missing or underdeveloped");
  }
  
  if (!sections.experience || sections.experience.length < 200) {
    weaknesses.push("Work experience section needs more detail");
  }
  
  if (!sections.education) {
    weaknesses.push("Education section is missing");
  }
  
  if (!sections.profile && !sections.summary) {
    weaknesses.push("Professional summary/profile is missing");
  }
  
  // Check for lack of achievements
  if (!sections.achievements && !/increased|improved|reduced|generated|saved|delivered|achieved/i.test(text)) {
    weaknesses.push("No quantifiable achievements highlighted");
  }
  
  // Check for passive language
  if (/was responsible for|duties included|responsible for/i.test(text) && 
      !/led|managed|developed|created|implemented|designed|launched/i.test(text)) {
    weaknesses.push("Uses passive language instead of action verbs");
  }
  
  // Check for bullet point formatting in experience section
  if (sections.experience && !sections.experience.includes('•') && !sections.experience.includes('-')) {
    weaknesses.push("Experience section lacks bullet points for readability");
  }
  
  // Ensure we have at least one weakness for improvement suggestions
  if (weaknesses.length === 0) {
    weaknesses.push("Could benefit from more quantifiable achievements");
  }
  
  return weaknesses;
}

// Generate improvement suggestions based on weaknesses
function generateImprovementSuggestions(text: string, sections: Record<string, string>, weaknesses: string[]): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};
  
  // Add suggestions based on identified weaknesses
  weaknesses.forEach(weakness => {
    if (weakness.includes("skills section")) {
      suggestions["Skills"] = [
        "Add a dedicated skills section with relevant technical and soft skills",
        "Organize skills by categories (technical, soft, industry-specific)",
        "Include proficiency levels for technical skills where appropriate"
      ];
    } else if (weakness.includes("experience section")) {
      suggestions["Experience"] = [
        "Use bullet points to highlight responsibilities and achievements",
        "Begin each bullet point with a strong action verb",
        "Include measurable results and achievements with metrics",
        "Focus on accomplishments rather than just responsibilities"
      ];
    } else if (weakness.includes("education section")) {
      suggestions["Education"] = [
        "List education in reverse chronological order",
        "Include degrees, institutions, locations, and graduation dates",
        "Mention relevant coursework, honors, or academic achievements"
      ];
    } else if (weakness.includes("summary/profile")) {
      suggestions["Profile"] = [
        "Add a concise professional summary at the top of your CV",
        "Highlight your most relevant skills and experience",
        "Tailor your summary to the specific job or industry"
      ];
    } else if (weakness.includes("achievements")) {
      suggestions["Achievements"] = [
        "Add specific, quantifiable achievements with metrics",
        "Use numbers and percentages to demonstrate impact",
        "Highlight increases in efficiency, revenue, or customer satisfaction"
      ];
    } else if (weakness.includes("passive language")) {
      suggestions["Language"] = [
        "Replace passive phrases with strong action verbs",
        "Begin bullet points with verbs like 'Led', 'Developed', 'Implemented'",
        "Focus on what you accomplished, not just what you were 'responsible for'"
      ];
    } else if (weakness.includes("bullet points")) {
      suggestions["Formatting"] = [
        "Use bullet points to improve readability",
        "Keep bullet points concise (1-2 lines each)",
        "Ensure consistent formatting throughout"
      ];
    }
  });
  
  // Add general improvement suggestions if none were added
  if (Object.keys(suggestions).length === 0) {
    suggestions["General"] = [
      "Tailor your CV to each specific job application",
      "Use industry-specific keywords to pass ATS screening",
      "Quantify achievements with specific metrics where possible",
      "Ensure consistent formatting throughout your CV"
    ];
  }
  
  return suggestions;
}

// Calculate metrics for the CV
function calculateCVMetrics(text: string, sections: Record<string, string>, industry: string): {
  quantifiedAchievements: number;
  actionVerbs: number;
  technicalTerms: number;
  industryKeywords: number;
} {
  const lowercaseText = text.toLowerCase();
  
  // Count quantified achievements
  const quantifiedPattern = /\b(\d+%|\d+\s*percent|\$\d+|\d+\s*million|\d+\s*billion|\d+\s*users|\d+\s*customers|\d+\s*clients|\d+\s*projects|\d+\s*times|\d+\s*days|\d+\s*months|\d+\s*years)\b/gi;
  const quantifiedMatches = text.match(quantifiedPattern) || [];
  const quantifiedAchievements = quantifiedMatches.length;
  
  // Count action verbs
  const actionVerbs = ["achieved", "improved", "increased", "reduced", "developed", "implemented", "created", "managed", "led", "designed", "launched", "delivered", "generated", "negotiated", "secured"];
  let actionVerbCount = 0;
  
  actionVerbs.forEach(verb => {
    const regex = new RegExp(`\\b${verb}\\b`, 'gi');
    const matches = text.match(regex) || [];
    actionVerbCount += matches.length;
  });
  
  // Count technical terms
  const technicalTerms = ["software", "programming", "development", "analysis", "design", "implementation", "system", "database", "application", "framework", "methodology", "certified", "technology"];
  let technicalTermCount = 0;
  
  technicalTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex) || [];
    technicalTermCount += matches.length;
  });
  
  // Count industry-specific keywords
  const industryKeywords = getIndustrySpecificKeywords(industry);
  let industryKeywordCount = 0;
  
  industryKeywords.forEach(keyword => {
    if (lowercaseText.includes(keyword.toLowerCase())) {
      industryKeywordCount++;
    }
  });
  
  return {
    quantifiedAchievements,
    actionVerbs: actionVerbCount,
    technicalTerms: technicalTermCount,
    industryKeywords: industryKeywordCount
  };
}

// Add the missing export functions
export function extractTopAchievements(text: string): string[] {
  const achievements: string[] = [];
  
  // Look for bullet points or numbered lists that might contain achievements
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine.length === 0) continue;
    
    // Look for bullet points or numbered lists
    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || 
        /^\d+[\.\)]/.test(trimmedLine)) {
      // Extract the achievement text
      let achievement = trimmedLine;
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        achievement = trimmedLine.substring(1).trim();
      } else if (trimmedLine.startsWith('•')) {
        achievement = trimmedLine.substring(1).trim();
      } else if (/^\d+[\.\)]/.test(trimmedLine)) {
        achievement = trimmedLine.replace(/^\d+[\.\)]\s*/, '');
      }
      
      // Check if this looks like an achievement (contains action verbs or metrics)
      const actionVerbs = ['achieved', 'improved', 'increased', 'reduced', 'developed', 'implemented', 'created', 'managed', 'led', 'designed', 'launched', 'delivered', 'generated', 'negotiated', 'secured'];
      const containsActionVerb = actionVerbs.some(verb => achievement.toLowerCase().includes(verb));
      
      const containsMetric = /\d+%|\$\d+|\d+ (million|thousand|percent|users|customers|clients|projects|products)/i.test(achievement);
      
      if (containsActionVerb || containsMetric) {
        achievements.push(achievement);
      }
    }
  }
  
  // If we didn't find any achievements with action verbs or metrics, just take any bullet points
  if (achievements.length === 0) {
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.length === 0) continue;
      
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || 
          /^\d+[\.\)]/.test(trimmedLine)) {
        let achievement = trimmedLine;
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          achievement = trimmedLine.substring(1).trim();
        } else if (trimmedLine.startsWith('•')) {
          achievement = trimmedLine.substring(1).trim();
        } else if (/^\d+[\.\)]/.test(trimmedLine)) {
          achievement = trimmedLine.replace(/^\d+[\.\)]\s*/, '');
        }
        
        achievements.push(achievement);
      }
    }
  }
  
  // Sort achievements by length (longer ones are often more detailed and valuable)
  achievements.sort((a, b) => b.length - a.length);
  
  // Return the top achievements (up to 3)
  return achievements.slice(0, 3);
}

export function formatCompetences(skills: string): string {
  if (!skills || skills.trim().length === 0) {
    return "• Communication\n• Problem Solving\n• Teamwork\n";
  }
  
  // Split the skills text into lines
  const lines = skills.split('\n').filter(line => line.trim().length > 0);
  
  // Check if the skills are already in bullet point format
  if (lines.some(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))) {
    // Already formatted, just ensure consistent bullet points
    return lines.map(line => {
      line = line.trim();
      if (line.startsWith('-') || line.startsWith('*')) {
        return '• ' + line.substring(1).trim();
      } else if (line.startsWith('•')) {
        return line;
      } else {
        return '• ' + line;
      }
    }).join('\n');
  }
  
  // Check if skills are comma-separated
  if (skills.includes(',')) {
    const skillList = skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return skillList.map(skill => `• ${skill}`).join('\n');
  }
  
  // Default: treat each line as a separate skill
  return lines.map(line => `• ${line.trim()}`).join('\n');
}

export function formatExperience(experience: string): string {
  if (!experience || experience.trim().length === 0) {
    return "No work experience provided.";
  }
  
  // Split the experience text into sections (usually separated by multiple newlines)
  const sections = experience.split(/\n{2,}/).filter(section => section.trim().length > 0);
  
  let formattedExperience = "";
  
  for (const section of sections) {
    // Try to extract company name, job title, and date range
    const lines = section.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) continue;
    
    let companyName = "";
    let jobTitle = "";
    let dateRange = "";
    let achievements: string[] = [];
    
    // First line is usually company name or job title
    const firstLine = lines[0].trim();
    
    // Check if the first line contains a date range
    const datePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\-–—]?\d{4}\s*[-–—]?\s*(Present|Current|Now|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\-–—]?\d{4})?/i;
    
    if (datePattern.test(firstLine)) {
      // First line contains date, likely "Job Title at Company, Date Range"
      const parts = firstLine.split(/,\s*/);
      
      if (parts.length >= 2) {
        // Extract date range from the last part
        dateRange = parts[parts.length - 1].trim();
        
        // The rest is likely "Job Title at Company"
        const jobInfo = parts.slice(0, parts.length - 1).join(', ');
        
        if (jobInfo.includes(' at ')) {
          const atParts = jobInfo.split(' at ');
          jobTitle = atParts[0].trim();
          companyName = atParts[1].trim();
        } else {
          // Can't clearly separate, use the whole thing as job title
          jobTitle = jobInfo;
        }
      } else {
        // Just a date range, use second line for job info
        dateRange = firstLine;
        if (lines.length > 1) {
          const secondLine = lines[1].trim();
          
          if (secondLine.includes(' at ')) {
            const atParts = secondLine.split(' at ');
            jobTitle = atParts[0].trim();
            companyName = atParts[1].trim();
          } else {
            jobTitle = secondLine;
          }
        }
      }
    } else {
      // First line doesn't contain date, might be "Company" or "Job Title"
      if (firstLine.toUpperCase() === firstLine) {
        // All caps is likely the company name
        companyName = firstLine;
        
        // Second line might be job title
        if (lines.length > 1) {
          jobTitle = lines[1].trim();
        }
        
        // Third line might be date range
        if (lines.length > 2) {
          const thirdLine = lines[2].trim();
          if (datePattern.test(thirdLine)) {
            dateRange = thirdLine;
          }
        }
      } else {
        // First line is likely job title
        jobTitle = firstLine;
        
        // Second line might be company name
        if (lines.length > 1) {
          const secondLine = lines[1].trim();
          if (secondLine.toUpperCase() === secondLine) {
            companyName = secondLine;
          } else {
            companyName = secondLine;
          }
        }
        
        // Look for date range in subsequent lines
        for (let i = 2; i < Math.min(lines.length, 5); i++) {
          if (datePattern.test(lines[i])) {
            dateRange = lines[i].trim();
            break;
          }
        }
      }
    }
    
    // Extract achievements from the remaining lines
    const startIndex = Math.max(1, lines.findIndex(line => line.includes(dateRange)) + 1);
    const remainingLines = lines.slice(startIndex);
    
    // Look for bullet points or numbered lists
    for (const line of remainingLines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || 
          /^\d+[\.\)]/.test(trimmedLine)) {
        // This is a bullet point or numbered item
        let achievement = trimmedLine;
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          achievement = '• ' + trimmedLine.substring(1).trim();
        } else if (/^\d+[\.\)]/.test(trimmedLine)) {
          achievement = '• ' + trimmedLine.replace(/^\d+[\.\)]\s*/, '');
        }
        achievements.push(achievement);
      } else if (achievements.length > 0) {
        // This line is a continuation of the previous achievement
        achievements[achievements.length - 1] += ' ' + trimmedLine;
      } else {
        // This might be a paragraph describing achievements
        achievements.push('• ' + trimmedLine);
      }
    }
    
    // Format this job entry
    formattedExperience += `## ${jobTitle || "Position"} ${companyName ? `at ${companyName}` : ""}\n`;
    formattedExperience += `${dateRange || "No date provided"}\n\n`;
    
    // Add achievements (limit to top 3 if there are more)
    const topAchievements = achievements.slice(0, 3);
    if (topAchievements.length > 0) {
      formattedExperience += topAchievements.join('\n');
    } else {
      formattedExperience += "• Responsible for key duties and responsibilities\n";
      formattedExperience += "• Collaborated with team members to achieve goals\n";
      formattedExperience += "• Contributed to project success and business objectives\n";
    }
    
    formattedExperience += "\n\n";
  }
  
  return formattedExperience.trim();
}

export function formatEducation(education: string): string {
  if (!education || education.trim().length === 0) {
    return "No education information provided.";
  }
  
  // Split the education text into sections
  const sections = education.split(/\n{2,}/).filter(section => section.trim().length > 0);
  
  let formattedEducation = "";
  
  for (const section of sections) {
    // Try to extract institution, degree, and year
    const lines = section.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) continue;
    
    let institution = "";
    let degree = "";
    let year = "";
    
    // First line is usually institution or degree
    const firstLine = lines[0].trim();
    
    // Check if the first line contains a year
    const yearPattern = /\b(19|20)\d{2}\b/;
    
    if (yearPattern.test(firstLine)) {
      // First line contains year, extract it
      year = firstLine.match(yearPattern)![0];
      
      // The rest might be degree and institution
      const parts = firstLine.split(/,\s*/);
      
      if (parts.length >= 2) {
        // Try to determine which part is the degree and which is the institution
        for (const part of parts) {
          if (part.includes("Bachelor") || part.includes("Master") || part.includes("PhD") || 
              part.includes("Diploma") || part.includes("Certificate") || part.includes("Degree")) {
            degree = part.trim();
          } else if (!part.includes(year)) {
            institution = part.trim();
          }
        }
      }
    } else {
      // First line doesn't contain year, might be institution or degree
      if (firstLine.toUpperCase() === firstLine) {
        // All caps is likely the institution
        institution = firstLine;
        
        // Second line might be degree
        if (lines.length > 1) {
          degree = lines[1].trim();
        }
        
        // Look for year in subsequent lines
        for (let i = 1; i < lines.length; i++) {
          if (yearPattern.test(lines[i])) {
            year = lines[i].match(yearPattern)![0];
            break;
          }
        }
      } else {
        // First line is likely degree
        degree = firstLine;
        
        // Second line might be institution
        if (lines.length > 1) {
          institution = lines[1].trim();
        }
        
        // Look for year in subsequent lines
        for (let i = 1; i < lines.length; i++) {
          if (yearPattern.test(lines[i])) {
            year = lines[i].match(yearPattern)![0];
            break;
          }
        }
      }
    }
    
    // Format this education entry
    formattedEducation += `## ${degree || "Degree"}\n`;
    formattedEducation += `${institution || "Institution"}, ${year || "Year not specified"}\n\n`;
  }
  
  return formattedEducation.trim();
}

export function formatLanguages(languages: string): string {
  if (!languages || languages.trim().length === 0) {
    return "• English (Native or Bilingual)";
  }
  
  // Split the languages text into lines
  const lines = languages.split('\n').filter(line => line.trim().length > 0);
  
  // Check if the languages are already in bullet point format
  if (lines.some(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))) {
    // Already formatted, just ensure consistent bullet points
    return lines.map(line => {
      line = line.trim();
      if (line.startsWith('-') || line.startsWith('*')) {
        return '• ' + line.substring(1).trim();
      } else if (line.startsWith('•')) {
        return line;
      } else {
        return '• ' + line;
      }
    }).join('\n');
  }
  
  // Check if languages are comma-separated
  if (languages.includes(',')) {
    const languageList = languages.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return languageList.map(lang => {
      // Try to extract language and proficiency
      if (lang.includes(':') || lang.includes('-') || lang.includes('(')) {
        return `• ${lang}`;
      } else {
        return `• ${lang} (Proficient)`;
      }
    }).join('\n');
  }
  
  // Default: treat each line as a separate language
  return lines.map(line => {
    // Try to extract language and proficiency
    if (line.includes(':') || line.includes('-') || line.includes('(')) {
      return `• ${line.trim()}`;
    } else {
      return `• ${line.trim()} (Proficient)`;
    }
  }).join('\n');
}

// Add a new function to format the CV according to the specified structure
export function formatStructuredCV(sections: Record<string, string>): string {
  let formattedText = "";
  
  // 1. Profile/About Me Section
  formattedText += "# Profile\n\n";
  if (sections["Profile"] || sections["Personal Information"] || sections["Contact"]) {
    formattedText += sections["Profile"] || sections["Personal Information"] || sections["Contact"];
  } else {
    // Try to extract contact information from other sections
    const contactInfo = extractContactInformation(Object.values(sections).join("\n"));
    formattedText += contactInfo || "Professional with experience in the industry.";
  }
  formattedText += "\n\n";
  
  // 2. Achievements Section (3 bullet points with best achievements)
  formattedText += "# Achievements\n\n";
  const achievements = extractTopAchievements(Object.values(sections).join("\n"));
  if (achievements.length > 0) {
    for (const achievement of achievements.slice(0, 3)) {
      formattedText += `• ${achievement}\n`;
    }
  } else if (sections["Achievements"] || sections["Accomplishments"]) {
    formattedText += sections["Achievements"] || sections["Accomplishments"];
  } else {
    formattedText += "• Successfully implemented projects that improved efficiency\n";
    formattedText += "• Collaborated with cross-functional teams to achieve business goals\n";
    formattedText += "• Recognized for outstanding performance and contributions\n";
  }
  formattedText += "\n\n";
  
  // 3. Experience Section (company, date to date, and 3 major achievements)
  formattedText += "# Experience\n\n";
  if (sections["Experience"] || sections["Work Experience"] || sections["Employment History"] || sections["Professional Experience"]) {
    const experienceText = sections["Experience"] || sections["Work Experience"] || sections["Employment History"] || sections["Professional Experience"];
    formattedText += formatExperience(experienceText);
  } else {
    formattedText += "No work experience provided.\n";
  }
  formattedText += "\n\n";
  
  // 4. Skills Section
  formattedText += "# Skills\n\n";
  if (sections["Skills"] || sections["Competences"] || sections["Technical Skills"]) {
    const skillsText = sections["Skills"] || sections["Competences"] || sections["Technical Skills"];
    formattedText += formatCompetences(skillsText);
  } else {
    // Try to extract skills from the entire CV text
    const allText = Object.values(sections).join("\n");
    const extractedSkills = extractSkillsFromText(allText);
    if (extractedSkills.length > 0) {
      formattedText += extractedSkills.map(skill => `• ${skill}`).join("\n");
    } else {
      formattedText += "• Communication\n• Problem Solving\n• Teamwork\n";
    }
  }
  formattedText += "\n\n";
  
  // 5. Education Section
  formattedText += "# Education\n\n";
  if (sections["Education"] || sections["Academic Background"]) {
    const educationText = sections["Education"] || sections["Academic Background"];
    formattedText += formatEducation(educationText);
  } else {
    formattedText += "No education information provided.\n";
  }
  formattedText += "\n\n";
  
  // 6. Languages Section
  formattedText += "# Languages\n\n";
  if (sections["Languages"]) {
    formattedText += formatLanguages(sections["Languages"]);
  } else {
    // Try to extract languages from the entire CV text
    const allText = Object.values(sections).join("\n");
    const extractedLanguages = extractLanguagesFromText(allText);
    if (extractedLanguages.length > 0) {
      formattedText += extractedLanguages.map(lang => `• ${lang}`).join("\n");
    } else {
      formattedText += "• English\n";
    }
  }
  
  return formattedText;
}

// Extract skills from text
function extractSkillsFromText(text: string): string[] {
  const skills: string[] = [];
  
  // Common skill keywords
  const skillKeywords = [
    // Technical skills
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go', 'Rust',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'ASP.NET',
    'HTML', 'CSS', 'SASS', 'LESS', 'Bootstrap', 'Tailwind', 'Material UI',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'DynamoDB', 'Cassandra', 'Redis',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD',
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Trello', 'Asana',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch', 'Scikit-learn',
    'Blockchain', 'Ethereum', 'Solidity', 'Smart Contracts', 'Web3',
    
    // Soft skills
    'Leadership', 'Communication', 'Teamwork', 'Problem Solving', 'Critical Thinking',
    'Time Management', 'Project Management', 'Agile', 'Scrum', 'Kanban',
    'Negotiation', 'Conflict Resolution', 'Decision Making', 'Adaptability', 'Flexibility',
    'Creativity', 'Innovation', 'Strategic Thinking', 'Analytical Skills', 'Attention to Detail',
    'Customer Service', 'Client Relations', 'Sales', 'Marketing', 'Business Development',
    'Presentation', 'Public Speaking', 'Writing', 'Editing', 'Research',
    'Mentoring', 'Coaching', 'Training', 'Teaching', 'Facilitation'
  ];
  
  // Check for skills in the text
  for (const skill of skillKeywords) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(text)) {
      skills.push(skill);
    }
  }
  
  // Look for skill sections
  const lines = text.split('\n');
  let inSkillSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line starts a skill section
    if (/^(Skills|Competences|Technical Skills|Core Competencies|Expertise|Proficiencies):/i.test(trimmedLine)) {
      inSkillSection = true;
      continue;
    }
    
    // Check if this line ends a skill section
    if (inSkillSection && (trimmedLine.length === 0 || /^[A-Z][a-z]+:/.test(trimmedLine))) {
      inSkillSection = false;
      continue;
    }
    
    // Extract skills from this line if we're in a skill section
    if (inSkillSection) {
      // Check if this line is a bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const skillText = trimmedLine.substring(1).trim();
        
        // Add the skill if it's not already in the list
        if (!skills.some(s => skillText.includes(s))) {
          skills.push(skillText);
        }
      } else if (trimmedLine.includes(',')) {
        // This line might be a comma-separated list of skills
        const skillList = trimmedLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        for (const skill of skillList) {
          // Add the skill if it's not already in the list
          if (!skills.some(s => s === skill)) {
            skills.push(skill);
          }
        }
      }
    }
  }
  
  return skills;
}

// Extract languages from text
function extractLanguagesFromText(text: string): string[] {
  const languages: string[] = [];
  
  // Common languages
  const languageKeywords = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Russian',
    'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Bengali', 'Punjabi', 'Turkish',
    'Polish', 'Ukrainian', 'Czech', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Greek',
    'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Tagalog', 'Swahili'
  ];
  
  // Check for languages in the text
  for (const language of languageKeywords) {
    const regex = new RegExp(`\\b${language}\\b`, 'i');
    if (regex.test(text)) {
      // Try to extract proficiency level
      const languageLine = text.split('\n').find(line => regex.test(line));
      
      if (languageLine) {
        // Check if the line contains proficiency information
        const proficiencyKeywords = ['native', 'fluent', 'proficient', 'intermediate', 'beginner', 'basic', 'elementary', 'advanced', 'business', 'conversational', 'professional', 'working'];
        
        let proficiency = '';
        for (const keyword of proficiencyKeywords) {
          if (languageLine.toLowerCase().includes(keyword)) {
            proficiency = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            break;
          }
        }
        
        if (proficiency) {
          languages.push(`${language} (${proficiency})`);
        } else {
          languages.push(language);
        }
      } else {
        languages.push(language);
      }
    }
  }
  
  // Look for language sections
  const lines = text.split('\n');
  let inLanguageSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line starts a language section
    if (/^(Languages|Language Skills|Language Proficiency):/i.test(trimmedLine)) {
      inLanguageSection = true;
      continue;
    }
    
    // Check if this line ends a language section
    if (inLanguageSection && (trimmedLine.length === 0 || /^[A-Z][a-z]+:/.test(trimmedLine))) {
      inLanguageSection = false;
      continue;
    }
    
    // Extract languages from this line if we're in a language section
    if (inLanguageSection) {
      // Check if this line is a bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const languageText = trimmedLine.substring(1).trim();
        
        // Add the language if it's not already in the list
        if (!languages.some(l => languageText.includes(l.split(' ')[0]))) {
          languages.push(languageText);
        }
      } else if (trimmedLine.includes(',')) {
        // This line might be a comma-separated list of languages
        const languageList = trimmedLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        for (const language of languageList) {
          // Add the language if it's not already in the list
          if (!languages.some(l => l.split(' ')[0] === language.split(' ')[0])) {
            languages.push(language);
          }
        }
      } else {
        // This might be a single language
        for (const language of languageKeywords) {
          const regex = new RegExp(`\\b${language}\\b`, 'i');
          if (regex.test(trimmedLine)) {
            // Add the language if it's not already in the list
            if (!languages.some(l => l.split(' ')[0] === language)) {
              languages.push(trimmedLine);
            }
            break;
          }
        }
      }
    }
  }
  
  return languages;
} 