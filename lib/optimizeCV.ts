// lib/optimizeCV.ts
import { CVTemplate } from "@/types/templates";
import { modifyPDFWithOptimizedContent } from "./pdfOptimization";

export async function optimizeCV(
  rawText: string,
  analysis: any,
  template?: CVTemplate
): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
  try {
    console.log("Starting CV optimization process");
    
    // Input validation
    if (!rawText || rawText.trim().length === 0) {
      console.error("Empty raw text provided to optimizeCV");
      throw new Error("No CV text content provided for optimization");
    }
    
    // Log the start of the process
    console.log(`Optimizing CV with ${rawText.length} characters`);
    
    // Identify potential sections from the raw text
    const potentialSections = extractPotentialSections(rawText);
    console.log(`Identified ${potentialSections.length} potential sections in the CV`);
    
    // Customize the prompt based on the provided CV template
    let formattingInstructions = '';
    let industryInstructions = '';
    
    if (template) {
      console.log(`Using template: ${template.name} (${template.company})`);
      
      // Adjust formatting instructions based on template layout
      if (template.metadata.layout === 'one-column') {
        formattingInstructions = `
FORMAT THE CV IN A SINGLE COLUMN LAYOUT with the following sections:
- Contact Information at the top
- Professional Summary/Profile
- Work Experience (with detailed bullet points for each role)
- Skills (organized by category)
- Education
- Additional sections as appropriate (Projects, Certifications, etc.)`;
      } else if (template.metadata.layout === 'traditional') {
        formattingInstructions = `
FORMAT THE CV IN A TRADITIONAL LAYOUT with clear section headers:
- Contact Information centered at the top
- Professional Summary/Profile
- Work Experience (with company, title, dates, and detailed bullet points)
- Skills (organized in a clean, scannable format)
- Education
- Additional sections as needed (Certifications, Languages, etc.)`;
      } else {
        // Default to modern two-column layout
        formattingInstructions = `
FORMAT THE CV WITH LEFT AND RIGHT COLUMNS using the following markers:
[LEFT COLUMN START]
- Profile/Summary
- Skills
- Education
- Languages
- Certifications
- References (if provided)
[LEFT COLUMN END]

[RIGHT COLUMN START]
- Work Experience (with detailed bullet points)
- Projects
- Achievements
- Additional relevant sections
[RIGHT COLUMN END]`;
      }
      
      // Add template-specific keywords to emphasize
      if (template.metadata.keywordsEmphasis && template.metadata.keywordsEmphasis.length > 0) {
        formattingInstructions += `\n\nEmphasize these keywords throughout the CV: ${template.metadata.keywordsEmphasis.join(', ')}`;
      }
      
      // Industry-specific instructions
      if (template.metadata.industrySpecific) {
        const industryInfo = template.metadata.industrySpecific;
        
        industryInstructions = `
INDUSTRY-SPECIFIC GUIDANCE FOR ${industryInfo.industry.toUpperCase()}:

REQUIRED SKILLS TO HIGHLIGHT:
${industryInfo.requiredSkills.map(skill => `- ${skill}`).join('\n')}

VALUE PROPOSITIONS TO EMPHASIZE:
${industryInfo.valuePropositions.map(prop => `- ${prop}`).join('\n')}

RECRUITER PREFERENCES:
${industryInfo.recruiterPreferences.map(pref => `- ${pref}`).join('\n')}

RESUME STYLE GUIDANCE:
${industryInfo.resumeStyle}

ACHIEVEMENT FORMAT EXAMPLES:
${industryInfo.achievementFormat}

You MUST follow this exact format for achievements and include specific, measurable results relevant to this industry.`;
      }
    }
    
    // Build a comprehensive prompt for the OpenAI API
    const prompt = `You are a professional CV writer and career coach with 15+ years of experience helping job seekers create impactful, ATS-optimized CVs that stand out to recruiters. Your task is to completely rewrite and restructure the provided CV to maximize its impact and effectiveness.

IMPORTANT INSTRUCTIONS:
1. PRESERVE ALL RELEVANT CONTENT from the original CV - including work history, education, skills, and achievements.
2. EXPAND AND ENHANCE the content by:
   - Adding powerful action verbs and industry-specific keywords
   - Quantifying achievements with specific metrics and results (e.g., "increased sales by 25%")
   - Highlighting relevant skills and experiences that align with industry standards
   - Removing generic or vague statements and replacing them with specific, impactful content
3. IMPROVE STRUCTURE AND FORMATTING:
   - Create clear, well-organized sections with descriptive headings
   - Use bullet points for achievements and responsibilities
   - Ensure consistent formatting throughout
   - Optimize for both human readers and ATS systems
4. ADD MISSING SECTIONS if appropriate (e.g., Professional Summary, Technical Skills, etc.)
5. MAINTAIN PROFESSIONAL LANGUAGE and eliminate first-person pronouns

${formattingInstructions}

${industryInstructions}

FORMATTING MARKERS:
- Use "**Section Title**" format for section headers (with asterisks)
- Use bullet points (•) for listing items
- For subsections or job titles, use bold formatting
- Maintain clear hierarchy and organization

HERE IS THE ORIGINAL CV TEXT TO OPTIMIZE:
${rawText}

IMPORTANT: Your response must be ONLY the optimized CV text with appropriate formatting markers. Do not include explanations, introductions, or any text outside the CV content itself.`;

    console.log("Sending request to OpenAI API");
    
    // Call the OpenAI API using fetch
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert CV writer who specializes in creating impactful, ATS-optimized CVs that highlight a candidate's strengths and achievements."
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
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    // Check if we got a valid response
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      console.error("Invalid response from OpenAI API:", data);
      throw new Error("Failed to get a valid response from the AI service");
    }
    
    // Extract the optimized text from the response
    let optimizedText = data.choices[0].message.content || "";
    
    // Log the response for debugging
    console.log(`Received optimized text (${optimizedText.length} characters)`);
    console.log(`First 200 characters: ${optimizedText.substring(0, 200)}...`);
    
    // Validate the optimized text
    if (!optimizedText || optimizedText.trim().length === 0) {
      console.error("Empty optimized text received from OpenAI API");
      throw new Error("No content was generated during optimization");
    }
    
    // Check if the optimized text has the required formatting markers
    const hasFormattingMarkers = 
      optimizedText.includes("**") || // Section headers
      optimizedText.includes("•") || // Bullet points
      optimizedText.includes("[LEFT COLUMN") || // Column markers
      optimizedText.includes("[RIGHT COLUMN");
    
    if (!hasFormattingMarkers) {
      console.warn("Optimized text lacks formatting markers, applying basic formatting");
      optimizedText = processFormattingMarkers(rawText);
    }
    
    // Verify that key content has been preserved
    const contentVerification = verifyContentPreservation(rawText, optimizedText);
    
    if (!contentVerification.preserved) {
      console.warn(`Content preservation check failed. Missing items: ${contentVerification.missingItems.join(', ')}`);
      
      // If too many items are missing, use a fallback approach
      if (contentVerification.missingItems.length > 3) {
        console.log("Too many items missing, using fallback formatting");
        optimizedText = createFormattedFallbackFromRawText(rawText);
      }
    }
    
    // Process any formatting markers in the optimized text
    optimizedText = processFormattingMarkers(optimizedText);
    
    // Generate a PDF with the optimized content
    console.log("Generating PDF with optimized content");
    let pdfBuffer;
    try {
      pdfBuffer = await modifyPDFWithOptimizedContent(optimizedText, rawText, template);
    } catch (error: any) {
      console.error("Error generating PDF:", error.message);
      
      // Try with fallback text if PDF generation fails
      console.log("Attempting to generate PDF with fallback text");
      const fallbackText = createFormattedFallbackFromRawText(rawText);
      pdfBuffer = await modifyPDFWithOptimizedContent(fallbackText, rawText, template);
    }
    
    // For now, we're not storing the PDF anywhere, so just return a placeholder URL
    // In a real implementation, you would upload the PDF to a storage service and return the URL
    const optimizedPDFUrl = "placeholder-url.pdf";
    
    return {
      optimizedText,
      optimizedPDFUrl
    };
  } catch (error: any) {
    console.error("Error in optimizeCV:", error.message);
    throw new Error(`CV optimization failed: ${error.message}`);
  }
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

// Helper function to process formatting markers in the optimized text
function processFormattingMarkers(text: string): string {
  if (!text || text.trim().length === 0) {
    console.error("Empty text provided to processFormattingMarkers");
    return text;
  }
  
  let processedText = text;
  
  // Check for column markers
  const hasLeftColumn = text.includes('[LEFT COLUMN START]');
  const hasRightColumn = text.includes('[RIGHT COLUMN START]');
  
  if (hasLeftColumn && hasRightColumn) {
    // Extract column content
    const leftColumnMatch = text.match(/\[LEFT COLUMN START\]([\s\S]*?)\[LEFT COLUMN END\]/);
    const rightColumnMatch = text.match(/\[RIGHT COLUMN START\]([\s\S]*?)\[RIGHT COLUMN END\]/);
    
    if (leftColumnMatch && rightColumnMatch) {
      const leftColumnContent = leftColumnMatch[1].trim();
      const rightColumnContent = rightColumnMatch[1].trim();
      
      // Format the content with column markers
      processedText = `[LEFT COLUMN START]\n${leftColumnContent}\n[LEFT COLUMN END]\n\n[RIGHT COLUMN START]\n${rightColumnContent}\n[RIGHT COLUMN END]`;
    }
  } else {
    // If no column markers, try to identify sections and distribute them
    const sections = [];
    const lines = text.split('\n');
    let currentSection = '';
    let inSection = false;
    
    for (const line of lines) {
      // Check if this line is a section header
      if (line.match(/^\s*\*\*.*\*\*\s*$/) || line.match(/^[A-Z\s]+:$/)) {
        // If we were in a section, save it
        if (inSection) {
          sections.push(currentSection);
          currentSection = '';
        }
        
        // Start a new section
        currentSection = line + '\n';
        inSection = true;
      } else if (inSection) {
        // Add to current section
        currentSection += line + '\n';
      } else {
        // Not in a section yet, might be contact info
        currentSection += line + '\n';
      }
    }
    
    // Add the last section if there is one
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // If we identified sections, distribute them into columns
    if (sections.length > 1) {
      // Determine which sections go in which column
      const leftColumnSections = [];
      const rightColumnSections = [];
      
      // Common sections for left column
      const leftColumnKeywords = ['profile', 'summary', 'skills', 'education', 'languages', 'certifications', 'references'];
      
      // Common sections for right column
      const rightColumnKeywords = ['experience', 'employment', 'projects', 'achievements'];
      
      for (const section of sections) {
        const sectionLower = section.toLowerCase();
        
        if (leftColumnKeywords.some(keyword => sectionLower.includes(keyword))) {
          leftColumnSections.push(section);
        } else if (rightColumnKeywords.some(keyword => sectionLower.includes(keyword))) {
          rightColumnSections.push(section);
        } else {
          // If we can't determine, put shorter sections in left column
          if (section.length < 500) {
            leftColumnSections.push(section);
      } else {
            rightColumnSections.push(section);
          }
        }
      }
      
      // Format the content with column markers
      processedText = `[LEFT COLUMN START]\n${leftColumnSections.join('\n')}\n[LEFT COLUMN END]\n\n[RIGHT COLUMN START]\n${rightColumnSections.join('\n')}\n[RIGHT COLUMN END]`;
    }
  }
  
  return processedText;
}
  