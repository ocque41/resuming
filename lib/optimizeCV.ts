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
ATS Score: ${analysis.atsScore}
Strengths: ${analysis.strengths.join(", ")}
Weaknesses: ${analysis.weaknesses.join(", ")}
Recommendations: ${analysis.recommendations.join(", ")}
Industry Insight: ${analysis.industryInsight}
Target Roles: ${analysis.targetRoles.join(", ")}

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
  