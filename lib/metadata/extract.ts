// lib/metadata/extract.ts
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { openai } from "@ai-sdk/openai";

/**
 * Extracts text from a PDF file.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    console.log("extractTextFromPdf: accessing file at", filePath);
    await fs.access(filePath);
  } catch (err) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  console.log("extractTextFromPdf: extracted text (first 200 chars):", data.text.slice(0, 200));
  return data.text;
}

/**
 * Checks if the extracted text likely represents a CV,
 * by ensuring it contains expected keywords.
 */
export function isLikelyACV(text: string): boolean {
  const keywords = ["experience", "education", "skills", "contact"];
  const lowerText = text.toLowerCase();
  return keywords.every(keyword => lowerText.includes(keyword));
}

/**
 * Extracts metadata from a CV PDF using the AI model.
 * If extraction fails, returns default metadata.
 */
export async function extractMetadata(filePath: string): Promise<any> {
  try {
    // Step 1: Extract full text from the PDF.
    const text = await extractTextFromPdf(filePath);
    if (!text || text.trim() === "") {
      throw new Error("The extracted text is empty.");
    }

    // Step 2: Verify that the document appears to be a CV.
    if (!isLikelyACV(text)) {
      throw new Error("Uploaded file does not appear to be a valid CV.");
    }

    // Step 3: Build the prompt for the AI model.
    const prompt = `
You are an expert CV reviewer. Analyze the following CV text and extract the following details:
- "atsScore": A percentage score (e.g., "85%") indicating how well the CV is optimized for Applicant Tracking Systems.
- "optimized": "Yes" if the CV is optimized for ATS, otherwise "No".
- "sent": "Yes" if the CV has been sent to employers, otherwise "No".

Return the answer strictly in JSON format (do not include any extra text).

CV Text:
${text}
    `;
    console.log("extractMetadata: AI Prompt:", prompt.slice(0, 300)); // log first 300 characters

    // Step 4: Call the AI model.
    const model = openai("gpt-4o");
    const toolMessage = {
      role: "tool" as const,
      content: [
        {
          text: prompt,
          type: "tool-result" as const,
          toolCallId: "cvMetadataCall",
          toolName: "cvMetadataExtractor",
          result: ""
        }
      ]
    };

    const options = {
      inputFormat: "prompt" as const,
      prompt: [toolMessage],
      mode: { type: "regular" as const },
    };

    const response = await model.doGenerate(options);
    console.log("extractMetadata: AI Response text:", response.text?.slice(0, 300));
    if (!response.text) {
      throw new Error("No text returned from doGenerate");
    }
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Error extracting metadata:", err);
    // Return default metadata if extraction fails.
    return {
      atsScore: "N/A",
      optimized: "No",
      sent: "No"
    };
  }
}
