// lib/optimizeCV.ts
import { CVTemplate } from "@/types/templates";

export async function optimizeCV(
    rawText: string,
    analysis: any,
    template?: CVTemplate
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    try {
      // Get potential sections
      const potentialSections = extractPotentialSections(rawText);
      
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

      // Industry-specific instructions
      let industryInstructions = '';

      // If template is provided, adapt formatting instructions with industry-specific context
      if (template) {
        const industryInfo = template.metadata.industrySpecific;
        
        // Add template-specific formatting instructions
        formattingInstructions = `
Your task is to completely rewrite and restructure this CV following the ${template.name} style (${template.company} preferred format) with the following characteristics:

${template.description}

The layout should incorporate:
- ${template.metadata.preferredFonts.join(', ')} fonts
- Color scheme matching ${template.company}'s brand
- ${template.metadata.layout} layout
- Emphasis on skills: ${template.metadata.keywordsEmphasis.join(', ')}
- Section order: ${template.metadata.sectionOrder.join(' → ')}`;

        // Add detailed industry-specific instructions
        industryInstructions = `
IMPORTANT INDUSTRY-SPECIFIC GUIDANCE:
Industry: ${industryInfo.industry}

REQUIRED SKILLS TO EMPHASIZE:
${industryInfo.requiredSkills.map(skill => `- ${skill}`).join('\n')}

KEY VALUE PROPOSITIONS FOR THIS INDUSTRY:
${industryInfo.valuePropositions.map(value => `- ${value}`).join('\n')}

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

The original CV content is below. YOU MUST ENHANCE AND REWRITE THIS CONTENT, NOT REMOVE IT:

${rawText}

Potential CV sections I've identified (you can modify or add to these):
${potentialSections.map(section => `- ${section}`).join('\n')}

CV Analysis:
ATS Score: ${analysis.atsScore || 'N/A'}
Strengths: ${analysis.strengths && Array.isArray(analysis.strengths) ? analysis.strengths.join(", ") : 'None provided'}
Weaknesses: ${analysis.weaknesses && Array.isArray(analysis.weaknesses) ? analysis.weaknesses.join(", ") : 'None provided'}
Recommendations: ${analysis.recommendations && Array.isArray(analysis.recommendations) ? analysis.recommendations.join(", ") : 'None provided'}
Industry Insight: ${analysis.industryInsight || 'None provided'}
Target Roles: ${analysis.targetRoles && Array.isArray(analysis.targetRoles) ? analysis.targetRoles.join(", ") : 'None provided'}

${template ? `Selected Template: ${template.name} (${template.company} style)` : ''}

Please generate a complete, optimized CV with proper formatting markers, containing ALL relevant information from the original CV but enhanced and restructured. Include every section that was in the original CV, but optimize the content.

The response should be formatted as a JSON with two keys:
1. "optimizedText": The fully optimized CV text with proper formatting markers.
2. "pdfInstructions": Any specific instructions for PDF styling (colors, fonts, layout adjustments)`;
      
      console.log("Sending request to OpenAI with prompt length:", prompt.length);
      
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
        const errorData = await response.json().catch(() => null);
        console.error("OpenAI API error:", response.status, response.statusText, errorData);
        
        // If API call fails, create a formatted version of the raw text as fallback
        console.log("API call failed, using formatted raw text as fallback");
        const fallbackText = createFormattedFallbackFromRawText(rawText);
        return {
          optimizedText: fallbackText,
          optimizedPDFUrl: await editPDF(fallbackText, template),
        };
      }

      const data = await response.json();
      let responseContent = data.choices[0]?.message?.content;

      if (!responseContent) {
        console.error("No content in OpenAI response:", data);
        // Use fallback if no response content
        const fallbackText = createFormattedFallbackFromRawText(rawText);
        return {
          optimizedText: fallbackText,
          optimizedPDFUrl: await editPDF(fallbackText, template),
        };
      }
      
      console.log("Received response from OpenAI, length:", responseContent.length);
      console.log("First 200 characters:", responseContent.substring(0, 200));

      // Fix any JSON string issues
      responseContent = fixJsonString(responseContent);

      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(responseContent);
        
        // Validate that we have optimized text
        if (!parsedResponse.optimizedText || parsedResponse.optimizedText.trim().length === 0) {
          console.error("OpenAI response missing optimizedText:", parsedResponse);
          // Use fallback if optimizedText is missing or empty
          const fallbackText = createFormattedFallbackFromRawText(rawText);
          return {
            optimizedText: fallbackText,
            optimizedPDFUrl: await editPDF(fallbackText, template),
          };
        }
        
        // Extract the optimized text content
        let optimizedText = parsedResponse.optimizedText || "";
        
        // Validate the optimized text has sufficient content
        if (optimizedText.trim().length < 100) {
          console.warn("Optimized text is too short, using fallback");
          optimizedText = createFormattedFallbackFromRawText(rawText);
        }
        
        // Process formatting markers
        optimizedText = processFormattingMarkers(optimizedText);
        
        // Get PDF editing instructions
        const pdfInstructions = parsedResponse.pdfInstructions || "";
        
        // Generate an optimized PDF using the pdfInstructions and optimizedText
        // Pass template information if available
        const optimizedPDFUrl = await editPDF(pdfInstructions, template);
        
        return {
          optimizedText,
          optimizedPDFUrl,
        };
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        console.error("Response content:", responseContent);
        
        // Fallback: If JSON parsing fails, treat the entire response as the optimized text
        console.log("Using fallback: treating entire response as optimized text");
        let optimizedText = processFormattingMarkers(responseContent);
        
        // Check if the response has enough content
        if (optimizedText.trim().length < 100) {
          console.warn("Processed response is too short, using formatted raw text");
          optimizedText = createFormattedFallbackFromRawText(rawText);
        }
        
        const optimizedPDFUrl = await editPDF(optimizedText, template);
        
        return {
          optimizedText,
          optimizedPDFUrl,
        };
      }
    } catch (error) {
      console.error("CV optimization error:", error);
      // Final fallback in case of any error
      const fallbackText = createFormattedFallbackFromRawText(rawText);
      return {
        optimizedText: fallbackText,
        optimizedPDFUrl: await editPDF(fallbackText, template),
      };
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
    
    // Check if the text has any content
    if (!text || text.trim().length === 0) {
      console.error("Empty text provided to processFormattingMarkers");
      return "[HEADER] Error\n\nNo content was provided for formatting.";
    }
    
    // If text doesn't have explicit column markers, add them for a standard layout
    if (!text.includes('[LEFT-COLUMN-START]') && !text.includes('[RIGHT-COLUMN-START]')) {
      console.log("No column markers found, adding standard layout markers");
      
      const lines = text.split('\n');
      let processedText = '';
      let foundProfile = false;
      let foundEducation = false;
      let foundSkills = false;
      let foundExperience = false;
      let foundLanguages = false;
      let foundCertifications = false;
      let inLeftColumn = false;
      let inRightColumn = false;
      
      // First pass: identify all sections
      const sections = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for section headers (either with ## or [HEADER])
        if (line.startsWith('## ') || line.startsWith('[HEADER]')) {
          const sectionName = line.replace('## ', '').replace('[HEADER]', '').trim();
          sections.push({
            name: sectionName,
            index: i,
            content: ''
          });
        }
      }
      
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
      
      // Determine which sections go in which column
      const leftColumnSections = ['Contact', 'Education', 'Skills', 'Languages', 'Certifications'];
      const rightColumnSections = ['Profile', 'Summary', 'Experience', 'Work Experience', 'Professional Experience'];
      
      // Start building the formatted text with column markers
      processedText = '[LEFT-COLUMN-START]\n';
      inLeftColumn = true;
      
      // Process each section
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextSectionIndex = i < sections.length - 1 ? sections[i + 1].index : lines.length;
        
        // Extract section content
        let sectionContent = '';
        for (let j = section.index + 1; j < nextSectionIndex; j++) {
          sectionContent += lines[j] + '\n';
        }
        
        section.content = sectionContent;
        
        // Determine if this section should be in the left or right column
        const isLeftColumnSection = leftColumnSections.some(s => 
          section.name.toLowerCase().includes(s.toLowerCase()));
        
        const isRightColumnSection = rightColumnSections.some(s => 
          section.name.toLowerCase().includes(s.toLowerCase()));
        
        // Handle column transitions
        if (isLeftColumnSection && !inLeftColumn) {
          // Close right column and open left column
          processedText += '[RIGHT-COLUMN-END]\n\n[LEFT-COLUMN-START]\n';
          inLeftColumn = true;
          inRightColumn = false;
        } else if (isRightColumnSection && !inRightColumn) {
          // Close left column and open right column
          if (inLeftColumn) {
            processedText += '[LEFT-COLUMN-END]\n\n';
            inLeftColumn = false;
          }
          processedText += '[RIGHT-COLUMN-START]\n';
          inRightColumn = true;
        }
        
        // Add section header and content
        processedText += `[HEADER] ${section.name}\n\n${section.content}\n`;
      }
      
      // Close any open columns
      if (inLeftColumn) {
        processedText += '[LEFT-COLUMN-END]\n';
      } else if (inRightColumn) {
        processedText += '[RIGHT-COLUMN-END]\n';
      }
      
      text = processedText;
    } else {
      console.log("Column markers found, processing existing markers");
    }
    
    // Process other formatting markers
    text = text
      .replace(/\[HEADER\]/g, "\n\n## ")
      .replace(/\[SUBHEADER\]/g, "\n\n### ")
      .replace(/\[BULLET\]/g, "\n• ")
      .replace(/\[LEFT-COLUMN-START\]/g, "\n\n[LEFT-COLUMN-START]\n")
      .replace(/\[LEFT-COLUMN-END\]/g, "\n[LEFT-COLUMN-END]\n\n")
      .replace(/\[RIGHT-COLUMN-START\]/g, "\n\n[RIGHT-COLUMN-START]\n")
      .replace(/\[RIGHT-COLUMN-END\]/g, "\n[RIGHT-COLUMN-END]\n\n");
    
    // Ensure we have both column markers
    if (text.includes('[LEFT-COLUMN-START]') && !text.includes('[LEFT-COLUMN-END]')) {
      console.warn("LEFT-COLUMN-START found but no LEFT-COLUMN-END, adding end marker");
      text += "\n[LEFT-COLUMN-END]\n";
    }
    
    if (text.includes('[RIGHT-COLUMN-START]') && !text.includes('[RIGHT-COLUMN-END]')) {
      console.warn("RIGHT-COLUMN-START found but no RIGHT-COLUMN-END, adding end marker");
      text += "\n[RIGHT-COLUMN-END]\n";
    }
    
    // If we have no column markers at all after processing, add default ones
    if (!text.includes('[LEFT-COLUMN-START]') && !text.includes('[RIGHT-COLUMN-START]')) {
      console.warn("No column markers after processing, adding default layout");
      text = `[LEFT-COLUMN-START]
[HEADER] Contact

[LEFT-COLUMN-END]

[RIGHT-COLUMN-START]
${text}
[RIGHT-COLUMN-END]`;
    }
    
    return text;
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
  
  // Simulated PDF editing function.
  async function editPDF(pdfInstructions: string, template?: CVTemplate): Promise<string> {
    // In a real scenario, you'd call your PDF parsing/editing tool here.
    // Parse the instructions to format them for the PDF generator
    let parsedInstructions = pdfInstructions;
    
    try {
      // If the instructions are provided as a JSON string, parse them
      const instructionsObj = JSON.parse(pdfInstructions);
      
      // If template is provided, apply template-specific styling
      if (template) {
        // Add template information to the instructions
        instructionsObj.template = {
          name: template.name,
          company: template.company,
          preferredFonts: template.metadata.preferredFonts,
          colorScheme: template.metadata.colorScheme,
          layout: template.metadata.layout
        };
      }
      
      // Enhanced processing logic can be added here based on the structure of instructionsObj
      // For example, extracting color schemes, font styles, layout templates, etc.
      
      // Convert back to string with improved formatting
      parsedInstructions = JSON.stringify(instructionsObj, null, 2);
    } catch (error) {
      // If it's not valid JSON, use as is
      console.log("PDF instructions are not in JSON format, using as plain text");
      
      // If template is provided but instructions aren't JSON, append template info
      if (template) {
        parsedInstructions += `\n\nTemplate: ${template.name} (${template.company})\n`;
        parsedInstructions += `Fonts: ${template.metadata.preferredFonts.join(', ')}\n`;
        parsedInstructions += `Layout: ${template.metadata.layout}\n`;
      }
    }
    
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In the real implementation, you would:
    // 1. Use a PDF generation library (e.g., PDFKit, jsPDF)
    // 2. Apply the styling and layout based on parsedInstructions
    // 3. Generate and save the PDF
    // 4. Return the URL to the saved PDF
    
    return "https://example.com/path/to/optimized-cv.pdf";
  }
  