// lib/optimizeCV.ts
export async function optimizeCV(
    rawText: string,
    analysis: any
  ): Promise<{ optimizedText: string; optimizedPDFUrl: string }> {
    // Build a prompt for GPT-3.5-turbo that instructs it to generate both optimized text and PDF editing instructions.
    const prompt = `You are an expert CV optimizer. Based on the following analysis and original CV content, generate a JSON response with two keys:
  - "optimizedText": a revised version of the CV text that improves clarity, formatting, and overall impact.
  - "pdfInstructions": a concise instruction set for a PDF editing tool to transform the original CV PDF accordingly.
  
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
  
  // Simulated PDF editing function.
  async function editPDF(pdfInstructions: string): Promise<string> {
    // In a real scenario, you'd call your PDF parsing/editing tool here.
    // For now, we simulate with a delay and return a dummy URL.
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing delay.
    return "https://example.com/path/to/optimized-cv.pdf";
  }
  