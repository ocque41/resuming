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
      
      // Validate input
      if (!rawText || rawText.trim().length === 0) {
        console.error("ERROR: Empty raw text provided to optimizeCV");
        throw new Error("No CV content was provided for optimization");
      }
      
      // Get potential sections
      const potentialSections = extractPotentialSections(rawText);
      console.log(`Identified potential sections: ${potentialSections.join(', ')}`);
      
      // Customize prompt based on template if available
      let formattingInstructions = `
Your task is to completely rewrite and restructure this CV to match a modern two-column layout with the following sections:

LEFT COLUMN (narrow):
- Contact Information (short, concise)
- Education (formatted with years and institutions prominently displayed)
- Languages (with proficiency levels)
- Technical Skills (separated by category)

RIGHT COLUMN (main content):
- Professional Profile (3-4 compelling sentences highlighting unique value proposition)
- Professional Experience (achievement-oriented bullet points, with metrics and results)
- Additional Skills & Certifications (if applicable)`;

      // If template is provided, customize the formatting instructions
      if (template) {
        console.log(`Using template: ${template.name} (${template.company})`);
        
        // Adjust formatting based on template layout
        if (template.metadata.layout === 'one-column') {
          formattingInstructions = `
Your task is to completely rewrite and restructure this CV to match a clean one-column layout with the following sections in order:
- Professional Profile (3-4 compelling sentences highlighting unique value proposition)
- Professional Experience (achievement-oriented bullet points, with metrics and results)
- Education (formatted with years and institutions prominently displayed)
- Skills (separated by category)
- Languages (with proficiency levels)
- Additional Certifications (if applicable)`;
        } else if (template.metadata.layout === 'traditional') {
          formattingInstructions = `
Your task is to completely rewrite and restructure this CV to match a traditional layout with the following sections in order:
- Contact Information (centered at top)
- Professional Summary (3-4 compelling sentences highlighting unique value proposition)
- Professional Experience (achievement-oriented bullet points, with metrics and results)
- Education (formatted with years and institutions prominently displayed)
- Skills (separated by category)
- References (if provided)`;
        }
        
        // Add template-specific keywords to emphasize
        if (template.metadata.keywordsEmphasis && template.metadata.keywordsEmphasis.length > 0) {
          formattingInstructions += `\n\nEmphasize these keywords throughout the CV: ${template.metadata.keywordsEmphasis.join(', ')}`;
        }
      }

      // Industry-specific instructions
      let industryInstructions = '';
      
      // If template is provided, use its industry-specific guidance
      if (template?.metadata?.industrySpecific) {
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
      
      // Build a prompt for GPT-4 that instructs it to generate both optimized text and PDF editing instructions.
      const prompt = `You are a professional CV writer who specializes in transforming basic CVs into polished, high-impact documents. The user has uploaded a CV that needs a complete redesign in both content and format, with the goal of creating a modern, professional document that will significantly increase their chances of getting interviews.

${formattingInstructions}

${industryInstructions}

I need you to:

1. REWRITE ALL CONTENT to be impact-focused and achievement-oriented.
2. Create a COMPELLING PROFESSIONAL PROFILE summary (3-4 lines) that showcases the candidate's unique value and expertise.
3. Transform ALL experience bullet points into ACHIEVEMENT STATEMENTS with metrics (add plausible metrics if none exist).
4. Format EDUCATION with clear hierarchy (institution name, degree, year).
5. Categorize SKILLS into logical groups (e.g., Technical, Software, Languages, Soft Skills).
6. Ensure all content is keyword-optimized for ATS systems.

The optimizedText MUST include proper formatting markers like:
- [HEADER] for main section headers
- [SUBHEADER] for subsections
- [BULLET] for bullet points
- [LEFT-COLUMN-START] and [LEFT-COLUMN-END] for sidebar content
- [RIGHT-COLUMN-START] and [RIGHT-COLUMN-END] for main content

EXTREMELY IMPORTANT: The original CV has valuable content that MUST be preserved and enhanced in the optimized version. You MUST include ALL relevant sections including profile, work experience, skills, education, and other important information. DO NOT omit any experiences, qualifications or skills.

CRITICAL: The optimized CV must be SUBSTANTIALLY DIFFERENT from the original in terms of wording and impact BUT MUST CONTAIN ALL the same information in an enhanced format. Your output MUST include ALL the sections from the original CV, but written in a more impactful way.

CRITICAL REQUIREMENT: If you cannot properly optimize the content, you MUST return the original content with proper formatting markers added. NEVER return an empty or minimal response.

Here is the CV to optimize:

${rawText}`;

      console.log("Sending optimization request to OpenAI");
      
      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      // Validate the response
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        console.error("Invalid response from OpenAI:", data);
        throw new Error("Failed to get a valid response from the AI service");
      }

      // Extract the optimized text from the response
      let optimizedText = data.choices[0].message.content;
      
      // Validate the optimized text
      if (!optimizedText || optimizedText.trim().length === 0) {
        console.error("Empty optimized text received from OpenAI");
        // Use a fallback approach - format the original text
        optimizedText = createFormattedFallbackFromRawText(rawText);
        console.log("Using formatted fallback from raw text");
      } else {
        console.log(`Received optimized text (${optimizedText.length} characters)`);
        
        // Check if the optimized text has the required formatting markers
        if (!optimizedText.includes('[HEADER]') || 
            (!optimizedText.includes('[LEFT-COLUMN-START]') && !optimizedText.includes('[RIGHT-COLUMN-START]'))) {
          console.warn("Optimized text is missing required formatting markers, processing...");
          optimizedText = processFormattingMarkers(optimizedText);
        }
        
        // Verify that the optimized text contains key information from the original
        const contentPreservationCheck = verifyContentPreservation(rawText, optimizedText);
        if (!contentPreservationCheck.preserved) {
          console.warn(`Content preservation check failed: ${contentPreservationCheck.missingItems.join(', ')}`);
          
          // If critical content is missing, use the fallback
          if (contentPreservationCheck.missingItems.length > 3) {
            console.error("Too many missing items, using fallback");
            optimizedText = createFormattedFallbackFromRawText(rawText);
          }
        }
      }

      // Process the optimized text to ensure it has proper formatting markers
      const processedText = processFormattingMarkers(optimizedText);
      
      // Generate PDF with the optimized content
      console.log("Generating PDF with optimized content");
      try {
        const pdfBuffer = await modifyPDFWithOptimizedContent(
          processedText,
          rawText,
          template
        );
        
        // Convert buffer to base64 for URL
        const base64Pdf = pdfBuffer.toString('base64');
        const optimizedPDFUrl = `data:application/pdf;base64,${base64Pdf}`;
        
        return {
          optimizedText: processedText,
          optimizedPDFUrl: optimizedPDFUrl,
        };
      } catch (error: any) {
        console.error("PDF generation error:", error);
        throw new Error(`PDF generation failed: ${error.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("Error in optimizeCV:", error);
      
      // Create a fallback response with the original text
      const fallbackText = createFormattedFallbackFromRawText(rawText);
      
      // Try to generate a PDF with the fallback text
      try {
        console.log("Attempting to generate PDF with fallback content");
        const fallbackPdfBuffer = await modifyPDFWithOptimizedContent(
          fallbackText,
          rawText,
          template
        );
        
        // Convert buffer to base64 for URL
        const base64Pdf = fallbackPdfBuffer.toString('base64');
        const optimizedPDFUrl = `data:application/pdf;base64,${base64Pdf}`;
        
        return {
          optimizedText: fallbackText,
          optimizedPDFUrl: optimizedPDFUrl,
        };
      } catch (fallbackError) {
        console.error("Fallback PDF generation failed:", fallbackError);
        throw new Error(`CV optimization failed: ${error.message}`);
      }
    }
  }
  
  // New helper function to create a formatted fallback from raw text
  function createFormattedFallbackFromRawText(rawText: string): string {
    if (!rawText || rawText.trim().length === 0) {
      return "[HEADER] Error\n\nNo content was provided for optimization.";
    }
    
    console.log("Creating formatted fallback from raw text");
    
    // Extract potential sections from the raw text
    const sections = extractPotentialSections(rawText);
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    
    // Start building the formatted text
    let formattedText = "";
    
    // Add left column start
    formattedText += "[LEFT-COLUMN-START]\n";
    
    // Add contact information if it appears to be in the first few lines
    formattedText += "[HEADER] Contact\n\n";
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].includes('@') || lines[i].match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/)) {
        formattedText += lines[i] + "\n";
      }
    }
    
    // Add education section if found
    if (sections.includes('Education') || sections.includes('Academic Background')) {
      formattedText += "\n[HEADER] Education\n\n";
      // Extract education-related content (simplified approach)
      const educationRegex = /education|degree|university|college|school|academic/i;
      let inEducationSection = false;
      let educationContent = "";
      
      for (const line of lines) {
        if (line.match(/education|academic/i) && line.length < 30) {
          inEducationSection = true;
          continue;
        } else if (inEducationSection && sections.some(section => line.includes(section) && line.length < 30)) {
          inEducationSection = false;
        }
        
        if (inEducationSection || line.match(educationRegex)) {
          educationContent += line + "\n";
        }
      }
      
      if (educationContent.trim().length > 0) {
        formattedText += educationContent;
      } else {
        formattedText += "Education information not found in the original CV.\n";
      }
    }
    
    // Add skills section if found
    if (sections.includes('Skills') || sections.includes('Technical Skills')) {
      formattedText += "\n[HEADER] Skills\n\n";
      // Extract skills-related content (simplified approach)
      const skillsRegex = /skills|proficient|expertise|competencies/i;
      let inSkillsSection = false;
      let skillsContent = "";
      
      for (const line of lines) {
        if (line.match(/skills|technical skills|core competencies/i) && line.length < 30) {
          inSkillsSection = true;
          continue;
        } else if (inSkillsSection && sections.some(section => line.includes(section) && line.length < 30)) {
          inSkillsSection = false;
        }
        
        if (inSkillsSection || line.match(skillsRegex)) {
          skillsContent += line + "\n";
        }
      }
      
      if (skillsContent.trim().length > 0) {
        formattedText += skillsContent;
      } else {
        formattedText += "Skills information not found in the original CV.\n";
      }
    }
    
    // Close left column
    formattedText += "[LEFT-COLUMN-END]\n\n";
    
    // Add right column start
    formattedText += "[RIGHT-COLUMN-START]\n";
    
    // Add profile/summary if found
    if (sections.includes('Profile') || sections.includes('Summary') || sections.includes('Professional Summary')) {
      formattedText += "[HEADER] Profile\n\n";
      // Extract profile-related content (simplified approach)
      const profileRegex = /profile|summary|about me|objective/i;
      let inProfileSection = false;
      let profileContent = "";
      
      for (const line of lines) {
        if (line.match(/profile|summary|about me|objective/i) && line.length < 30) {
          inProfileSection = true;
          continue;
        } else if (inProfileSection && sections.some(section => line.includes(section) && line.length < 30)) {
          inProfileSection = false;
        }
        
        if (inProfileSection || line.match(profileRegex)) {
          profileContent += line + "\n";
        }
      }
      
      if (profileContent.trim().length > 0) {
        formattedText += profileContent;
      } else {
        formattedText += "Professional with experience in the field seeking new opportunities.\n";
      }
    }
    
    // Add experience section if found
    if (sections.includes('Experience') || sections.includes('Work Experience') || sections.includes('Professional Experience')) {
      formattedText += "\n[HEADER] Experience\n\n";
      // Extract experience-related content (simplified approach)
      const experienceRegex = /experience|work|employment|job|position|role/i;
      let inExperienceSection = false;
      let experienceContent = "";
      
      for (const line of lines) {
        if (line.match(/experience|work experience|professional experience|employment history/i) && line.length < 40) {
          inExperienceSection = true;
          continue;
        } else if (inExperienceSection && sections.some(section => line.includes(section) && line.length < 30)) {
          inExperienceSection = false;
        }
        
        if (inExperienceSection || line.match(experienceRegex)) {
          experienceContent += line + "\n";
        }
      }
      
      if (experienceContent.trim().length > 0) {
        formattedText += experienceContent;
      } else {
        formattedText += "Experience information not found in the original CV.\n";
      }
    }
    
    // Add any remaining sections
    const coveredSections = ['Profile', 'Summary', 'Professional Summary', 'Experience', 'Work Experience', 
                            'Professional Experience', 'Education', 'Academic Background', 'Skills', 'Technical Skills'];
    
    for (const section of sections) {
      if (!coveredSections.includes(section)) {
        formattedText += `\n[HEADER] ${section}\n\n`;
        // Simple extraction of section content
        let inSection = false;
        let sectionContent = "";
        
        for (const line of lines) {
          if (line.includes(section) && line.length < 40) {
            inSection = true;
            continue;
          } else if (inSection && sections.some(s => line.includes(s) && line.length < 30 && s !== section)) {
            inSection = false;
          }
          
          if (inSection) {
            sectionContent += line + "\n";
          }
        }
        
        if (sectionContent.trim().length > 0) {
          formattedText += sectionContent;
        } else {
          formattedText += `${section} information not found in the original CV.\n`;
        }
      }
    }
    
    // If we haven't found any sections, include the entire raw text
    if (sections.length === 0) {
      formattedText += "[HEADER] Content\n\n";
      formattedText += rawText;
    }
    
    // Close right column
    formattedText += "[RIGHT-COLUMN-END]\n";
    
    return formattedText;
  }
  
  // Function to fix common JSON string issues
  function fixJsonString(jsonString: string): string {
    if (!jsonString || typeof jsonString !== 'string') {
      console.warn("fixJsonString: Invalid input - jsonString is not a string");
      return "{}"; // Return empty JSON object as fallback
    }
    
    try {
      // Try parsing as-is first
      JSON.parse(jsonString);
      return jsonString; // If it parses successfully, return it unchanged
    } catch (e) {
      // If parsing fails, attempt to fix common issues
      let fixedString = jsonString;
      
      // Check if the string is wrapped with markdown code blocks and remove them
      fixedString = fixedString.replace(/^```json\s+/, '').replace(/\s+```$/, '');
      fixedString = fixedString.replace(/^```\s+/, '').replace(/\s+```$/, '');
      
      // Check for single quotes instead of double quotes for object keys
      fixedString = fixedString.replace(/'([^']+)'(\s*:)/g, '"$1"$2');
      
      // Fix unescaped quotes in JSON values
      let inString = false;
      let result = '';
      let lastChar = '';
      
      for (let i = 0; i < fixedString.length; i++) {
        const char = fixedString[i];
        
        if (char === '"' && lastChar !== '\\') {
          inString = !inString;
        }
        
        if (inString && char === '\n') {
          result += '\\n'; // Replace newlines in strings with escaped newlines
        } else if (inString && char === '\t') {
          result += '\\t'; // Replace tabs in strings with escaped tabs
        } else {
          result += char;
        }
        
        lastChar = char;
      }
      
      fixedString = result;
      
      // Try parsing again after fixes
      try {
        JSON.parse(fixedString);
        return fixedString;
      } catch (e2) {
        console.error("First JSON parsing attempt failed:", e2);
        
        // If it still fails, try a more aggressive approach: 
        // Extract anything that looks like valid JSON using regex
        const jsonMatch = fixedString.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          try {
            JSON.parse(jsonMatch[0]);
            return jsonMatch[0];
          } catch (e3) {
            // If all attempts fail, return a minimal valid JSON object
            console.error("Failed to fix JSON string after multiple attempts:", e3);
            
            // Create a basic JSON with the content wrapped in optimizedText
            console.log("Creating basic JSON with the content as optimizedText");
            return JSON.stringify({
              optimizedText: fixedString,
              pdfInstructions: ""
            });
          }
        } else {
          // If no object-like structure is found, return a minimal valid JSON
          console.log("No JSON-like structure found, creating basic JSON");
          return JSON.stringify({
            optimizedText: fixedString,
            pdfInstructions: ""
          });
        }
      }
    }
  }
  
  // Process formatting markers in the text
  function processFormattingMarkers(text: string): string {
    console.log("Processing formatting markers");
    
    // Handle empty text
    if (!text || text.trim().length === 0) {
      console.error("ERROR: Empty text provided to processFormattingMarkers");
      return "[HEADER] Error\n\nNo content was provided for processing.";
    }
    
    let processedText = text;
    const lines = text.split('\n');
    
    // Check if we have column markers
    const hasLeftColumnStart = text.includes('[LEFT-COLUMN-START]');
    const hasRightColumnStart = text.includes('[RIGHT-COLUMN-START]');
    const hasLeftColumnEnd = text.includes('[LEFT-COLUMN-END]');
    const hasRightColumnEnd = text.includes('[RIGHT-COLUMN-END]');
    
    // Track sections for better organization
    const sections: Array<{ name: string; index: number; content: string }> = [];
    
    // First pass: identify sections by looking for headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) continue;
      
      // Check for section headers (either ## or [HEADER])
      if (line.startsWith('## ') || line.includes('[HEADER]')) {
        // Extract section name
        const sectionName = line.replace('## ', '').replace('[HEADER]', '').trim();
        sections.push({
          name: sectionName,
          index: i,
          content: ''
        });
      }
    }
    
    console.log(`Found ${sections.length} sections in the text`);
    
    // If no sections were found, try to identify potential sections
    if (sections.length === 0) {
      console.log("No section markers found, attempting to identify sections");
      
      // Common section patterns
      const sectionPatterns = [
        { name: 'Profile', regex: /\b(profile|summary|about|objective)\b/i },
          { name: 'Experience', regex: /\b(experience|work|employment|career)\b/i },
          { name: 'Education', regex: /\b(education|academic|qualifications|degree)\b/i },
          { name: 'Skills', regex: /\b(skills|abilities|competencies|expertise)\b/i },
          { name: 'Languages', regex: /\b(languages|language proficiency)\b/i },
          { name: 'Certifications', regex: /\b(certifications|certificates|qualifications)\b/i }
      ];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (line.length === 0) continue;
        
        // Check if this line looks like a section header (short line, possibly all caps)
        if (line.length < 40 && (line === line.toUpperCase() || line.endsWith(':'))) {
          for (const pattern of sectionPatterns) {
            if (pattern.regex.test(line)) {
              sections.push({
                name: pattern.name,
                index: i,
                content: ''
              });
              break;
            }
          }
        }
      }
    }
    
    // If we still have no sections, create default sections
    if (sections.length === 0) {
      console.log("No sections identified, creating default sections");
      processedText = `[LEFT-COLUMN-START]
[HEADER] Contact

[HEADER] Education

[HEADER] Skills

[LEFT-COLUMN-END]

[RIGHT-COLUMN-START]
[HEADER] Profile

[HEADER] Experience

${text}
[RIGHT-COLUMN-END]`;

      return processedText;
    }
    
    // Determine which sections should go in which column
    const leftColumnSections = ['Contact', 'Education', 'Skills', 'Languages', 'Certifications'];
    const rightColumnSections = ['Profile', 'Summary', 'Experience', 'Work Experience', 'Projects', 'Achievements'];
    
    // Check if we need to add column markers
    if (!hasLeftColumnStart && !hasRightColumnStart) {
      console.log("No column markers found, adding standard layout markers");
      
      // Build new text with proper column markers
      let leftColumnContent = '';
      let rightColumnContent = '';
      
      // Sort sections into columns
      for (const section of sections) {
        // Determine which column this section belongs in
        const sectionName = section.name;
        let isLeftColumn = false;
        
        // Check if this section should be in the left column
        for (const leftSection of leftColumnSections) {
          if (sectionName.toLowerCase().includes(leftSection.toLowerCase())) {
            isLeftColumn = true;
            break;
          }
        }
        
        // Extract section content
        let sectionContent = '';
        const startIndex = section.index;
        let endIndex = lines.length;
        
        // Find the end of this section (next section or end of text)
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].index > startIndex && sections[i].index < endIndex) {
            endIndex = sections[i].index;
          }
        }
        
        // Get the content between start and end
        for (let i = startIndex + 1; i < endIndex; i++) {
          if (i < lines.length) {
            sectionContent += lines[i] + '\n';
          }
        }
        
        // Add to appropriate column
        if (isLeftColumn) {
          leftColumnContent += `[HEADER] ${sectionName}\n\n${sectionContent}\n`;
        } else {
          rightColumnContent += `[HEADER] ${sectionName}\n\n${sectionContent}\n`;
        }
      }
      
      // Combine columns into final text
      processedText = `[LEFT-COLUMN-START]\n${leftColumnContent}[LEFT-COLUMN-END]\n\n[RIGHT-COLUMN-START]\n${rightColumnContent}[RIGHT-COLUMN-END]`;
    } else {
      // We have some column markers, but check if they're complete
      if (hasLeftColumnStart && !hasLeftColumnEnd) {
        console.warn("WARNING: Found [LEFT-COLUMN-START] but missing [LEFT-COLUMN-END], adding end marker");
        
        // Find the right position to add the end marker
        if (hasRightColumnStart) {
          // Add end marker right before right column start
          const rightStartIndex = processedText.indexOf('[RIGHT-COLUMN-START]');
          processedText = processedText.substring(0, rightStartIndex) + 
                         '[LEFT-COLUMN-END]\n\n' + 
                         processedText.substring(rightStartIndex);
        } else {
          // Add end marker at the end
          processedText += '\n[LEFT-COLUMN-END]';
        }
      }
      
      if (hasRightColumnStart && !hasRightColumnEnd) {
        console.warn("WARNING: Found [RIGHT-COLUMN-START] but missing [RIGHT-COLUMN-END], adding end marker");
        processedText += '\n[RIGHT-COLUMN-END]';
      }
      
      // If we have left column end but no start, add start at beginning
      if (hasLeftColumnEnd && !hasLeftColumnStart) {
        console.warn("WARNING: Found [LEFT-COLUMN-END] but missing [LEFT-COLUMN-START], adding start marker");
        processedText = '[LEFT-COLUMN-START]\n' + processedText;
      }
      
      // If we have right column end but no start, add start after left column end
      if (hasRightColumnEnd && !hasRightColumnStart) {
        console.warn("WARNING: Found [RIGHT-COLUMN-END] but missing [RIGHT-COLUMN-START], adding start marker");
        
        if (hasLeftColumnEnd) {
          const leftEndIndex = processedText.indexOf('[LEFT-COLUMN-END]');
          processedText = processedText.substring(0, leftEndIndex + '[LEFT-COLUMN-END]'.length) + 
                         '\n\n[RIGHT-COLUMN-START]\n' + 
                         processedText.substring(leftEndIndex + '[LEFT-COLUMN-END]'.length);
        } else {
          // Add right column start at an appropriate position
          processedText = processedText.replace('[RIGHT-COLUMN-END]', '[RIGHT-COLUMN-START]\n[RIGHT-COLUMN-END]');
        }
      }
    }
    
    // Replace any remaining markdown-style headers with our format
    processedText = processedText.replace(/^##\s+(.+)$/gm, '[HEADER] $1');
    processedText = processedText.replace(/^###\s+(.+)$/gm, '[SUBHEADER] $1');
    
    // Replace bullet points
    processedText = processedText.replace(/^\s*[-*]\s+(.+)$/gm, '[BULLET] $1');
    
    // Final check - ensure we have both column markers
    if (!processedText.includes('[LEFT-COLUMN-START]')) {
      console.warn("WARNING: Final text still missing [LEFT-COLUMN-START], adding at beginning");
      processedText = '[LEFT-COLUMN-START]\n[HEADER] Contact\n\n[LEFT-COLUMN-END]\n\n' + processedText;
    }
    
    if (!processedText.includes('[RIGHT-COLUMN-START]')) {
      console.warn("WARNING: Final text still missing [RIGHT-COLUMN-START], adding after left column");
      
      if (processedText.includes('[LEFT-COLUMN-END]')) {
        const leftEndIndex = processedText.indexOf('[LEFT-COLUMN-END]');
        processedText = processedText.substring(0, leftEndIndex + '[LEFT-COLUMN-END]'.length) + 
                       '\n\n[RIGHT-COLUMN-START]\n' + 
                       processedText.substring(leftEndIndex + '[LEFT-COLUMN-END]'.length);
      } else {
        processedText += '\n\n[RIGHT-COLUMN-START]\n[RIGHT-COLUMN-END]';
      }
    }
    
    return processedText;
  }
  
  // Helper function to extract potential sections from the raw text
  function extractPotentialSections(rawText: string): string[] {
    if (!rawText || typeof rawText !== 'string') {
      console.warn("extractPotentialSections: Invalid input - rawText is not a string");
      return ["Content"];
    }

    // Common CV section headers to look for
    const commonSections = [
      "Profile", "Summary", "Professional Summary", "Career Objective",
      "Experience", "Work Experience", "Professional Experience", "Employment History",
      "Education", "Academic Background", "Qualifications",
      "Skills", "Technical Skills", "Core Competencies", "Key Skills",
      "Projects", "Key Projects", "Professional Projects",
      "Certifications", "Professional Certifications", "Licenses",
      "Languages", "Language Proficiency",
      "Publications", "Research", "Awards", "Achievements", "Honors",
      "Volunteer Experience", "Community Service",
      "Interests", "Hobbies", "Activities",
      "References", "Professional References"
    ];
    
    // Clean the text for more accurate detection
    const cleanedText = rawText.replace(/\s+/g, ' ').trim();
    
    // Find potential sections in the CV
    const foundSections: string[] = [];
    
    // Simple method: look for lines that could be section headers
    const lines = cleanedText.split(/\n+/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // If the line is short, all caps, or followed by a colon, it might be a section header
      if (
        (trimmedLine.length < 30 && trimmedLine.length > 2 && 
         trimmedLine === trimmedLine.toUpperCase()) ||
        trimmedLine.endsWith(':')
      ) {
        // Extract just the text without the colon
        const potentialSection = trimmedLine.replace(/:$/, '').trim();
        
        // Add if it's not already in our list
        if (potentialSection && !foundSections.includes(potentialSection)) {
          foundSections.push(potentialSection);
        }
      }
    }
    
    // Add any common sections that contain keywords from our list
    for (const section of commonSections) {
      if (
        cleanedText.includes(section) && 
        !foundSections.includes(section) &&
        !foundSections.some(s => s.includes(section) || section.includes(s))
      ) {
        foundSections.push(section);
      }
    }
    
    return foundSections.length > 0 ? foundSections : ["Content"];
  }
  
  // New helper function to verify content preservation
  function verifyContentPreservation(originalText: string, optimizedText: string): { 
    preserved: boolean; 
    missingItems: string[] 
  } {
    const missingItems: string[] = [];
    
    // Extract key information from the original text
    const nameMatch = originalText.split('\n')[0];
    if (nameMatch && !optimizedText.includes(nameMatch)) {
      missingItems.push('Name');
    }
    
    // Check for email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const originalEmailMatch = originalText.match(emailRegex);
    if (originalEmailMatch && !optimizedText.includes(originalEmailMatch[0])) {
      missingItems.push('Email');
    }
    
    // Check for phone number
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const originalPhoneMatch = originalText.match(phoneRegex);
    if (originalPhoneMatch && !optimizedText.includes(originalPhoneMatch[0])) {
      missingItems.push('Phone');
    }
    
    // Check for key sections
    const sectionPatterns = [
      { name: 'Profile/Summary', regex: /\b(profile|summary|about|objective)\b/i },
      { name: 'Experience', regex: /\b(experience|work|employment|career)\b/i },
      { name: 'Education', regex: /\b(education|academic|qualifications|degree)\b/i },
      { name: 'Skills', regex: /\b(skills|abilities|competencies|expertise)\b/i }
    ];
    
    for (const pattern of sectionPatterns) {
      if (pattern.regex.test(originalText) && !pattern.regex.test(optimizedText)) {
        missingItems.push(pattern.name);
      }
    }
    
    return {
      preserved: missingItems.length === 0,
      missingItems
    };
  }
  