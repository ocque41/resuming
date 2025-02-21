// lib/optimizeCV.ts
export async function optimizeCV(rawText: string, analysis: any): Promise<string> {
    // Build a prompt that leverages the analysis and original CV text.
    const prompt = `You are an expert CV optimizer. Based on the following analysis and original CV content, produce an optimized version of the CV that improves clarity and impact.
    
  CV Analysis:
  - ATS Score: ${analysis.atsScore}%
  - Strengths: ${analysis.strengths.join(', ')}
  - Weaknesses: ${analysis.weaknesses.join(', ')}
  - Recommendations: ${analysis.recommendations.join(', ')}
  
  Original CV Content:
  ${rawText}
  
  Please provide only the optimized CV content.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4', // or use your designated model like "gpt-4o"
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    
    const result = await response.json();
    const optimizedText = result.choices[0].message.content;
    return optimizedText;
  }
  