// lib/analyzeCV.ts
export async function analyzeCV(rawText: string): Promise<any> {
    // Clean the text: remove extra whitespace
    const cleanedText = rawText.trim().replace(/\s+/g, ' ');
  
    // Construct a prompt that instructs the AI to output JSON
    const prompt = `You are an expert CV reviewer. Please analyze the following CV content and provide:
  - ATS Score (as a percentage)
  - A list of strengths
  - A list of weaknesses
  - Three recommendations for improvement
  
  Output your response strictly in JSON format with the keys "atsScore", "strengths", "weaknesses", and "recommendations".
  
  CV Content:
  ${cleanedText}`;
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        // For faster response within the 10s limit, you might use a lighter model.
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
  
    const result = await response.json();
    const message = result.choices[0].message.content;
  
    try {
      const analysis = JSON.parse(message);
      return analysis;
    } catch (error) {
      throw new Error('Failed to parse AI response: ' + message);
    }
  }
  