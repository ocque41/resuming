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
    
    // Get template layout if available
    let layout = 'two-column';
    let headerStyle = 'modern';
    
    if (template) {
      console.log(`Using template: ${template.name}`);
      
      // Get layout from template metadata
      layout = template.metadata.layout || layout;
      
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
        Format the CV with education, skills, languages, and certifications in the left column.
        Put work experience, projects, and summary in the right column.
        Use bullet points for achievements and responsibilities.
        Keep all text black.
        Ensure the CV fits on a single page.
      `;
    } else if (layout === 'traditional') {
      formattingInstructions = `
        Format the CV in a traditional style with clear section headers.
        Use bullet points for achievements and responsibilities.
        Keep all text black.
        Ensure the CV fits on a single page.
      `;
    }
    
    // Customize industry guidance based on template
    let industryGuidance = "";
    
    if (template) {
      if (template.name === 'Google Modern' || template.id === 'google-modern') {
        industryGuidance = `
          Focus on quantifiable achievements and impact.
          Highlight technical skills and innovative projects.
          Use action verbs and data-driven results.
          Emphasize collaboration and teamwork.
          Include specific technologies and tools you've worked with.
        `;
      } else if (template.name === 'Apple Minimal' || template.id === 'apple-minimal') {
        industryGuidance = `
          Focus on design thinking and user-centric approaches.
          Highlight creative problem-solving and attention to detail.
          Keep descriptions concise and impactful.
          Emphasize aesthetic sensibility and innovation.
          Use clean, minimal formatting with plenty of white space.
        `;
      } else if (template.name === 'Amazon Leadership' || template.id === 'amazon-leadership') {
        industryGuidance = `
          Structure achievements using the STAR method (Situation, Task, Action, Result).
          Demonstrate leadership principles like customer obsession and ownership.
          Quantify results and business impact.
          Show examples of raising the bar and thinking big.
          Include metrics and data points that demonstrate success.
        `;
      } else if (template.name === 'Microsoft Professional' || template.id === 'microsoft-professional') {
        industryGuidance = `
          Highlight collaborative projects and team achievements.
          Focus on technical expertise and problem-solving abilities.
          Demonstrate continuous learning and adaptability.
          Emphasize cross-functional collaboration and communication skills.
          Show how you've contributed to product development or improvement.
        `;
      } else if (template.name === 'Meta Impact' || template.id === 'meta-impact') {
        industryGuidance = `
          Emphasize social impact and community-focused initiatives.
          Highlight experience with social media platforms and digital communication.
          Demonstrate creativity and innovation in connecting people.
          Show how you've built or improved online communities.
          Include metrics related to engagement, growth, or user experience.
        `;
      }
      
      // Add industry-specific guidance if available in template metadata
      if (template.metadata.industrySpecific) {
        const industry = template.metadata.industrySpecific;
        
        industryGuidance += `
          Industry: ${industry.industry}
          Required Skills: ${industry.requiredSkills.join(', ')}
          Value Propositions: ${industry.valuePropositions.join(', ')}
          Resume Style: ${industry.resumeStyle}
          Achievement Format: ${industry.achievementFormat}
        `;
      }
    }
    
    // Create the prompt for OpenAI
    const prompt = `
      You are a professional CV/resume optimization expert. Your task is to transform the provided CV into a more impactful, well-organized, and ATS-friendly document.

      IMPORTANT GUIDELINES:
      - Keep all text BLACK - do not use any colored text.
      - Ensure the CV fits on a single page.
      - Do NOT include placeholder text like "[LEFT COLUMN END]" or "[RIGHT COLUMN START]" in the final output.
      - Do NOT include "CONTENT" as a section title.
      - Do NOT include placeholder text like "*No previous work experience provided on the original CV*".
      - Maintain professional language throughout.
      - Eliminate first-person pronouns (I, me, my).
      - Use bullet points for ALL achievements, responsibilities, and skills.
      - ALWAYS use a hyphen followed by a space "- " for bullet points, NOT asterisks or other symbols.
      - Ensure there is proper spacing between bullet points - each bullet point should be on its own line.
      - NEVER combine multiple bullet points on the same line.
      - Quantify achievements where possible (%, $, numbers).
      - Focus on impact and results, not just responsibilities.
      - Ensure all dates are in a consistent format.
      - Use action verbs to start bullet points.
      - Tailor content to highlight relevant skills and experiences.
      - Optimize for ATS by including relevant keywords.
      - Keep formatting clean and consistent.
      - Ensure proper spelling and grammar.
      - Use ** around text that should be emphasized or bold (e.g., **Important Skill**).
      - Make section titles clear and prominent.
      - For skills sections, use bullet points for each skill or group of related skills.
      - Ensure each bullet point is concise and focused on a single achievement or skill.

${formattingInstructions}

      ${industryGuidance}
      
      Here is the CV to optimize:
      ${cvText}
      
      Return ONLY the optimized CV text without any explanations or additional comments.
    `;
    
    // Call OpenAI API
    console.log("Calling OpenAI API for CV optimization");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a professional CV/resume optimization expert."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      
      // Create a fallback optimized version
      const fallbackText = createFormattedFallbackFromRawText(cvText);
      return { 
        optimizedText: fallbackText, 
        error: `OpenAI API error: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const data = await response.json();
    let optimizedText = data.choices[0].message.content.trim();
    
    // Process any formatting markers
    optimizedText = processFormattingMarkers(optimizedText);
    
    // Verify that the optimized content preserves important information
    const contentVerification = verifyContentPreservation(cvText, optimizedText);
    
    if (!contentVerification.preserved) {
      console.warn("Content verification failed. Missing items:", contentVerification.missingItems);
      
      // If critical information is missing, use a fallback approach
      if (contentVerification.missingItems.includes('Name') || 
          contentVerification.missingItems.includes('Contact Information')) {
        console.warn("Critical information missing, using fallback optimization");
        const fallbackText = createFormattedFallbackFromRawText(cvText);
        return { 
          optimizedText: fallbackText, 
          error: `Content verification failed: Missing ${contentVerification.missingItems.join(', ')}` 
        };
      }
    }
    
    return { optimizedText };
  } catch (error: any) {
    console.error("Error in CV optimization:", error.message);
    
    // Create a fallback optimized version
    const fallbackText = createFormattedFallbackFromRawText(cvText);
    return { 
      optimizedText: fallbackText, 
      error: `CV optimization error: ${error.message}` 
    };
  }
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
  