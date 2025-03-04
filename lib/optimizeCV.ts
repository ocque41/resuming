// lib/optimizeCV.ts
export async function optimizeCV(
    rawText: string,
    analysis: any
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    try {
      // Get potential sections
      const potentialSections = extractPotentialSections(rawText);
      
      // Build a prompt for GPT-4 that instructs it to generate both optimized text and PDF editing instructions.
      const prompt = `You are a professional CV writer who specializes in transforming basic CVs into polished, high-impact documents. The user has uploaded a CV that needs a complete redesign in both content and format, with the goal of creating a modern, professional document that will significantly increase their chances of getting interviews.

Your task is to completely rewrite and restructure this CV to match a modern two-column layout with the following sections:

LEFT COLUMN (narrow):
- Contact Information (short, concise)
- Education (formatted with years and institutions prominently displayed)
- Languages (with proficiency levels)
- Technical Skills (separated by category)

RIGHT COLUMN (main content):
- Professional Profile (3-4 compelling sentences highlighting unique value proposition)
- Professional Experience (achievement-oriented bullet points, with metrics and results)
- Additional Skills & Certifications (if applicable)

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

IMPORTANT: The final result MUST be highly professional and tailored specifically for this candidate. Create a COMPLETELY CUSTOMIZED document - not a generic template.

CRITICAL: The optimized CV must be SUBSTANTIALLY DIFFERENT from the original. If your output looks similar to the input, you have failed. Rewrite ALL content to be more impactful, concise, and achievement-oriented.

I've identified these potential sections in the CV:
${potentialSections.map(section => `- ${section}`).join('\n')}

CV Analysis:
ATS Score: ${analysis.atsScore || 'N/A'}
Strengths: ${analysis.strengths && Array.isArray(analysis.strengths) ? analysis.strengths.join(", ") : 'None provided'}
Weaknesses: ${analysis.weaknesses && Array.isArray(analysis.weaknesses) ? analysis.weaknesses.join(", ") : 'None provided'}
Recommendations: ${analysis.recommendations && Array.isArray(analysis.recommendations) ? analysis.recommendations.join(", ") : 'None provided'}
Industry Insight: ${analysis.industryInsight || 'None provided'}
Target Roles: ${analysis.targetRoles && Array.isArray(analysis.targetRoles) ? analysis.targetRoles.join(", ") : 'None provided'}

CV Content:
${rawText}

Please generate a JSON response with two keys:
1. "optimizedText": The fully optimized CV text with proper formatting markers
2. "pdfInstructions": Any specific instructions for PDF styling (colors, fonts, layout adjustments)`;
      
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
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      let responseContent = data.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      // Fix any JSON string issues
      responseContent = fixJsonString(responseContent);

      try {
        // Parse the JSON response
        const parsedResponse = JSON.parse(responseContent);
        
        // Extract the optimized text content
        let optimizedText = parsedResponse.optimizedText || "";
        
        // Process formatting markers (this remains the same or is enhanced based on your markers)
        optimizedText = processFormattingMarkers(optimizedText);
        
        // Get PDF editing instructions
        const pdfInstructions = parsedResponse.pdfInstructions || "";
        
        // Generate an optimized PDF using the pdfInstructions and optimizedText
        const optimizedPDFUrl = await editPDF(optimizedText);
        
        return {
          optimizedText,
          optimizedPDFUrl,
        };
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        
        // Fallback: If JSON parsing fails, treat the entire response as the optimized text
        const optimizedText = processFormattingMarkers(responseContent);
        const optimizedPDFUrl = await editPDF(optimizedText);
        
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
            return '{"optimizedText":"Could not parse the AI response. Please try again."}';
          }
        } else {
          // If no object-like structure is found, return a minimal valid JSON
          return '{"optimizedText":"Could not parse the AI response. Please try again."}';
        }
      }
    }
  }
  
  // Process formatting markers in the text
  function processFormattingMarkers(text: string): string {
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
  async function editPDF(pdfInstructions: string): Promise<string> {
    // In a real scenario, you'd call your PDF parsing/editing tool here.
    // Parse the instructions to format them for the PDF generator
    let parsedInstructions = pdfInstructions;
    
    try {
      // If the instructions are provided as a JSON string, parse them
      const instructionsObj = JSON.parse(pdfInstructions);
      
      // Enhanced processing logic can be added here based on the structure of instructionsObj
      // For example, extracting color schemes, font styles, layout templates, etc.
      
      // Convert back to string with improved formatting
      parsedInstructions = JSON.stringify(instructionsObj, null, 2);
    } catch (error) {
      // If it's not valid JSON, use as is
      console.log("PDF instructions are not in JSON format, using as plain text");
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
  