// lib/metadata/analyze.ts
import { openai } from "@ai-sdk/openai";

/**
 * Analyzes the given CV prompt using the AI model and returns the parsed JSON response.
 * @param prompt The prompt text that includes the CV content and instructions.
 * @returns Parsed JSON output from the AI model.
 */
export async function analyzeCVWithAI(prompt: string): Promise<any> {
  // Create the model instance.
  const model = openai("gpt-4o");

  // Construct the tool message.
  // The 'type' property is set to the literal "tool-result" as required.
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

  // Build the call options.
  const options = {
    inputFormat: "prompt" as const,
    prompt: [toolMessage],
    mode: { type: "regular" as const }
  };

  // Call the model to generate output.
  const response = await model.doGenerate(options);
  if (!response.text) {
    throw new Error("No text returned from AI analysis.");
  }
  return JSON.parse(response.text);
}
