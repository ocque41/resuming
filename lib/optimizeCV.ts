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
- "optimizedText": a STRING containing the complete revised CV text with professional formatting and layout instructions.
- "pdfInstructions": detailed instructions for a PDF editing tool to transform the original CV PDF into a professionally designed document.

IMPORTANT: The user is actively job hunting RIGHT NOW. Focus on making their CV stand out visually and content-wise.

For the optimizedText, create a COMPLETE REDESIGN that includes:

1. PROFESSIONAL LAYOUT: Create a modern, clean design with proper spacing, alignment, and visual hierarchy
   - Include clear section for contact information at the top
   - Use appropriate margins and spacing between sections
   - Create a balanced, easy-to-scan layout

2. COMPELLING CONTENT:
   - Write a powerful PROFESSIONAL SUMMARY (3-4 lines) that highlights key strengths
   - Create a clear CAREER OBJECTIVE statement (1-2 lines)
   - Transform experience into ACHIEVEMENT STATEMENTS with metrics (e.g., "Increased efficiency by 20%")
   - Highlight RELEVANT SKILLS with visual organization (e.g., skill bars or categories)

3. VISUAL ELEMENTS:
   - Suggest appropriate font pairings (one for headings, one for body text)
   - Recommend a professional color scheme (2-3 colors maximum)
   - Include formatting instructions for section headers, subheadings, and body text
   - Add visual dividers between sections

4. CONTENT ORGANIZATION:
   - Arrange information in order of relevance to target positions
   - Group related skills and experiences
   - Use white space effectively to improve readability
   - Create a logical flow of information

The optimizedText should include formatting markers like:
- [HEADER] for main section headers
- [SUBHEADER] for subsections
- [BOLD] for emphasized text
- [BULLET] for bullet points
- [DIVIDER] for section separators
- [COLUMN-START] and [COLUMN-END] for multi-column sections

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
      optimizedData = JSON.parse(message);
      
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
  
  // Process formatting markers in the text to create a more visually appealing document
  function processFormattingMarkers(text: string): string {
    // Replace formatting markers with appropriate styling
    return text
      .replace(/\[HEADER\]/g, '\n\n')
      .replace(/\[SUBHEADER\]/g, '\n')
      .replace(/\[BOLD\]/g, '')
      .replace(/\[\/BOLD\]/g, '')
      .replace(/\[BULLET\]/g, '• ')
      .replace(/\[DIVIDER\]/g, '\n-------------------------------------------\n')
      .replace(/\[COLUMN-START\]/g, '')
      .replace(/\[COLUMN-END\]/g, '')
      .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with just two
  }
  
  // Helper function to convert a nested object to a formatted string
  function formatNestedObjectToString(obj: any): string {
    let result = '';
    
    // Process each section
    for (const [sectionName, content] of Object.entries(obj)) {
      // Add section header
      result += `[HEADER]${sectionName.toUpperCase()}[HEADER]\n\n`;
      
      // Process section content
      if (typeof content === 'string') {
        // Simple string content
        result += `${content}\n\n`;
      } else if (content && typeof content === 'object') {
        // Nested object content (check that content is not null)
        for (const [subheading, subcontent] of Object.entries(content as Record<string, any>)) {
          // Add subheading
          result += `[SUBHEADER]${subheading}[SUBHEADER]\n`;
          
          // Process subcontent
          if (Array.isArray(subcontent)) {
            // Array of bullet points
            for (const point of subcontent) {
              result += `[BULLET]${point}\n`;
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
    // For now, we simulate with a delay and return a dummy URL.
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing delay.
    return "https://example.com/path/to/optimized-cv.pdf";
  }
  