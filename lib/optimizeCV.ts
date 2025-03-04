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
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let responseContent = data.choices[0]?.message?.content;

      if (!responseContent) {
        console.error("No content in OpenAI response:", data);
        throw new Error("No response content from OpenAI");
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
          throw new Error("OpenAI response missing optimized text content");
        }
        
        // Extract the optimized text content
        let optimizedText = parsedResponse.optimizedText || "";
        
        // Process formatting markers (this remains the same or is enhanced based on your markers)
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
        const optimizedText = processFormattingMarkers(responseContent);
        const optimizedPDFUrl = await editPDF(optimizedText, template);
        
        return {
          optimizedText,
          optimizedPDFUrl,
        };
      }
    } catch (error) {
      console.error("CV optimization error:", error);
      throw error;
    }
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
    // If text doesn't have explicit column markers, add them for a standard layout
    if (!text.includes('[LEFT-COLUMN-START]') && !text.includes('[RIGHT-COLUMN-START]')) {
      const lines = text.split('\n');
      let processedText = '';
      let foundProfile = false;
      let foundEducation = false;
      let foundSkills = false;
      let foundExperience = false;
      
      // Process each line to identify sections and add column markers
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for main sections
        if (line.match(/\b(PROFILE|SUMMARY|PROFESSIONAL SUMMARY|ABOUT ME)\b/i) && !foundProfile) {
          processedText += '\n\n[RIGHT-COLUMN-START]\n';
          processedText += line + '\n';
          foundProfile = true;
        } else if (line.match(/\b(EDUCATION|ACADEMIC|QUALIFICATIONS)\b/i) && !foundEducation) {
          if (!foundProfile) {
            processedText += '\n\n[RIGHT-COLUMN-START]\n';
            foundProfile = true;
          } else if (foundExperience) {
            processedText += '\n[RIGHT-COLUMN-END]\n\n';
          }
          processedText += '\n\n[LEFT-COLUMN-START]\n';
          processedText += line + '\n';
          foundEducation = true;
        } else if (line.match(/\b(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES)\b/i) && !foundSkills) {
          if (foundEducation) {
            processedText += line + '\n';
          } else {
            processedText += '\n\n[LEFT-COLUMN-START]\n';
            processedText += line + '\n';
          }
          foundSkills = true;
        } else if (line.match(/\b(EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT)\b/i) && !foundExperience) {
          if (foundEducation || foundSkills) {
            processedText += '\n[LEFT-COLUMN-END]\n\n';
          }
          
          if (!foundProfile) {
            processedText += '\n\n[RIGHT-COLUMN-START]\n';
            foundProfile = true;
          }
          
          processedText += line + '\n';
          foundExperience = true;
        } else {
          processedText += line + '\n';
        }
      }
      
      // Close any open column tags
      if (foundEducation || foundSkills) {
        processedText += '\n[LEFT-COLUMN-END]\n\n';
      }
      
      if (foundProfile || foundExperience) {
        processedText += '\n[RIGHT-COLUMN-END]\n\n';
      }
      
      text = processedText;
    }
    
    return text
      .replace(/\[HEADER\]/g, "\n\n## ")
      .replace(/\[SUBHEADER\]/g, "\n\n### ")
      .replace(/\[BULLET\]/g, "\n• ")
      .replace(/\[LEFT-COLUMN-START\]/g, "\n\n[LEFT-COLUMN-START]\n")
      .replace(/\[LEFT-COLUMN-END\]/g, "\n[LEFT-COLUMN-END]\n\n")
      .replace(/\[RIGHT-COLUMN-START\]/g, "\n\n[RIGHT-COLUMN-START]\n")
      .replace(/\[RIGHT-COLUMN-END\]/g, "\n[RIGHT-COLUMN-END]\n\n");
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
  