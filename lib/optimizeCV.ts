// lib/optimizeCV.ts
export async function optimizeCV(
    rawText: string,
    analysis: any
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    // Extract potential sections from the raw text to guide the AI
    const potentialSections = extractPotentialSections(rawText);
    
    // Build a prompt for GPT-4 that instructs it to generate both optimized text and PDF editing instructions.
    const prompt = `You are an expert CV designer and content strategist specializing in creating professional, visually appealing resumes that get interviews. Your goal is to help the user GET A JOB NOW.

Based on the following analysis and original CV content, generate a JSON response with two keys:
- "optimizedText": a STRING containing the complete revised CV text with professional formatting and layout instructions. Ensure this is properly escaped for JSON (use \\n for newlines).
- "pdfInstructions": detailed instructions for a PDF editing tool to transform the original CV PDF into a professionally designed document.

IMPORTANT: The user is actively job hunting RIGHT NOW. You MUST SUBSTANTIALLY REWRITE and TRANSFORM the content, not just reformat it. The current CV is not getting interviews, so making minimal changes is not acceptable.

For the optimizedText, create a COMPLETE REDESIGN that includes:

1. PROFESSIONAL LAYOUT: Create a modern, clean design with proper spacing, alignment, and visual hierarchy
   - Include clear section for contact information at the top with elegant icons for email, phone, website
   - Use appropriate margins and spacing between sections (at least 0.75-inch margins)
   - Create a balanced, easy-to-scan layout with strategic use of white space
   - Design a header with the candidate's name prominently displayed in a larger font size

2. COMPELLING CONTENT - YOU MUST COMPLETELY REWRITE THIS SECTION:
   - Write a powerful PROFESSIONAL SUMMARY (3-4 lines) that showcases unique value proposition and expertise - do not copy from original CV
   - Create a clear CAREER OBJECTIVE statement (1-2 lines) aligned with target roles - make this compelling and specific
   - Transform ALL experience bullet points into ACHIEVEMENT STATEMENTS with quantifiable metrics and results (add realistic metrics if none exist)
   - Add at least 1-2 new achievements for each role that weren't in the original CV but are plausible based on the job description
   - Highlight RELEVANT SKILLS in a visually appealing, structured format with skill level indicators
   - Ensure all content is ATS-optimized with relevant keywords from the industry
   - Remove any unprofessional or irrelevant content

3. VISUAL ELEMENTS:
   - Use modern, professional font pairings (e.g., Helvetica/Garamond, Calibri/Cambria) with appropriate sizes
   - Implement a sophisticated color scheme (primary brand color + 1-2 complementary colors)
   - Format section headers with color, capitalization, and/or subtle styling (e.g., bottom border)
   - Add elegant visual dividers and structural elements
   - Consider a subtle sidebar or header background color for visual interest

4. CONTENT ORGANIZATION:
   - Arrange sections in order of relevance to target positions (most relevant first)
   - Group related skills into clear categories (technical, soft, industry-specific)
   - Ensure consistent formatting for dates, job titles, and companies
   - Create a logical flow that tells a compelling career story
   - Remove any irrelevant or outdated information

The optimizedText MUST include proper formatting markers like:
- [HEADER] for main section headers
- [SUBHEADER] for subsections
- [BOLD] for emphasized text
- [BULLET] for bullet points
- [DIVIDER] for section separators
- [COLUMN-START] and [COLUMN-END] for multi-column sections

IMPORTANT: The final result MUST be highly professional and polished. This is NOT a template - create a COMPLETELY CUSTOMIZED, UNIQUE design specifically for this candidate based on their experience, skills and target roles.

CRITICAL: The optimized CV must be SUBSTANTIALLY DIFFERENT from the original. If your output looks similar to the input, you have failed. Rewrite ALL content to be more impactful and achievement-oriented.

I've identified these potential sections in the CV:
${potentialSections.map(section => `- ${section}`).join('\n')}

CV Analysis:
ATS Score: ${analysis.atsScore}
Strengths: ${analysis.strengths.join(", ")}
Weaknesses: ${analysis.weaknesses.join(", ")}
Recommendations: ${analysis.recommendations.join(", ")}
Industry Insight: ${analysis.industryInsight || "Not provided"}
Target Roles: ${analysis.targetRoles ? analysis.targetRoles.join(", ") : "Not provided"}

Original CV Content:
${rawText}

Return your answer strictly as JSON without additional text.`;
  
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4", // Upgraded to GPT-4 for better quality
        messages: [{ role: "user", content: prompt }],
        stream: false,
        temperature: 0.7, // Add some creativity for design
      }),
    });
    const result = await response.json();
    const message = result.choices[0].message.content;
    let optimizedData: { optimizedText: string; pdfInstructions: string | object };
    
    try {
      // Try to parse the JSON response
      try {
        optimizedData = JSON.parse(message);
      } catch (jsonError) {
        // If parsing fails, try to fix common JSON issues
        const fixedMessage = fixJsonString(message);
        optimizedData = JSON.parse(fixedMessage);
      }
      
      // Handle case where optimizedText is an object instead of a string
      if (typeof optimizedData.optimizedText === 'object') {
        // Convert the nested object to a formatted string
        const formattedText = formatNestedObjectToString(optimizedData.optimizedText);
        optimizedData.optimizedText = formattedText;
      }
      
      // Process formatting markers in the optimized text
      if (typeof optimizedData.optimizedText === 'string') {
        optimizedData.optimizedText = processFormattingMarkers(optimizedData.optimizedText);
      }
      
    } catch (error) {
      console.error("Failed to parse optimization response:", message);
      throw new Error("Failed to parse optimization response: " + message);
    }
  
    // Simulate calling a PDF parsing tool that uses the provided instructions to generate an optimized PDF.
    const optimizedPDFUrl = await editPDF(
      typeof optimizedData.pdfInstructions === 'string' 
        ? optimizedData.pdfInstructions 
        : JSON.stringify(optimizedData.pdfInstructions)
    );
    
    return { optimizedText: optimizedData.optimizedText, optimizedPDFUrl };
  }
  
  // Function to fix common JSON string issues
  function fixJsonString(jsonString: string): string {
    // Try to extract the JSON object from the response if there's extra text
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    
    // Replace literal newlines with escaped newlines in the optimizedText field
    let fixed = jsonString.replace(/"optimizedText"\s*:\s*"([\s\S]*?)(?=",\s*"pdfInstructions")/, (match, p1) => {
      // Replace all literal newlines with escaped newlines
      const escaped = p1.replace(/\n/g, '\\n');
      return `"optimizedText":"${escaped}`;
    });
    
    // Fix any trailing commas in arrays or objects
    fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    return fixed;
  }
  
  // Process formatting markers in the text to create a more visually appealing document
  function processFormattingMarkers(text: string): string {
    // Replace formatting markers with appropriate styling
    let processed = text
      .replace(/\[HEADER\]/g, '\n\n')
      .replace(/\[\/HEADER\]/g, '')
      .replace(/\[SUBHEADER\]/g, '\n')
      .replace(/\[\/SUBHEADER\]/g, '')
      .replace(/\[BOLD\]/g, '')
      .replace(/\[\/BOLD\]/g, '')
      .replace(/\[BULLET\]/g, '• ')
      .replace(/\[DIVIDER\]/g, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      .replace(/\[COLUMN-START\]/g, '')
      .replace(/\[COLUMN-END\]/g, '')
      .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with just two
    
    // Add proper spacing and formatting around section headers
    processed = processed.replace(/([A-Z\s]+)\n\n/g, '\n\n$1\n\n');
    
    // Ensure bullet points are properly indented and formatted with better spacing
    processed = processed.replace(/•\s+/g, '•   ');
    processed = processed.replace(/•   ([A-Z])/g, '•   $1'); // Capitalize first letter of bullet points
    
    // Add proper spacing and formatting for contact information
    processed = processed.replace(/(email|phone|portfolio|linkedin|website|github)/gi, '\n$1');
    processed = processed.replace(/(Email|Phone|Portfolio|LinkedIn|Website|GitHub):/gi, '$1:  ');
    
    // Better formatting for dates and locations
    processed = processed.replace(/(\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*Present)/g, '  $1  ');
    processed = processed.replace(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi, '  $&  ');
    
    // Remove extra whitespace before punctuation
    processed = processed.replace(/\s+([.,;:])/g, '$1');
    
    // Ensure consistent spacing after punctuation
    processed = processed.replace(/([.,;:])(?!\s|$)/g, '$1 ');
    
    return processed;
  }
  
  // Helper function to convert a nested object to a formatted string
  function formatNestedObjectToString(obj: any): string {
    let result = '';
    
    // Process each section
    for (const [sectionName, content] of Object.entries(obj)) {
      // Add section header with proper formatting
      result += `[HEADER]${sectionName.toUpperCase()}[/HEADER]\n\n`;
      
      // Process section content
      if (typeof content === 'string') {
        // Simple string content
        result += `${content}\n\n`;
      } else if (content && typeof content === 'object') {
        // Nested object content (check that content is not null)
        for (const [subheading, subcontent] of Object.entries(content as Record<string, any>)) {
          // Add subheading with proper formatting
          result += `[SUBHEADER]${subheading}[/SUBHEADER]\n`;
          
          // Process subcontent
          if (Array.isArray(subcontent)) {
            // Array of bullet points
            for (const point of subcontent) {
              // If point is already a string, just add as bullet
              if (typeof point === 'string') {
                result += `[BULLET]${point}\n`;
              } 
              // If point is an object (e.g. for experience entries with dates, roles, etc.)
              else if (typeof point === 'object' && point !== null) {
                let bulletContent = '';
                // Handle common fields like role, date, company, description
                if (point.role) bulletContent += `[BOLD]${point.role}[/BOLD]`;
                if (point.company) bulletContent += bulletContent ? ` at ${point.company}` : `${point.company}`;
                if (point.date) bulletContent += ` | ${point.date}`;
                if (point.location) bulletContent += ` | ${point.location}`;
                
                if (bulletContent) {
                  result += `${bulletContent}\n`;
                }
                
                // Handle description or achievements as nested bullets
                if (point.description) {
                  if (typeof point.description === 'string') {
                    result += `${point.description}\n`;
                  } else if (Array.isArray(point.description)) {
                    for (const desc of point.description) {
                      result += `[BULLET]${desc}\n`;
                    }
                  }
                }
                
                if (point.achievements && Array.isArray(point.achievements)) {
                  for (const achievement of point.achievements) {
                    result += `[BULLET]${achievement}\n`;
                  }
                }
              }
            }
          } else if (typeof subcontent === 'string') {
            // String content
            result += `${subcontent}\n`;
          }
          
          result += '\n';
        }
      } else if (content === null) {
        // Handle null content
        result += 'No information provided\n\n';
      }
      
      // Add a divider after each major section except the last one
      if (Object.keys(obj).indexOf(sectionName) < Object.keys(obj).length - 1) {
        result += '[DIVIDER]\n';
      }
    }
    
    return result;
  }
  
  // Helper function to extract potential sections from the raw text
  function extractPotentialSections(rawText: string): string[] {
    const commonSections = [
      "PROFILE", "OBJECTIVE", "SUMMARY", "EXPERIENCE", "WORK EXPERIENCE", 
      "EDUCATION", "SKILLS", "LANGUAGES", "CERTIFICATIONS", "PROJECTS",
      "INTERESTS", "REFERENCES", "PUBLICATIONS", "AWARDS", "VOLUNTEER",
      "ACHIEVEMENTS", "PROFESSIONAL SUMMARY"
    ];
    
    const foundSections = [];
    
    for (const section of commonSections) {
      const regex = new RegExp(`(^|\\s)${section}[\\s:]*`, 'i');
      if (regex.test(rawText)) {
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
  