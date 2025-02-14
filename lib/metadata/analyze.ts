/**
 * Analyzes the given CV prompt using OpenAI's API directly and returns the parsed JSON response.
 * @param prompt The prompt text that includes the CV content and instructions.
 * @returns Parsed JSON output from the AI model.
 */
export async function analyzeCVWithAI(prompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined");
  }
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: prompt,
      }],
      stream: false,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("No content returned from OpenAI API.");
  }
  
  return JSON.parse(messageContent);
}
