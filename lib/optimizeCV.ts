// lib/optimizeCV.ts
export async function optimizeCV(
    rawText: string,
    analysis: any
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    // Extract potential sections from the raw text to guide the AI
    const potentialSections = extractPotentialSections(rawText);
    
    // Build a prompt for GPT-4 that instructs it to generate both optimized text and PDF editing instructions.
    const prompt = `You are an expert CV optimizer specializing in creating professional, job-winning resumes. Your goal is to help the user GET A JOB NOW, not give general career advice.

Based on the following analysis and original CV content, generate a JSON response with two keys:
- "optimizedText": a STRING containing the complete revised CV text with proper formatting. Do not use a nested object structure - the value must be a single string with line breaks.
- "pdfInstructions": a concise instruction set for a PDF editing tool to transform the original CV PDF accordingly.

IMPORTANT: The user is actively job hunting RIGHT NOW. Do not suggest getting more experience or education - they need this CV to land interviews immediately.

For the optimizedText:
1. Create a PROFESSIONAL, WELL-STRUCTURED document with clear sections and proper formatting
2. Include a compelling PROFESSIONAL SUMMARY at the top that clearly states career objectives
3. Add MEASURABLE ACHIEVEMENTS with numbers and metrics wherever possible (even if you need to create reasonable estimates based on the information provided)
4. Organize information in a LOGICAL HIERARCHY with the most impressive and relevant information first
5. Use INDUSTRY-SPECIFIC KEYWORDS relevant to their target roles
6. Create CLEAR VISUAL SEPARATION between sections with proper spacing and formatting
7. Ensure all bullet points are ACHIEVEMENT-ORIENTED, not just listing responsibilities
8. Include specific QUANTIFIABLE RESULTS where possible (e.g., "Increased efficiency by 20%")

IMPORTANT FORMATTING RULES:
- Create a professional, modern layout with clear section headings
- Use consistent formatting for section headers (e.g., ALL CAPS for main sections)
- Format bullet points consistently with proper indentation
- Use a clean, readable font style throughout
- Maintain appropriate spacing between sections
- Ensure the document has a professional, polished appearance

CRITICAL: The "optimizedText" value MUST be a single string with line breaks, NOT a nested JSON object. For example:
"optimizedText": "MIGUEL OCQUE\\n\\nPROFESSIONAL SUMMARY\\nMeticulous and analytical professional with a strong foundation in Investment & Trading...\\n\\nOBJECTIVE\\nSeeking to leverage my diverse skill set..."

I've identified these potential sections in the CV:
${potentialSections.map(section => `- ${section}`).join('\n')}

Please organize your optimized text using these section headers where appropriate, adding proper formatting.

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
  
  // Helper function to convert a nested object to a formatted string
  function formatNestedObjectToString(obj: any): string {
    let result = '';
    
    // Process each section
    for (const [sectionName, content] of Object.entries(obj)) {
      // Add section header
      result += `${sectionName.toUpperCase()}\n\n`;
      
      // Process section content
      if (typeof content === 'string') {
        // Simple string content
        result += `${content}\n\n`;
      } else if (content && typeof content === 'object') {
        // Nested object content (check that content is not null)
        for (const [subheading, subcontent] of Object.entries(content as Record<string, any>)) {
          // Add subheading
          result += `${subheading}\n`;
          
          // Process subcontent
          if (Array.isArray(subcontent)) {
            // Array of bullet points
            for (const point of subcontent) {
              result += `• ${point}\n`;
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
  