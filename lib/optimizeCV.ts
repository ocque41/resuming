// lib/optimizeCV.ts
export async function optimizeCV(
    rawText: string,
    analysis: any
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    // Extract potential sections from the raw text to guide the AI
    const potentialSections = extractPotentialSections(rawText);
    
    // Build a prompt for GPT-3.5-turbo that instructs it to generate both optimized text and PDF editing instructions.
    const prompt = `You are an expert CV optimizer specializing in creating job-winning resumes. Your goal is to help the user GET A JOB NOW, not give general career advice.

Based on the following analysis and original CV content, generate a JSON response with two keys:
- "optimizedText": a revised version of the CV text that improves clarity, formatting, and overall impact. Structure the text with section headers using ## (e.g., ## Experience, ## Education) and maintain paragraph breaks with blank lines.
- "pdfInstructions": a concise instruction set for a PDF editing tool to transform the original CV PDF accordingly.

IMPORTANT: The user is actively job hunting RIGHT NOW. Do not suggest getting more experience or education - they need this CV to land interviews immediately.

For the optimizedText:
1. Identify the user's career path and industry from their CV (e.g., mobile development, data science, marketing)
2. Emphasize RELEVANT keywords and skills for their target industry
3. Highlight ACHIEVEMENTS and RESULTS, not just responsibilities
4. Remove or de-emphasize content that doesn't contribute to their immediate job search
5. Reorganize sections to put the most impressive and relevant information first
6. Make the CV ATS-friendly while maintaining readability for humans

IMPORTANT FORMATTING RULES:
- Use only ASCII characters
- For bullet points, use the "• " character (bullet followed by space)
- Avoid using special characters or symbols that might cause encoding issues
- Use blank lines to separate paragraphs, not just line breaks
- Do not use tabs or other special whitespace characters

I've identified these potential sections in the CV:
${potentialSections.map(section => `- ${section}`).join('\n')}

Please organize your optimized text using these section headers where appropriate, adding ## before each section name.

CV Analysis:
ATS Score: ${analysis.atsScore}%
Strengths: ${analysis.strengths.join(", ")}
Weaknesses: ${analysis.weaknesses.join(", ")}
Recommendations: ${analysis.recommendations.join(", ")}

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
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });
    const result = await response.json();
    const message = result.choices[0].message.content;
    let optimizedData: { optimizedText: string; pdfInstructions: string };
    try {
      optimizedData = JSON.parse(message);
    } catch (error) {
      throw new Error("Failed to parse optimization response: " + message);
    }
  
    // Simulate calling a PDF parsing tool that uses the provided instructions to generate an optimized PDF.
    const optimizedPDFUrl = await editPDF(optimizedData.pdfInstructions);
    return { optimizedText: optimizedData.optimizedText, optimizedPDFUrl };
  }
  
  // Helper function to extract potential sections from the raw text
  function extractPotentialSections(rawText: string): string[] {
    const commonSections = [
      "PROFILE", "OBJECTIVE", "SUMMARY", "EXPERIENCE", "WORK EXPERIENCE", 
      "EDUCATION", "SKILLS", "LANGUAGES", "CERTIFICATIONS", "PROJECTS",
      "INTERESTS", "REFERENCES", "PUBLICATIONS", "AWARDS", "VOLUNTEER"
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
  