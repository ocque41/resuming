import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { openai } from "@ai-sdk/openai";

/**
 * Extracts text from a PDF file.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    await fs.access(filePath);
  } catch (err) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extracts metadata from a CV PDF using the AI model.
 * The prompt instructs the model to analyze the CV and return JSON with keys "atsScore", "optimized", and "sent".
 */
export async function extractMetadata(filePath: string): Promise<any> {
  try {
    const text = await extractTextFromPdf(filePath);
    const prompt = `
You are an expert CV reviewer. Analyze the following CV text and extract the following details:
- "atsScore": A percentage score (e.g., "85%") indicating how well the CV is optimized for Applicant Tracking Systems.
- "optimized": "Yes" if the CV is optimized for ATS, otherwise "No".
- "sent": "Yes" if the CV has been sent to employers, otherwise "No".

Return the answer strictly in JSON format (do not include any extra text).

CV Text:
${text}
    `;
    // Create a model instance using the openai function.
    const model = openai('gpt-4o');
    // Prepare call options with literal types.
    const options = {
      inputFormat: "prompt" as const,
      prompt: [{ role: "tool", content: [{ text: prompt }] }], // Adjusting to match LanguageModelV1Message type
      mode: { type: "regular" as const },
    };
    // Call doGenerate with the options object.
    const response = await model.doGenerate(options);
    // Ensure response.text is defined.
    if (!response.text) {
      throw new Error("No text returned from doGenerate");
    }
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Error extracting metadata:", err);
    return null;
  }
}
