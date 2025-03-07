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
        CRITICAL: Preserve ALL industry-specific keywords, technical terms, metrics, and achievements from the original CV.
        DO NOT remove any skills, certifications, or technical competencies that could be used for ATS screening.
        Maintain or increase keyword density for job-relevant terms.
        
        ATS OPTIMIZATION RULES:
        1. Keep all technical skills intact - these are critical for ATS keyword matching
        2. Preserve numerical achievements and metrics (%, $, numbers) - these stand out to both ATS and recruiters
        3. Include industry-standard section headers (Education, Experience, Skills, etc.)
        4. Maintain all job titles, company names, and dates exactly as in the original
        5. Ensure all educational credentials, degrees, and certifications appear in full
        6. Preserve acronyms AND their expanded forms where present (e.g., "AI (Artificial Intelligence)")
        7. Keep language competencies and proficiency levels intact
      `;
    } else if (layout === 'two-column') {
      formattingInstructions = `
        Format the CV with a main column and a sidebar.
        Put contact information, skills, languages, and education in the sidebar.
        Put professional experience, projects, and other details in the main column.
        Use bullet points for achievements and responsibilities.
        Keep all text black.
        Ensure the CV fits on a single page.
        CRITICAL: Preserve ALL industry-specific keywords, technical terms, metrics, and achievements from the original CV.
        DO NOT remove any skills, certifications, or technical competencies that could be used for ATS screening.
        Maintain or increase keyword density for job-relevant terms.
        
        ATS OPTIMIZATION RULES:
        1. Keep all technical skills intact - these are critical for ATS keyword matching
        2. Preserve numerical achievements and metrics (%, $, numbers) - these stand out to both ATS and recruiters
        3. Include industry-standard section headers (Education, Experience, Skills, etc.)
        4. Maintain all job titles, company names, and dates exactly as in the original
        5. Ensure all educational credentials, degrees, and certifications appear in full
        6. Preserve acronyms AND their expanded forms where present (e.g., "AI (Artificial Intelligence)")
        7. Keep language competencies and proficiency levels intact
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
  
  // Extract top achievements
  const topAchievements = extractTopAchievements(originalText);
  
  // Create a standardized CV with consistent styling
  let optimizedCV = `# ${sections.name || 'PROFESSIONAL CV'}

`;

  // Add contact section if found
  if (sections.contact) {
    optimizedCV += `${sections.contact.trim().split('\n')[0] || ''}
${sections.job_title || sections.position || 'Professional'}
${sections.contact.trim().split('\n').slice(1).join('\n') || ''}

`;
  }

  // Add profile/summary section
  optimizedCV += `## ABOUT ME
${sections.profile ? improveSection(sections.profile, 'summary') : 'Experienced professional with a strong track record of achievements and expertise in the field.'}

`;

  // Add NEW achievements section with exactly 3 bullet points
  optimizedCV += `## ACHIEVEMENTS
• ${topAchievements[0]}
• ${topAchievements[1]}
• ${topAchievements[2]}

`;

  // Add skills/competences section
  optimizedCV += `## COMPETENCES
${sections.skills ? formatCompetences(sections.skills) : '• Core skill\n• Technical skill\n• Professional skill'}

`;

  // Add experience section
  optimizedCV += `## WORK EXPERIENCE
${sections.experience ? formatExperience(sections.experience) : 'Professional experience details.'}

`;

  // Add education section
  optimizedCV += `## EDUCATION
${sections.education ? formatEducation(sections.education) : 'Educational qualifications and credentials.'}

`;

  // Add languages section if available
  if (sections.languages) {
    optimizedCV += `## LANGUAGES
${formatLanguages(sections.languages)}

`;
  }

  return optimizedCV;
}

// Helper function to format competences in a clean three-column layout
function formatCompetences(skills: string): string {
  // Extract skills as bullet points
  const skillList = skills
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[•\-\*]+\s*/, '')) // Remove existing bullet markers
    .filter(line => !line.startsWith('#')); // Remove headers
    
  // Organize into a three-column layout (approximately)
  const column1 = skillList.slice(0, Math.ceil(skillList.length / 3));
  const column2 = skillList.slice(Math.ceil(skillList.length / 3), Math.ceil(2 * skillList.length / 3));
  const column3 = skillList.slice(Math.ceil(2 * skillList.length / 3));
  
  let formattedSkills = '';
  
  // Add first column
  for (const skill of column1) {
    formattedSkills += `• ${skill}\n`;
  }
  
  // Add second column (with spacing)
  for (const skill of column2) {
    formattedSkills += `• ${skill}\n`;
  }
  
  // Add third column
  for (const skill of column3) {
    formattedSkills += `• ${skill}\n`;
  }
  
  return formattedSkills.trim();
}

// Helper function to format experience with consistent date-first style
function formatExperience(experience: string): string {
  // Split into job blocks
  const jobBlocks = experience.split(/\n\s*\n/);
  let formattedExperience = '';
  
  for (const block of jobBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n');
    let dateRange = '';
    let company = '';
    let title = '';
    let location = '';
    let bullets = [];
    
    // Try to identify date, title, company
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Look for date patterns
      if (line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i) || 
          line.match(/\b\d{4}\s*[-–—]\s*(\d{4}|Present|Current|Now)\b/i) ||
          line.match(/\b\d{1,2}\/\d{4}\s*[-–—]\s*(\d{1,2}\/\d{4}|Present|Current|Now)\b/i)) {
        dateRange = line;
        continue;
      }
      
      // Look for company/title patterns (non-bullet lines near the top)
      if (!line.match(/^[•\-\*]/) && bullets.length === 0 && i < 4) {
        if (!title) {
          title = line;
        } else if (!company) {
          company = line;
        } else if (!location) {
          location = line;
        }
        continue;
      }
      
      // Collect bullet points
      if (line.match(/^[•\-\*]/) || bullets.length > 0) {
        // Add bullet if needed
        const bulletLine = line.replace(/^[•\-\*]\s*/, '');
        bullets.push(bulletLine.charAt(0).toUpperCase() + bulletLine.slice(1));
      }
    }
    
    // If no explicit dates found, look for year patterns in the first few lines
    if (!dateRange) {
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const yearMatch = lines[i].match(/\b(20\d{2}|19\d{2})\b/g);
        if (yearMatch && yearMatch.length >= 1) {
          if (yearMatch.length >= 2) {
            dateRange = `${yearMatch[0]} - ${yearMatch[1]}`;
          } else {
            dateRange = `${yearMatch[0]} - Present`;
          }
          break;
        }
      }
    }
    
    // Format using our standard layout
    formattedExperience += `${dateRange || 'Date Range'}\n`;
    formattedExperience += `${title || 'Job Title'}\n`;
    formattedExperience += `${company || 'COMPANY NAME'} - ${location || 'LOCATION'}\n`;
    
    // Add bullets
    if (bullets.length > 0) {
      formattedExperience += `• ${bullets[0]}\n`;
      
      // Add more bullets (up to 3 per job)
      for (let i = 1; i < Math.min(bullets.length, 3); i++) {
        formattedExperience += `• ${bullets[i]}\n`;
      }
    } else {
      formattedExperience += `• Responsibilities and achievements at this position\n`;
    }
    
    formattedExperience += '\n';
  }
  
  return formattedExperience.trim();
}

// Helper function to format education with consistent styling
function formatEducation(education: string): string {
  // Split into education blocks
  const eduBlocks = education.split(/\n\s*\n/);
  let formattedEducation = '';
  
  // If we have multiple education entries, format them properly
  if (eduBlocks.length > 1) {
    // Format as three-column layout for multiple institutions
    const institutions = eduBlocks.filter(block => block.trim().length > 0);
    
    for (let i = 0; i < Math.min(institutions.length, 3); i++) {
      const lines = institutions[i].split('\n');
      const school = lines.find(line => line.match(/university|college|school/i)) || lines[0] || 'UNIVERSITY OR SCHOOL';
      const degree = lines.find(line => line.match(/degree|diploma|bachelor|master|phd|certificate/i)) || lines[1] || 'Diploma Xxxxxxxxx';
      const year = lines.find(line => line.match(/\b(20\d{2}|19\d{2})\b/)) || '20XX';
      
      formattedEducation += `${school.toUpperCase()}\n${degree}\n${year}\n\n`;
    }
    
    return formattedEducation.trim();
  }
  
  // If just one entry, format it properly
  const lines = education.split('\n');
  const school = lines.find(line => line.match(/university|college|school/i)) || lines[0] || 'UNIVERSITY OR SCHOOL';
  const degree = lines.find(line => line.match(/degree|diploma|bachelor|master|phd|certificate/i)) || lines[1] || 'Diploma Xxxxxxxxx';
  const year = lines.find(line => line.match(/\b(20\d{2}|19\d{2})\b/)) || '20XX';
  
  return `${school.toUpperCase()}\n${degree}\n${year}`;
}

// Helper function to format languages with proficiency indicators
function formatLanguages(languages: string): string {
  const languageLines = languages.split('\n').filter(line => line.trim().length > 0);
  let formattedLanguages = '';
  
  const languageNames = ['English', 'German', 'Spanish', 'French', 'Chinese'];
  const detectedLanguages = [];
  
  // Extract actual languages from the text
  for (const line of languageLines) {
    for (const lang of languageNames) {
      if (line.toLowerCase().includes(lang.toLowerCase())) {
        detectedLanguages.push(lang);
        break;
      }
    }
  }
  
  // If no languages found, use default set
  const languagesToUse = detectedLanguages.length > 0 ? detectedLanguages : ['English', 'German', 'Spanish'];
  
  // Format each language with a proficiency indicator
  for (const lang of languagesToUse.slice(0, 3)) {
    formattedLanguages += `${lang}     █████████░░     \n`;
  }
  
  return formattedLanguages.trim();
}

// Helper functions for the fallback optimization
export function extractSections(text: string): Record<string, string> {
  // Initialize with more section types to better capture CV content
  const sections: Record<string, string> = {
    contact: '',
    profile: '',
    experience: '',
    education: '',
    skills: '',
    projects: '',
    certifications: '',
    languages: '',
    achievements: '',
    interests: '',
    publications: '',
    references: '',
    volunteer: '',
    awards: ''
  };
  
  // Simple parsing logic - in real app would be more sophisticated
  const lines = text.split('\n');
  let currentSection = 'profile';
  
  // First pass: detect section headers and phone numbers
  const phoneNumberPattern = /^\s*(\d{3}\s*\d{3}\s*\d{3}|\d{6,12})\s*$/;
  const phoneNumbers: string[] = [];
  
  // Detect potential section headers
  const sectionHeaderPattern = /^[\s\t]*(?:[A-Z][A-Z\s]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[\s\t]*(?::|$)/;
  const potentialSections: {line: number, title: string}[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect phone numbers
    if (phoneNumberPattern.test(line)) {
      phoneNumbers.push(line);
      // Add this to contact section
      sections.contact += `Phone: ${line}\n`;
      continue;
    }
    
    // Detect potential section headers
    if (sectionHeaderPattern.test(line)) {
      const title = line.replace(':', '').trim().toLowerCase();
      potentialSections.push({line: i, title});
    }
  }
  
  // Map detected section headers to our section keys
  const sectionMappings: Record<string, string[]> = {
    profile: ['profile', 'summary', 'about', 'objective', 'professional summary', 'career objective', 'personal statement'],
    experience: ['experience', 'work experience', 'employment', 'work history', 'professional experience', 'career history'],
    education: ['education', 'academic background', 'qualifications', 'academic', 'educational background', 'training'],
    skills: ['skills', 'technical skills', 'core competencies', 'key skills', 'competencies', 'expertise', 'professional skills'],
    projects: ['projects', 'key projects', 'project experience', 'portfolio'],
    certifications: ['certifications', 'certificates', 'professional certifications', 'credentials'],
    languages: ['languages', 'language proficiency', 'language skills'],
    achievements: ['achievements', 'accomplishments', 'key achievements'],
    interests: ['interests', 'hobbies', 'activities', 'personal interests'],
    publications: ['publications', 'papers', 'research', 'articles'],
    references: ['references', 'recommendations'],
    volunteer: ['volunteer', 'volunteering', 'community service', 'community involvement'],
    awards: ['awards', 'honors', 'recognitions']
  };
  
  // Second pass: assign content to sections based on detected headers
  let currentSectionStart = 0;
  
  for (let i = 0; i < potentialSections.length; i++) {
    const section = potentialSections[i];
    const nextSection = potentialSections[i + 1];
    const sectionEnd = nextSection ? nextSection.line : lines.length;
    
    // Find which of our section types this matches
    let matchedSection = 'profile'; // Default
    
    for (const [sectionKey, aliases] of Object.entries(sectionMappings)) {
      if (aliases.some(alias => section.title.includes(alias))) {
        matchedSection = sectionKey;
        break;
      }
    }
    
    // Extract content for this section
    const sectionContent = lines.slice(section.line + 1, sectionEnd).join('\n');
    sections[matchedSection] += sectionContent + '\n';
  }
  
  // Third pass: process the rest of the content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // Skip lines that are just phone numbers (already processed)
    if (phoneNumberPattern.test(line)) {
      continue;
    }
    
    // Skip lines that are section headers (already processed)
    if (potentialSections.some(section => section.line === i)) {
      continue;
    }
    
    // Detect section by content if not already assigned
    if (lowerLine.includes('@') || lowerLine.includes('email') || lowerLine.includes('phone') || lowerLine.includes('address')) {
      sections.contact += line + '\n';
    } else if (lowerLine.includes('university') || lowerLine.includes('college') || lowerLine.includes('degree') || lowerLine.includes('gpa')) {
      sections.education += line + '\n';
    } else if (lowerLine.includes('skill') || lowerLine.includes('proficient') || lowerLine.includes('expertise')) {
      sections.skills += line + '\n';
    } else {
      // If we can't determine the section, add to current section
      sections[currentSection] += line + '\n';
    }
  }
  
  // Ensure all sections are properly trimmed
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
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

// Export these functions so they can be used in other files
export function verifyContentPreservation(originalText: string, optimizedText: string): { 
  preserved: boolean; 
  missingItems: string[];
  keywordScore: number;
  industryKeywordScore: number;
} {
  // Extract critical keywords from both texts
  const originalKeywords = extractCriticalKeywords(originalText);
  const optimizedKeywords = extractCriticalKeywords(optimizedText);
  
  console.log(`Original keywords (${originalKeywords.length}): ${originalKeywords.slice(0, 10).join(', ')}...`);
  console.log(`Optimized keywords (${optimizedKeywords.length}): ${optimizedKeywords.slice(0, 10).join(', ')}...`);
  
  // Find missing keywords
  const missingItems: string[] = [];
  
  for (const keyword of originalKeywords) {
    // Check if the keyword or a similar form exists in the optimized text
    const keywordLower = keyword.toLowerCase();
    const keywordWithoutPunctuation = keywordLower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Check for exact match, substring match, or root word match
    const keywordExists = 
      optimizedText.toLowerCase().includes(keywordLower) || 
      optimizedText.toLowerCase().includes(keywordWithoutPunctuation) ||
      optimizedKeywords.some(k => 
        k.toLowerCase().includes(keywordLower) || 
        keywordLower.includes(k.toLowerCase())
      );
    
    if (!keywordExists) {
      missingItems.push(keyword);
    }
  }
  
  // Calculate keyword preservation score (percentage of keywords preserved)
  const keywordScore = originalKeywords.length > 0 
    ? Math.round(((originalKeywords.length - missingItems.length) / originalKeywords.length) * 100) 
    : 100;
  
  console.log(`Keyword preservation score: ${keywordScore}%`);
  console.log(`Missing keywords (${missingItems.length}): ${missingItems.slice(0, 10).join(', ')}...`);
  
  // Check for industry-specific keywords improvement
  // This helps ensure we're not just preserving but also enhancing
  const industries = ['software', 'finance', 'healthcare', 'marketing', 'engineering', 'sales', 'education', 'design'];
  let detectedIndustry = 'general';
  
  // Try to detect the industry from the text
  for (const industry of industries) {
    if (originalText.toLowerCase().includes(industry)) {
      detectedIndustry = industry;
      break;
    }
  }
  
  // Get industry-specific keywords
  const industryKeywords = getIndustrySpecificKeywords(detectedIndustry);
  
  // Count industry keywords in both texts
  let originalIndustryKeywordCount = 0;
  let optimizedIndustryKeywordCount = 0;
  
  for (const keyword of industryKeywords) {
    if (originalText.toLowerCase().includes(keyword.toLowerCase())) {
      originalIndustryKeywordCount++;
    }
    if (optimizedText.toLowerCase().includes(keyword.toLowerCase())) {
      optimizedIndustryKeywordCount++;
    }
  }
  
  // Calculate industry keyword improvement score
  const industryKeywordScore = originalIndustryKeywordCount > 0
    ? Math.round((optimizedIndustryKeywordCount / originalIndustryKeywordCount) * 100)
    : optimizedIndustryKeywordCount > 0 ? 150 : 100; // If original had none, but optimized has some, that's a 150% improvement
  
  console.log(`Industry keyword score: ${industryKeywordScore}%`);
  console.log(`Original industry keywords: ${originalIndustryKeywordCount}, Optimized: ${optimizedIndustryKeywordCount}`);
  
  // Determine if content is preserved based on keyword score and industry keyword improvement
  const preserved = keywordScore >= 95 && industryKeywordScore >= 100;
  
  // If not preserved but industry keywords improved significantly, we might still consider it a success
  const keywordImprovement = industryKeywordScore - 100;
  
  if (!preserved && keywordImprovement > 50) {
    console.log(`Despite missing some keywords, industry keyword count improved by ${keywordImprovement}%`);
  }
  
  if (!preserved && keywordImprovement < 0) {
    console.warn("Optimization FAILED: Lost industry-specific keywords");
  }
  
  return {
    preserved,
    missingItems,
    keywordScore,
    industryKeywordScore
  };
}

// Export the function so it can be imported in other files
export function extractCriticalKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // Identify technical skills (common programming languages, tools, etc.)
  const technicalSkillsPattern = /\b(javascript|typescript|python|java|c\+\+|react|angular|vue|node\.js|express|django|flask|aws|azure|gcp|docker|kubernetes|sql|mongodb|mysql|postgresql|nosql|rest|graphql|html|css|sass|less|git|ci\/cd|jenkins|jira|agile|scrum|machine learning|deep learning|artificial intelligence|ai|ml|blockchain|devops|data science)\b/gi;
  
  let match;
  while ((match = technicalSkillsPattern.exec(text)) !== null) {
    keywords.push(match[0].toLowerCase());
  }
  
  // Identify education and certifications
  const educationPattern = /\b(ph\.?d\.?|master'?s|mba|bachelor'?s|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|degree|certification|certified|license|licensed)\b/gi;
  while ((match = educationPattern.exec(text)) !== null) {
    keywords.push(match[0].toLowerCase());
  }
  
  // Extract company names (look for common company suffixes)
  const companyPattern = /\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\s+(Inc\.?|Corp\.?|LLC|Ltd\.?|Limited|Group|Solutions|Technologies|Systems)\b/g;
  while ((match = companyPattern.exec(text)) !== null) {
    keywords.push(match[0].toLowerCase());
  }
  
  // Extract job titles (common positions)
  const jobTitlePattern = /\b(senior|junior|lead|principal|staff|chief|head|director|manager|engineer|developer|architect|analyst|specialist|consultant|coordinator|administrator|advisor|officer|associate)\b\s+\b(\w+){1,3}\b/gi;
  while ((match = jobTitlePattern.exec(text)) !== null) {
    keywords.push(match[0].toLowerCase());
  }
  
  // Extract metrics and achievements
  const metricsPattern = /\b(\d+)[\s-]*(percent|%|million|k|thousand|billion)\b|increased|decreased|improved|reduced|saved|generated|delivered|managed|led|built|created|designed|implemented/gi;
  while ((match = metricsPattern.exec(text)) !== null) {
    keywords.push(match[0].toLowerCase());
  }
  
  // Extract phone numbers but don't add them as keywords
  // Just identify them for special handling in the optimization process
  const phonePattern = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{6,12}\b/g;
  const phoneNumbers: string[] = [];
  while ((match = phonePattern.exec(text)) !== null) {
    phoneNumbers.push(match[0]);
  }
  
  // Remove duplicates
  const uniqueKeywords = [...new Set(keywords)];
  
  return uniqueKeywords;
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
      line.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{6,12}\b/) || // Phone numbers
      line.includes('linkedin.com') // LinkedIn
    );
    
    if (contactLines.length > 0) {
      formattedText += "## CONTACT\n";
      formattedText += contactLines.join('\n') + '\n\n';
    }
    
    // Add a summary section
    formattedText += "## PROFESSIONAL SUMMARY\n\n";
    
    // Add an experience section
    formattedText += "## PROFESSIONAL EXPERIENCE\n\n";
    
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

// New function to optimize CV based on analysis data
export async function optimizeCVWithAnalysis(
  cvText: string,
  analysisMetadata: any,
  template?: CVTemplate
): Promise<{ optimizedText: string; error?: string }> {
  try {
    console.log("Starting analysis-driven CV optimization process");
    
    // Input validation
    if (!cvText || cvText.trim().length === 0) {
      console.error("Empty CV text provided to optimization");
      return { 
        optimizedText: "", 
        error: "Empty CV text provided" 
      };
    }
    
    if (!analysisMetadata) {
      console.error("Missing analysis metadata for optimization");
      return {
        optimizedText: "",
        error: "Analysis metadata required for intelligent optimization"
      };
    }
    
    // Extract key information from analysis
    const industry = analysisMetadata.industry || "General";
    const atsScore = analysisMetadata.atsScore || 0;
    const strengths = analysisMetadata.strengths || [];
    const weaknesses = analysisMetadata.weaknesses || [];
    const missingKeywords = analysisMetadata.missingKeywords || [];
    const recommendations = analysisMetadata.recommendations || [];
    
    console.log(`Optimizing for ${industry} industry with base ATS score: ${atsScore}`);
    console.log(`Missing keywords to incorporate: ${missingKeywords.join(', ')}`);
    
    // Get template layout
    let layout = 'two-column';
    let headerStyle = 'modern';
    
    if (template) {
      console.log(`Using template: ${template.name}`);
      layout = template.metadata?.layout || layout;
      const templateLayout = getTemplateLayout(template.id);
      headerStyle = templateLayout.headerStyle || headerStyle;
    }
    
    // Extract all keywords from the original CV to ensure preservation
    const originalKeywords = extractCriticalKeywords(cvText);
    console.log(`Extracted ${originalKeywords.length} critical keywords from original CV`);
    
    // Get additional industry-specific keywords to boost ATS score
    const additionalKeywords = getIndustrySpecificKeywords(industry);
    console.log(`Adding ${additionalKeywords.length} industry-specific keywords`);
    
    // Build industry-specific optimization instructions
    const industryInstructions = getIndustrySpecificInstructions(industry);
    
    // Build keyword optimization instructions with emphasis on preservation
    const keywordInstructions = `
CRITICAL: Preserve ALL of these original keywords (do not remove any of them):
${originalKeywords.join(', ')}

Additionally, incorporate these industry-specific keywords naturally throughout the CV:
${additionalKeywords.join(', ')}

${missingKeywords.length > 0 
  ? `Also add these missing keywords that will improve ATS score: ${missingKeywords.join(', ')}`
  : 'Ensure all industry-specific keywords are included and properly highlighted.'}
`;
    
    // Build weakness remediation instructions
    const weaknessRemediation = weaknesses.length > 0
      ? `Address these CV weaknesses: ${weaknesses.join('. ')}.`
      : "Strengthen any weak sections of the CV.";
    
    // Extract sections more reliably by using a more robust extraction method
    const sections = enhancedExtractSections(cvText);
    
    // Perform deduplication check - remove duplicate section content
    const deduplicatedSections = deduplicateSections(sections);
    
    // Enhance sections with analysis data
    const enhancedSections = enhanceSectionsWithAnalysis(deduplicatedSections, analysisMetadata);
    
    // Apply length control to prevent overflow
    const lengthControlledSections = applyLengthControlToSections(enhancedSections);
    
    // Custom prompt based on analysis data with stronger emphasis on ATS optimization
    const optimizationPrompt = `
You are a professional CV/resume optimization expert with specialization in the ${industry} industry.

The CV you're optimizing currently has an ATS (Applicant Tracking System) score of ${atsScore}/100.
Your task is to optimize this CV to achieve a HIGHER ATS score while maintaining a professional, 
human-readable format that appeals to hiring managers.

${industryInstructions}

${keywordInstructions}

${weaknessRemediation}

Key strengths to emphasize:
${strengths.map((s: string) => `- ${s}`).join('\n')}

CRITICAL ATS OPTIMIZATION RULES:
1. NEVER remove ANY keywords from the original CV - keyword preservation is the highest priority
2. Quantify achievements with specific metrics (%, $, numbers) wherever possible
3. Use standard job titles and industry terminology
4. Organize information in a clear, scannable format with proper section headers
5. Include all educational credentials, certifications, and specialized training
6. Format dates consistently (MM/YYYY format preferred)
7. Use both acronyms AND their expanded forms where appropriate (e.g., "AI (Artificial Intelligence)")
8. Add the industry-specific keywords provided above to boost ATS score
9. Ensure the optimized version has MORE relevant keywords than the original

CONTENT ORGANIZATION:
1. Begin with a strong professional summary that highlights core competencies
2. Include a dedicated ACHIEVEMENTS section with 3-5 bullet points of quantified accomplishments
3. Organize experience in reverse chronological order
4. For each position, lead with accomplishments rather than responsibilities
5. Format skills section for maximum ATS visibility
6. Use industry-standard section headings
7. Use bullet points for better readability

FORMATTING INSTRUCTIONS:
${layout === 'one-column' 
  ? 'Format as a single-column document with clear section headers.'
  : 'Format with a main column and a sidebar. Put contact info, skills, education in the sidebar. Put experience and projects in the main column.'}
Use bullet points for achievements.
Ensure all text is black and professional.
Optimize for a single page layout if possible.

Original CV Text:
${cvText}
`;

    // Call the AI service for enhanced optimization
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvText,
          analysisMetadata: JSON.stringify(analysisMetadata),
          templateId: template?.id || 'default',
          optimizationPrompt,
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
      
      // Verify that optimized content preserves critical elements
      const verification = verifyContentPreservation(cvText, result.optimizedCV);
      
      // If verification fails, try to recover
      if (!verification.preserved) {
        console.warn(`Content verification failed. Score: ${verification.keywordScore}%. Attempting recovery...`);
        
        // Incorporate missing keywords into the optimized text
        const recoveredText = incorporateMissingItems(result.optimizedCV, verification.missingItems, sections);
        
        // Add additional industry keywords to further boost ATS score
        const enhancedText = addIndustryKeywords(recoveredText, additionalKeywords);
        
        return {
          optimizedText: enhancedText,
        };
      }
      
      // Even if verification passed, still add industry keywords to boost ATS score
      const enhancedText = addIndustryKeywords(result.optimizedCV, additionalKeywords);
      
      return {
        optimizedText: enhancedText,
      };
    } catch (apiError: unknown) {
      console.error("API error during optimization:", apiError);
      
      // Fallback to local optimization if API fails
      console.log("Using local fallback optimization");
      const fallbackOptimized = createEnhancedOptimizedCV(cvText, template?.name || 'default', analysisMetadata);
      
      return {
        optimizedText: fallbackOptimized,
        error: `API error (using fallback): ${apiError instanceof Error ? apiError.message : String(apiError)}`
      };
    }
  } catch (error: unknown) {
    console.error("Error in optimization process:", error);
    return {
      optimizedText: "",
      error: `Optimization failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Export the function so it can be imported in other files
export function getIndustrySpecificKeywords(industry: string): string[] {
  const keywords: Record<string, string[]> = {
    'Technology': [
      'agile methodology', 'scrum', 'continuous integration', 'continuous deployment', 
      'software development lifecycle', 'SDLC', 'test-driven development', 'TDD',
      'object-oriented programming', 'OOP', 'RESTful API', 'microservices',
      'cloud computing', 'scalability', 'version control', 'git', 'CI/CD pipeline'
    ],
    'Finance': [
      'financial analysis', 'risk assessment', 'portfolio management', 'asset allocation',
      'financial modeling', 'forecasting', 'budgeting', 'cost reduction', 'ROI analysis',
      'financial reporting', 'compliance', 'regulatory requirements', 'audit',
      'investment strategy', 'cash flow management', 'financial planning'
    ],
    'Marketing': [
      'digital marketing', 'content strategy', 'SEO optimization', 'SEM', 'PPC campaigns',
      'social media marketing', 'brand development', 'market research', 'customer acquisition',
      'conversion rate optimization', 'CRO', 'marketing analytics', 'A/B testing',
      'email marketing', 'marketing automation', 'customer journey mapping'
    ],
    'Healthcare': [
      'patient care', 'clinical documentation', 'healthcare compliance', 'HIPAA',
      'electronic health records', 'EHR', 'medical coding', 'quality improvement',
      'patient safety', 'care coordination', 'clinical workflow', 'healthcare informatics',
      'evidence-based practice', 'patient outcomes', 'healthcare management'
    ],
    'Sales': [
      'revenue generation', 'sales pipeline', 'lead qualification', 'account management',
      'client relationship', 'sales forecasting', 'territory management', 'quota attainment',
      'customer retention', 'upselling', 'cross-selling', 'sales strategy',
      'negotiation', 'closing techniques', 'CRM management', 'sales analytics'
    ],
    'General': [
      'project management', 'team leadership', 'strategic planning', 'process improvement',
      'stakeholder management', 'cross-functional collaboration', 'problem-solving',
      'data analysis', 'performance metrics', 'KPI tracking', 'resource allocation',
      'budget management', 'quality assurance', 'continuous improvement'
    ]
  };
  
  // Get keywords for the specific industry or use general keywords
  const industryKeywords = keywords[industry] || keywords['General'];
  
  // Add some general keywords that are valuable across industries
  const generalKeywords = [
    'leadership', 'communication', 'collaboration', 'analytical skills',
    'problem-solving', 'time management', 'attention to detail', 'innovation'
  ];
  
  // Combine and return unique keywords
  return [...new Set([...industryKeywords, ...generalKeywords])];
}

// New function to add industry keywords to optimized text
function addIndustryKeywords(optimizedText: string, industryKeywords: string[]): string {
  // Check if the text already contains each keyword
  const lowerText = optimizedText.toLowerCase();
  const missingKeywords = industryKeywords.filter(keyword => !lowerText.includes(keyword.toLowerCase()));
  
  // If no missing keywords, return the original text
  if (missingKeywords.length === 0) {
    return optimizedText;
  }
  
  // Try to add keywords to the skills section
  if (optimizedText.includes('## SKILLS') || optimizedText.includes('## Skills')) {
    // Find the skills section
    const skillsRegex = /##\s*SKILLS.*?(?=##|$)/is;
    const skillsMatch = optimizedText.match(skillsRegex);
    
    if (skillsMatch) {
      const skillsSection = skillsMatch[0];
      const skillsSectionIndex = optimizedText.indexOf(skillsSection);
      
      // Create a new skills section with additional keywords
      let newSkillsSection = skillsSection;
      
      // Add missing keywords as bullet points
      newSkillsSection += '\n\nAdditional Industry Expertise:\n';
      for (const keyword of missingKeywords.slice(0, 5)) { // Limit to 5 keywords
        newSkillsSection += `• ${keyword}\n`;
      }
      
      // Replace the old skills section with the new one
      return (
        optimizedText.substring(0, skillsSectionIndex) + 
        newSkillsSection + 
        optimizedText.substring(skillsSectionIndex + skillsSection.length)
      );
    }
  }
  
  // If no skills section or couldn't modify it, add a new section
  if (missingKeywords.length > 0) {
    let additionalSection = '\n\n## ADDITIONAL EXPERTISE\n';
    for (const keyword of missingKeywords.slice(0, 8)) { // Limit to 8 keywords
      additionalSection += `• ${keyword}\n`;
    }
    
    return optimizedText + additionalSection;
  }
  
  return optimizedText;
}

// Add a content length control function to prevent overflow
function controlContentLength(text: string, section: string): string {
  // Define maximum recommended characters per section
  const sectionLimits: Record<string, number> = {
    profile: 500,
    experience: 1500,
    education: 500,
    skills: 600,
    achievements: 400,
    default: 600
  };
  
  const limit = sectionLimits[section] || sectionLimits.default;
  
  // If content exceeds limit, trim it while preserving structure
  if (text.length > limit) {
    // Split into bullet points
    const bullets = text.split('\n').filter(line => line.trim().length > 0);
    let result = '';
    let currentLength = 0;
    
    // Add bullets until we approach the limit
    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i].trim();
      
      // Always include the first three bullets for each section
      if (i < 3 || currentLength + bullet.length <= limit) {
        result += bullet + '\n';
        currentLength += bullet.length + 1;
      } else {
        // Stop adding content
        break;
      }
    }
    
    return result.trim();
  }
  
  return text;
}

// Update the appropriate functions to use content length control
function enhanceSectionsWithAnalysis(sections: Record<string, string>, analysis: any): Record<string, string> {
  const enhanced = { ...sections };
  
  // Track which sections we've already processed to prevent duplication
  const processedSections = new Set<string>();
  
  // Enhance summary/profile with industry keywords and strengths
  if (enhanced.profile && analysis.strengths) {
    const strengths = analysis.strengths.join(', ');
    const keywords = analysis.missingKeywords ? analysis.missingKeywords.join(', ') : '';
    
    enhanced.profile = `Experienced ${analysis.industry || ''} professional with expertise in ${strengths}. ${enhanced.profile}`;
    
    // Add missing keywords naturally if possible
    if (keywords && !enhanced.profile.toLowerCase().includes(keywords.toLowerCase())) {
      enhanced.profile += ` Skilled in ${keywords}.`;
    }
    processedSections.add('profile');
  }
  
  // Process experience section
  if (enhanced.experience) {
    const experienceLines = enhanced.experience.split('\n');
    let bulletedExperience = '';
    let currentParagraph = '';
    
    // Process experience text and convert paragraphs to bullet points
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Skip empty lines
      if (line === '') {
        if (currentParagraph) {
          // Convert paragraph to bullet points
          const bulletPoints = convertParagraphToBullets(currentParagraph);
          bulletedExperience += bulletPoints + '\n\n';
          currentParagraph = '';
        }
        continue;
      }
      
      // If line looks like a header or job title, add it directly
      if (line.length < 30 || line.includes(':') || /^\s*•/.test(line)) {
        // First add any accumulated paragraph text as bullets
        if (currentParagraph) {
          const bulletPoints = convertParagraphToBullets(currentParagraph);
          bulletedExperience += bulletPoints + '\n\n';
          currentParagraph = '';
        }
        
        // Add the header/title line
        bulletedExperience += line + '\n';
      } else {
        // Accumulate paragraph text
        currentParagraph += ' ' + line;
      }
    }
    
    // Process any remaining paragraph
    if (currentParagraph) {
      const bulletPoints = convertParagraphToBullets(currentParagraph);
      bulletedExperience += bulletPoints;
    }
    
    // Apply quantification
    enhanced.experience = quantifyAchievements(bulletedExperience);
    processedSections.add('experience');
  }
  
  // Process skills section, but only if not already processed
  if (enhanced.skills && !processedSections.has('skills')) {
    // Clean up skills section by removing ### markers and ensuring proper formatting
    let enhancedSkills = enhanced.skills.trim();
    
    // Convert to bullet points if not already and remove ### markers
    if (!enhancedSkills.includes('•')) {
      enhancedSkills = enhancedSkills.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^###\s*/, '')) // Remove ### markers
        .map(line => {
          // Limit line length to prevent overflow
          if (line.length > 50) {
            return `• ${line.substring(0, 50)}...`;
          }
          return `• ${line}`;
        })
        .join('\n');
    }
    
    // Add industry keywords as bullet points
    const skillsLower = enhancedSkills.toLowerCase();
    const keywordsToAdd = analysis.industryKeywords || getIndustrySpecificKeywords(analysis.industry || "General")
      .filter((kw: string) => !skillsLower.includes(kw.toLowerCase()))
      .slice(0, 4); // Limit to fewer keywords to prevent overflow
    
    if (keywordsToAdd.length > 0) {
      enhancedSkills += '\n\n// Additional Industry Expertise\n';
      for (const keyword of keywordsToAdd) {
        enhancedSkills += `• ${keyword}\n`;
      }
    }
    
    enhanced.skills = enhancedSkills;
    processedSections.add('skills');
  } else if (!enhanced.skills && !processedSections.has('skills')) {
    // If no skills section, create one with industry keywords
    enhanced.skills = `### Technical Skills:\n${
      analysis.industryKeywords 
        ? analysis.industryKeywords.slice(0, 5).map((kw: string) => `• ${kw}`).join('\n') 
        : ''
    }\n\n### Professional Skills:\n${
      analysis.industryKeywords 
        ? analysis.industryKeywords.slice(5, 10).map((kw: string) => `• ${kw}`).join('\n')
        : ''
    }`;
    processedSections.add('skills');
  }
  
  // For all other sections, ensure they're only processed once
  for (const key of Object.keys(enhanced)) {
    if (!processedSections.has(key)) {
      enhanced[key] = convertToBulletPointsIfNeeded(enhanced[key]);
      processedSections.add(key);
    }
  }
  
  // Apply length control to each section after enhancement
  for (const key of Object.keys(enhanced)) {
    enhanced[key] = controlContentLength(enhanced[key], key);
  }
  
  return enhanced;
}

// Helper function to convert a paragraph to bullet points
function convertParagraphToBullets(paragraph: string): string {
  // Trim and normalize spaces
  const text = paragraph.trim().replace(/\s+/g, ' ');
  
  // If very short, just return as a single bullet
  if (text.length < 100) {
    return `• ${text}`;
  }
  
  // Try to split into logical parts for multiple bullets
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  // If only one sentence or very short, return as single bullet
  if (sentences.length === 1 || text.length < 150) {
    return `• ${text}`;
  }
  
  // Group sentences into 2-3 bullet points
  const bulletCount = sentences.length < 4 ? sentences.length : 3;
  const sentencesPerBullet = Math.ceil(sentences.length / bulletCount);
  let bullets = '';
  
  for (let i = 0; i < bulletCount; i++) {
    const startIndex = i * sentencesPerBullet;
    const endIndex = Math.min(startIndex + sentencesPerBullet, sentences.length);
    const bulletText = sentences.slice(startIndex, endIndex).join(' ').trim();
    
    if (bulletText) {
      bullets += `• ${bulletText}\n`;
    }
  }
  
  return bullets;
}

// Function to convert text to bullet points if it's not already
function convertToBulletPointsIfNeeded(text: string): string {
  const lines = text.split('\n');
  let result = '';
  let inParagraph = false;
  let paragraph = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      // Empty line - end any current paragraph
      if (inParagraph) {
        result += convertParagraphToBullets(paragraph) + '\n\n';
        paragraph = '';
        inParagraph = false;
      }
      result += '\n';
      continue;
    }
    
    // Already a bullet point or header - add directly
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
        line.length < 30 && (line.endsWith(':') || line.toUpperCase() === line)) {
      // End any current paragraph first
      if (inParagraph) {
        result += convertParagraphToBullets(paragraph) + '\n\n';
        paragraph = '';
        inParagraph = false;
      }
      result += line + '\n';
    } else {
      // Part of a paragraph
      inParagraph = true;
      paragraph += ' ' + line;
    }
  }
  
  // Process any final paragraph
  if (inParagraph) {
    result += convertParagraphToBullets(paragraph);
  }
  
  return result;
}

// Function to get industry-specific instructions
function getIndustrySpecificInstructions(industry: string): string {
  const instructions: Record<string, string> = {
    'Technology': `
- Highlight technical skills, programming languages, and frameworks prominently
- Include GitHub/project links if available
- Quantify impact of technical implementations (e.g., performance improvements, scale)
- Use specific version numbers for technologies where applicable
- Group skills by category (languages, frameworks, tools, etc.)
    `,
    'Finance': `
- Emphasize financial metrics, portfolio performance, and cost savings
- Include specific financial tools and software proficiency
- Highlight regulatory compliance knowledge and certifications
- Quantify financial achievements with precise figures
- Emphasize analytical skills and attention to detail
    `,
    'Marketing': `
- Focus on campaign metrics, ROI, and growth statistics
- Highlight experience with specific platforms and analytics tools
- Include content creation and social media management expertise
- Quantify audience growth, engagement, and conversion rates
- Emphasize creative and analytical capabilities equally
    `,
    'Healthcare': `
- Highlight patient care metrics and quality improvement initiatives
- Include all certifications, licenses, and compliance knowledge
- Emphasize specialized medical terminology relevant to your specialty
- Quantify patient outcomes and efficiency improvements
- Include experience with specific medical systems and technologies
    `,
    'Sales': `
- Lead with sales achievement metrics and quota attainment
- Quantify client acquisition, retention rates, and revenue growth
- Highlight experience with specific CRM tools and sales methodologies
- Include industry-specific sales expertise and market knowledge
- Emphasize relationship-building and negotiation skills
    `,
    'General': `
- Quantify achievements across all roles with specific metrics
- Highlight transferable skills applicable across industries
- Include both technical and soft skills with concrete examples
- Use industry-standard terminology and avoid jargon
- Emphasize problem-solving capabilities with specific examples
    `
  };
  
  return instructions[industry] || instructions['General'];
}

// Function to quantify achievements in experience section
function quantifyAchievements(experienceText: string): string {
  // Split experience into lines
  const lines = experienceText.split('\n');
  
  // Process each line
  const processedLines = lines.map(line => {
    // Skip headers and job titles
    if (line.trim().length < 10 || line.includes(':') || /^\s*•/.test(line)) {
      return line;
    }
    
    // Check if the line already contains metrics
    const hasMetrics = /\d+%|\$\d+|\d+ (percent|million|thousand|users|customers|clients|projects)/.test(line);
    
    if (!hasMetrics && line.length > 20) {
      // If line contains [QUANTIFY], replace it with actual metrics based on context
      if (line.includes('[QUANTIFY]')) {
        // Get the context of the line
        const lowerLine = line.toLowerCase();
        
        // Replace with appropriate metrics based on context
        if (lowerLine.includes('first year') || lowerLine.includes('accomplish')) {
          return line.replace('[QUANTIFY]', 'achieving 30% above expected targets and reducing onboarding time by 20%');
        }
        else if (lowerLine.includes('project') || lowerLine.includes('participate')) {
          return line.replace('[QUANTIFY]', 'contributing to 3-5 key projects that increased overall efficiency by 25%');
        }
        else if (lowerLine.includes('improvement') || lowerLine.includes('prepare')) {
          return line.replace('[QUANTIFY]', 'improving operational efficiency by 15-20% through strategic planning');
        }
        else if (lowerLine.includes('execution') || lowerLine.includes('participating')) {
          return line.replace('[QUANTIFY]', 'resulting in 40% faster project completion and 25% cost reduction');
        }
        else if (lowerLine.includes('weakness')) {
          return line.replace('[QUANTIFY]', 'leveraging my creative background to solve problems 35% more efficiently than traditional approaches');
        }
        else if (lowerLine.includes('creative ideas') || lowerLine.includes('contribute')) {
          return line.replace('[QUANTIFY]', 'generating 12+ innovative solutions that increased client satisfaction by 28%');
        }
        else if (lowerLine.includes('diploma') || lowerLine.includes('base')) {
          return line.replace('[QUANTIFY]', 'providing an analytical framework that improves decision-making by 40%');
        }
        else if (lowerLine.includes('finance') || lowerLine.includes('knowledge')) {
          return line.replace('[QUANTIFY]', 'completing 4 specialized courses with a 95% average score');
        }
        else if (lowerLine.includes('projects') || lowerLine.includes('analytical')) {
          return line.replace('[QUANTIFY]', 'improving project outcomes by 32% through data-driven decision making');
        }
        else {
          // Generic quantification if context not recognized
          return line.replace('[QUANTIFY]', 'improving results by 25-30% compared to previous approaches');
        }
      } else {
        // Add metrics to lines without [QUANTIFY] or existing metrics
        if (line.includes('expertise') || line.includes('skills')) {
          return line + ' with 95% proficiency';
        }
        else if (line.includes('project') || line.includes('manage')) {
          return line + ', completing projects 20% ahead of schedule';
        }
        else if (line.includes('create') || line.includes('develop')) {
          return line + ', increasing efficiency by 30%';
        }
        else {
          return line;
        }
      }
    }
    
    return line;
  });
  
  return processedLines.join('\n');
}

// Function to incorporate missing items into optimized text
function incorporateMissingItems(optimizedText: string, missingItems: string[], originalSections: Record<string, string>): string {
  if (missingItems.length === 0) {
    return optimizedText;
  }
  
  console.log(`Incorporating ${missingItems.length} missing items into optimized text`);
  
  // Create a skills addition if items are short (likely keywords)
  const shortItems = missingItems.filter(item => item.length < 30);
  const longItems = missingItems.filter(item => item.length >= 30);
  
  let enhancedText = optimizedText;
  
  // Add short items to skills section
  if (shortItems.length > 0) {
    const skillsHeader = '## SKILLS';
    if (enhancedText.includes(skillsHeader)) {
      const skillsSection = enhancedText.split(skillsHeader)[1].split('##')[0];
      const updatedSkillsSection = skillsSection + `\n\nAdditional expertise: ${shortItems.join(', ')}`;
      enhancedText = enhancedText.replace(skillsSection, updatedSkillsSection);
    } else {
      // Add skills section if not present
      enhancedText += `\n\n## ADDITIONAL SKILLS\n${shortItems.join(', ')}\n`;
    }
  }
  
  // Add longer items to appropriate sections or as notes
  if (longItems.length > 0) {
    enhancedText += '\n\n## ADDITIONAL INFORMATION\n';
    for (const item of longItems) {
      enhancedText += `• ${item}\n`;
    }
  }
  
  return enhancedText;
}

// Enhanced fallback function with analysis integration
function createEnhancedOptimizedCV(originalText: string, templateName: string, analysis: any = null): string {
  console.log(`Creating enhanced optimized CV with template: ${templateName}`);
  
  // Extract sections from the original text
  const sections = extractSections(originalText);
  
  // If no analysis was provided, perform one now
  if (!analysis) {
    analysis = analyzeCVContent(originalText);
  }
  
  // Get industry-specific keywords to boost ATS score
  const detectedIndustry = detectIndustry(originalText);
  const industryKeywords = getIndustrySpecificKeywords(detectedIndustry);
  
  // Extract original keywords to ensure preservation
  const originalKeywords = extractCriticalKeywords(originalText);
  
  // Create a more structured CV with analysis insights
  let optimizedCV = ``;

  // Only add sections that actually have content
  if (sections.contact && sections.contact.trim()) {
    optimizedCV += `## CONTACT\n${sections.contact.trim()}\n\n`;
  }

  // Add achievements section only if we have content
  let achievementsContent = sections.achievements || '';
  if (achievementsContent && achievementsContent.trim()) {
    // ... existing achievement processing ...
    optimizedCV += `## ACHIEVEMENTS\n${achievementsContent}\n\n`;
  }

  // Only add summary if we have content
  if (sections.profile && sections.profile.trim()) {
    // Enhance the profile with industry keywords
    let enhancedProfile = sections.profile.trim();
    
    // Add industry keywords if not already present
    const profileLower = enhancedProfile.toLowerCase();
    const keywordsToAdd = industryKeywords
      .slice(0, 3) // Take just a few keywords for the profile
      .filter((kw: string) => !profileLower.includes(kw.toLowerCase()));
    
    if (keywordsToAdd.length > 0) {
      enhancedProfile += ` Skilled in ${keywordsToAdd.join(', ')}.`;
    }
    
    optimizedCV += `## PROFESSIONAL SUMMARY\n${enhancedProfile}\n\n`;
  }

  // Only add experience if we have content
  if (sections.experience && sections.experience.trim()) {
    // Ensure experience has quantified achievements
    const quantifiedExperience = quantifyAchievements(sections.experience.trim());
    
    // Convert to bullet points if not already
    const bulletedExperience = convertToBulletPointsIfNeeded(quantifiedExperience);
    
    optimizedCV += `## PROFESSIONAL EXPERIENCE\n${bulletedExperience}\n\n`;
  }

  // Continue with other sections, only adding them if they have content
  // ... 
  
  return optimizedCV;
}

/**
 * Analyzes a CV to identify strengths and areas for improvement
 * @param cvText The original CV text
 * @returns Analysis results with improvement suggestions
 */
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
  // Initialize results
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvementSuggestions: Record<string, string[]> = {
    content: [],
    formatting: [],
    keywords: [],
    achievements: []
  };
  
  // Extract sections for analysis
  const sections = extractSections(cvText);
  
  // Metrics tracking
  let quantifiedAchievements = 0;
  let actionVerbs = 0;
  let technicalTerms = 0;
  let industryKeywords = 0;
  
  // Check for quantified achievements
  const quantifiedPattern = /\b(\d+%|\d+\s*percent|\$\d+|\d+\s*million|\d+\s*billion|\d+\s*users|\d+\s*customers|\d+\s*clients|\d+\s*projects|\d+\s*times|\d+\s*days|\d+\s*months|\d+\s*years)\b/gi;
  const quantifiedMatches = cvText.match(quantifiedPattern) || [];
  quantifiedAchievements = quantifiedMatches.length;
  
  // Check for action verbs
  const actionVerbPattern = /\b(achieved|improved|increased|decreased|developed|created|implemented|managed|led|designed|launched|reduced|generated|delivered|streamlined|enhanced|transformed|optimized|negotiated|secured)\b/gi;
  const actionVerbMatches = cvText.match(actionVerbPattern) || [];
  actionVerbs = actionVerbMatches.length;
  
  // Check for technical terms
  const technicalTermPattern = /\b(javascript|python|java|c\+\+|react|angular|vue|node\.js|express|django|flask|aws|azure|gcp|docker|kubernetes|sql|mongodb|mysql|postgresql|nosql|rest|graphql|html|css|sass|less|git|ci\/cd|jenkins|jira|agile|scrum|machine learning|deep learning|artificial intelligence|ai|ml|blockchain|devops|data science)\b/gi;
  const technicalMatches = cvText.match(technicalTermPattern) || [];
  technicalTerms = technicalMatches.length;
  
  // Check for industry keywords
  const detectedIndustry = detectIndustry(cvText);
  const industrySpecificKeywords = getIndustrySpecificKeywords(detectedIndustry);
  
  for (const keyword of industrySpecificKeywords) {
    if (cvText.toLowerCase().includes(keyword.toLowerCase())) {
      industryKeywords++;
    }
  }
  
  // Analyze strengths
  if (quantifiedAchievements >= 3) {
    strengths.push("Good use of quantified achievements");
  }
  
  if (actionVerbs >= 10) {
    strengths.push("Strong action verbs throughout the CV");
  }
  
  if (technicalTerms >= 5) {
    strengths.push("Good inclusion of technical terms");
  }
  
  if (industryKeywords >= 5) {
    strengths.push("Good use of industry-specific keywords");
  }
  
  if (sections.profile && sections.profile.length > 100) {
    strengths.push("Comprehensive professional summary");
  }
  
  // Analyze weaknesses and suggest improvements
  if (quantifiedAchievements < 3) {
    weaknesses.push("Limited quantified achievements");
    improvementSuggestions.achievements.push("Add more measurable results with percentages or numbers");
  }
  
  if (actionVerbs < 10) {
    weaknesses.push("Limited use of action verbs");
    improvementSuggestions.content.push("Use more powerful action verbs to describe your experience");
  }
  
  if (technicalTerms < 5 && (detectedIndustry === 'software' || detectedIndustry === 'engineering')) {
    weaknesses.push("Limited technical terminology");
    improvementSuggestions.keywords.push("Include more technical terms relevant to your field");
  }
  
  if (industryKeywords < 5) {
    weaknesses.push("Limited industry-specific keywords");
    improvementSuggestions.keywords.push("Add more keywords specific to your industry");
  }
  
  if (!sections.profile || sections.profile.length < 50) {
    weaknesses.push("Missing or brief professional summary");
    improvementSuggestions.content.push("Add a comprehensive professional summary highlighting your key strengths");
  }
  
  if (!sections.skills || sections.skills.length < 50) {
    weaknesses.push("Limited skills section");
    improvementSuggestions.content.push("Expand your skills section with relevant technical and soft skills");
  }
  
  // Check for bullet points in experience section
  if (sections.experience && !sections.experience.includes('•') && !sections.experience.includes('-')) {
    weaknesses.push("Experience not formatted with bullet points");
    improvementSuggestions.formatting.push("Format your experience with bullet points for better readability");
  }
  
  return {
    strengths,
    weaknesses,
    improvementSuggestions,
    metrics: {
      quantifiedAchievements,
      actionVerbs,
      technicalTerms,
      industryKeywords
    }
  };
}

/**
 * Detects the most likely industry based on CV content
 * @param text The CV text
 * @returns The detected industry
 */
function detectIndustry(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Define industry-specific keyword patterns
  const industries: Record<string, RegExp> = {
    software: /\b(software|developer|programming|code|web|app|application|frontend|backend|fullstack|javascript|python|java|c\+\+|react|angular|vue|node\.js)\b/gi,
    finance: /\b(finance|financial|accounting|accountant|banking|investment|portfolio|assets|liabilities|audit|tax|revenue|profit|loss|budget|forecast)\b/gi,
    healthcare: /\b(healthcare|medical|clinical|patient|doctor|nurse|physician|hospital|clinic|care|treatment|therapy|diagnosis|health|wellness)\b/gi,
    marketing: /\b(marketing|brand|campaign|social media|digital|content|seo|sem|analytics|audience|customer|consumer|market research|advertising|promotion)\b/gi,
    engineering: /\b(engineering|engineer|mechanical|electrical|civil|structural|design|cad|technical|specification|project|construction|manufacturing)\b/gi,
    sales: /\b(sales|revenue|client|customer|account|business development|pipeline|quota|target|prospect|lead|conversion|close|negotiate|deal)\b/gi,
    education: /\b(education|teaching|teacher|professor|student|school|university|college|curriculum|course|class|lecture|learning|academic|faculty)\b/gi,
    design: /\b(design|designer|creative|ui|ux|user interface|user experience|graphic|visual|layout|typography|illustration|brand|aesthetic)\b/gi
  };
  
  // Count matches for each industry
  const matches: Record<string, number> = {};
  
  for (const [industry, pattern] of Object.entries(industries)) {
    const industryMatches = (text.match(pattern) || []).length;
    matches[industry] = industryMatches;
  }
  
  // Find the industry with the most matches
  let maxMatches = 0;
  let detectedIndustry = 'general';
  
  for (const [industry, count] of Object.entries(matches)) {
    if (count > maxMatches) {
      maxMatches = count;
      detectedIndustry = industry;
    }
  }
  
  return detectedIndustry;
}

// New helper function to deduplicate sections
function deduplicateSections(sections: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(sections)) {
    // Skip empty sections
    if (!value || !value.trim()) continue;
    
    // Handle potential duplicates (e.g., "skills" and "skill set")
    const normalizedKey = normalizeKeyName(key);
    
    if (result[normalizedKey]) {
      // If section already exists, append unique content
      const existingContent = result[normalizedKey].toLowerCase();
      const newContent = value
        .split('\n')
        .filter(line => {
          const trimmedLine = line.trim().toLowerCase();
          return trimmedLine && !existingContent.includes(trimmedLine);
        })
        .join('\n');
      
      if (newContent) {
        result[normalizedKey] += '\n' + newContent;
      }
    } else {
      result[normalizedKey] = value;
    }
  }
  
  return result;
}

// Function to normalize section names
function normalizeKeyName(key: string): string {
  const mappings: Record<string, string> = {
    'skill': 'skills',
    'skill set': 'skills',
    'technical skills': 'skills',
    'key skills': 'skills',
    'core skills': 'skills',
    'competencies': 'skills',
    
    'work': 'experience',
    'work experience': 'experience',
    'employment': 'experience',
    'career': 'experience',
    'professional experience': 'experience',
    
    'summary': 'profile',
    'professional summary': 'profile',
    'personal statement': 'profile',
    'objective': 'profile',
    
    // Add more mappings as needed
  };
  
  const lowerKey = key.toLowerCase();
  return mappings[lowerKey] || key;
}

// Function to apply length control to all sections
function applyLengthControlToSections(sections: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(sections)) {
    result[key] = controlContentLength(value, key);
  }
  
  return result;
}

// Function to ensure proper section structure in the final output
export function ensureProperSectionStructure(optimizedText: string, originalSections: Record<string, string>): string {
  // Analyze the optimized text for section structure
  const sectionPattern = /##\s+(.*?)(?=\n##|$)/gs;
  const matches = [...optimizedText.matchAll(sectionPattern)];
  
  // Check if any crucial sections are missing or duplicated
  const sectionsTitles = matches.map(match => match[1].trim().toLowerCase());
  const sectionCounts: Record<string, number> = {};
  
  // Count occurrences of each section
  for (const title of sectionsTitles) {
    sectionCounts[title] = (sectionCounts[title] || 0) + 1;
  }
  
  // If we have duplicates, fix the structure
  const hasDuplicates = Object.values(sectionCounts).some(count => count > 1);
  
  if (hasDuplicates) {
    // Reconstruct the CV with deduplicated sections
    let fixedText = '';
    const processedSections = new Set<string>();
    
    for (let i = 0; i < matches.length; i++) {
      const [fullMatch, sectionTitle] = matches[i];
      const normalizedTitle = sectionTitle.trim().toLowerCase();
      
      // Skip if we've already processed this section type
      if (processedSections.has(normalizedTitle)) continue;
      
      processedSections.add(normalizedTitle);
      
      // Get all content for this section and merge it
      const sectionContent = fullMatch.substring(sectionTitle.length + 2).trim();
      
      fixedText += `## ${sectionTitle}\n${sectionContent}\n\n`;
    }
    
    return fixedText.trim();
  }
  
  // If no duplicates found, return original optimized text
  return optimizedText;
}

// Enhanced section extraction
function enhancedExtractSections(text: string): Record<string, string> {
  // Initialize with more section types to better capture CV content
  const sections: Record<string, string> = {
    contact: '',
    profile: '',
    experience: '',
    education: '',
    skills: '',
    projects: '',
    certifications: '',
    languages: '',
    achievements: '',
    interests: '',
    publications: '',
    references: '',
    volunteer: '',
    awards: ''
  };
  
  // More robust section extraction algorithm
  // First, identify clear section headers
  const lines = text.split('\n');
  
  // Common section header patterns
  const sectionHeaderPatterns = [
    /^[\s\t]*(?:CONTACT|PROFILE|SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|LANGUAGES|ACHIEVEMENTS|INTERESTS|PUBLICATIONS|REFERENCES|VOLUNTEER|AWARDS)[\s\t]*(?::|$)/i,
    /^[\s\t]*(?:WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|PROFESSIONAL\s+SUMMARY|WORK\s+HISTORY|EMPLOYMENT\s+HISTORY|TECHNICAL\s+SKILLS|KEY\s+SKILLS|CORE\s+COMPETENCIES|PROFESSIONAL\s+SKILLS|CAREER\s+OBJECTIVE)[\s\t]*(?::|$)/i,
    /^[\s\t]*(?:PERSONAL\s+STATEMENT|CAREER\s+SUMMARY|QUALIFICATION\s+SUMMARY|ACADEMIC\s+BACKGROUND|EDUCATIONAL\s+BACKGROUND|PROFESSIONAL\s+BACKGROUND|RELEVANT\s+EXPERIENCE)[\s\t]*(?::|$)/i
  ];
  
  // Detect section headers and their positions
  const detectedSections: {index: number, title: string}[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line matches any section header pattern
    for (const pattern of sectionHeaderPatterns) {
      if (pattern.test(line)) {
        // Found a section header
        const title = line.replace(/[:]/g, '').trim();
        detectedSections.push({index: i, title});
        break;
      }
    }
    
    // Also check for markdown style headers (# Header or ## Header)
    if (/^#+\s+.+/.test(line)) {
      const title = line.replace(/^#+\s+/, '').trim();
      detectedSections.push({index: i, title});
    }
  }
  
  // Process sections based on detected headers
  for (let i = 0; i < detectedSections.length; i++) {
    const current = detectedSections[i];
    const next = i + 1 < detectedSections.length ? detectedSections[i + 1] : null;
    
    // Get section content
    const startIndex = current.index + 1;
    const endIndex = next ? next.index : lines.length;
    
    // Extract content
    const sectionContent = lines.slice(startIndex, endIndex).join('\n').trim();
    
    // Map to our section names using the normalized key function
    const normalizedKey = getNormalizedSectionName(current.title);
    
    if (normalizedKey && sections[normalizedKey] !== undefined) {
      sections[normalizedKey] = sectionContent;
    }
  }
  
  // Process special case for contact information which might not have a header
  if (!sections.contact || sections.contact.length === 0) {
    // Look for contact patterns in the first few lines
    const contactLines = lines.slice(0, 10).filter(line => {
      return /(?:@|email|phone|tel|address|linkedin|github)/i.test(line) ||
             /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(line); // Phone pattern
    });
    
    if (contactLines.length > 0) {
      sections.contact = contactLines.join('\n');
    }
  }
  
  // Process the text to find a name if it's at the top
  if (lines.length > 0 && !detectedSections.some(s => s.index === 0)) {
    const possibleName = lines[0].trim();
    if (possibleName && possibleName.length < 50 && !/[<>{}()\[\]\/\\]/.test(possibleName)) {
      // This could be a name, add it to contact
      sections.contact = `${possibleName}\n${sections.contact}`;
    }
  }
  
  return sections;
}

// Function to map section titles to normalized keys
function getNormalizedSectionName(title: string): string | null {
  const titleLower = title.toLowerCase();
  
  const mappings: Record<string, string> = {
    // Contact mappings
    'contact': 'contact',
    'contact information': 'contact',
    'personal information': 'contact',
    'personal details': 'contact',
    
    // Profile mappings
    'profile': 'profile',
    'summary': 'profile',
    'professional summary': 'profile',
    'career summary': 'profile',
    'personal statement': 'profile',
    'career objective': 'profile',
    'objective': 'profile',
    
    // Experience mappings
    'experience': 'experience',
    'work experience': 'experience',
    'professional experience': 'experience',
    'employment history': 'experience',
    'work history': 'experience',
    'career history': 'experience',
    
    // Education mappings
    'education': 'education',
    'academic background': 'education',
    'educational background': 'education',
    'qualifications': 'education',
    'academic qualifications': 'education',
    
    // Skills mappings
    'skills': 'skills',
    'technical skills': 'skills',
    'core competencies': 'skills',
    'key skills': 'skills',
    'professional skills': 'skills',
    'competencies': 'skills',
    
    // Continue with other mappings...
  };
  
  // Check for direct matches
  if (mappings[titleLower]) {
    return mappings[titleLower];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(mappings)) {
    if (titleLower.includes(key)) {
      return value;
    }
  }
  
  return null;
}

// Add this function to extractSections to identify top achievements
function extractTopAchievements(text: string): string[] {
  // Look for achievement patterns in the text
  const achievementPatterns = [
    /\b(increased|improved|reduced|saved|launched|achieved|won|awarded|led|grew|generated|developed|delivered|implemented|created)\b.{10,120}(by\s+\d+%|\$\d+|\d+\s+million|\d+\s+customers|\d+\s+users)/gi,
    /\b(recognition|award|honor|prize|certification).{5,100}/gi,
    /\b(managed|directed|supervised|oversaw|coordinated).{10,120}(team of \d+|across \d+|budget of \$\d+)/gi
  ];
  
  let achievements: string[] = [];
  
  // Extract achievements that match our patterns
  for (const pattern of achievementPatterns) {
    const matches = text.match(pattern) || [];
    achievements = [...achievements, ...matches];
  }
  
  // If we don't have enough achievement matches, look for sentences with metrics
  if (achievements.length < 5) {
    const metricsPattern = /\b[^.!?]*?(increased|improved|reduced|saved|delivered|generated|achieved)[^.!?]*?(by \d+%|\$\d+|\d+ million|\d+%|\d+ users)[^.!?]*?[.!?]/gi;
    const metricsMatches = text.match(metricsPattern) || [];
    achievements = [...achievements, ...metricsMatches];
  }
  
  // Clean up the extracted achievements
  const cleanedAchievements = achievements
    .map(a => a.trim())
    .filter(a => a.length > 20 && a.length < 150) // Reasonable length
    .map(a => a.replace(/^[^a-zA-Z]+/, '')) // Remove leading non-alphabet chars
    .map(a => {
      // Ensure it starts with an action verb in past tense
      const firstWord = a.split(' ')[0].toLowerCase();
      if (!firstWord.endsWith('ed') && !firstWord.match(/^(led|grew|built|won|ran)$/)) {
        const firstCap = a.charAt(0).toUpperCase() + a.slice(1);
        return `Achieved ${firstCap}`;
      }
      return a.charAt(0).toUpperCase() + a.slice(1);
    });
  
  // Rank achievements by impact (presence of metrics, results)
  const rankedAchievements = cleanedAchievements.sort((a, b) => {
    const aScore = scoreAchievement(a);
    const bScore = scoreAchievement(b);
    return bScore - aScore;
  });
  
  // Return top 3 achievements, or generate placeholders if needed
  if (rankedAchievements.length >= 3) {
    return rankedAchievements.slice(0, 3);
  }
  
  // Add placeholder achievements if we couldn't find enough real ones
  const placeholders = [
    "Increased departmental efficiency by 25% through implementation of new workflow processes",
    "Led cross-functional team of 8 professionals to deliver project 15% under budget",
    "Recognized as top performer with excellence award for outstanding customer satisfaction ratings"
  ];
  
  return [...rankedAchievements, ...placeholders].slice(0, 3);
}

// Helper to score achievements by impact
function scoreAchievement(achievement: string): number {
  let score = 0;
  
  // Higher score for quantified results
  if (achievement.match(/\d+%|\$\d+|\d+ million|\d+ users/)) {
    score += 5;
  }
  
  // Higher score for impactful verbs
  if (achievement.match(/\b(led|launched|won|achieved|delivered)\b/i)) {
    score += 3;
  }
  
  // Higher score for leadership indicators
  if (achievement.match(/\b(team|organization|company|department)\b/i)) {
    score += 2;
  }
  
  // Higher score for recognition
  if (achievement.match(/\b(award|recognition|honor|selected)\b/i)) {
    score += 4;
  }
  
  // Higher score for business impact
  if (achievement.match(/\b(revenue|profit|cost|sales|growth)\b/i)) {
    score += 3;
  }
  
  return score;
}
  
// Export helper functions so they can be used in optimizeCVBackground.ts
export {
  extractTopAchievements,
  formatCompetences,
  formatExperience,
  formatEducation,
  formatLanguages
};
  