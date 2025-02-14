// lib/metadata/analyze.ts

/**
 * Analyzes the given CV prompt using the AI model and returns the parsed JSON response.
 * @param prompt The prompt text that includes the CV content and instructions.
 * @returns Parsed JSON output from the AI model.
 */
export async function analyzeCVWithAI(prompt: string): Promise<any> {
  // Use a dynamic import to load the OpenAI SDK at runtime.
  const { openai } = await import("@ai-sdk/openai");

  const toolMessage = {
    role: "tool" as const,
    content: [
      {
        text: prompt,
        type: "tool-result" as const,
        toolCallId: "cvAnalysis",
        toolName: "cvMetadataAnalysis",
        result: ""
      }
    ]
  };

  const options = {
    inputFormat: "prompt" as const,
    prompt: [toolMessage],
    mode: { type: "regular" as const }
  };

  const response = await openai("gpt-4o").doGenerate(options);
  if (!response.text) {
    throw new Error("No text returned from AI analysis.");
  }
  return JSON.parse(response.text);
}
