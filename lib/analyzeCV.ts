// lib/analyzeCV.ts
export async function analyzeCV(rawText: string): Promise<any> {
    // Clean the text: remove extra whitespace
    const cleanedText = rawText.trim().replace(/\s+/g, ' ');
  
    // Construct the prompt: instruct the AI to return a JSON output with analysis details.
    const prompt = `You are an expert CV reviewer. Analyze the following CV content and provide:
  - ATS Score (as a percentage)
  - A list of strengths
  - A list of weaknesses
  - Three recommendations for improvement
  
  Please output your response in JSON format with the keys "atsScore", "strengths", "weaknesses", and "recommendations".
  
  CV Content:
  ${cleanedText}`;
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
  
    const result = await response.json();
    const message = result.choices[0].message.content;
  
    // Try parsing the response as JSON.
    try {
      const analysis = JSON.parse(message);
      return analysis;
    } catch (error) {
      throw new Error('Failed to parse AI response: ' + message);
    }
  }
  