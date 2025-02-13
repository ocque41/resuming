import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { openai } from "@ai-sdk/openai";

// Validate file using pdf-lib.
export async function loadPdfWithPdfLib(filePath: string): Promise<PDFDocument> {
  const fileBuffer = await fs.readFile(filePath);
  return PDFDocument.load(fileBuffer);
}

// Extract text using pdf-parse.
export async function extractTextFromPdf(filePath: string): Promise<string> {
  await loadPdfWithPdfLib(filePath); // Validate file.
  const fileBuffer = await fs.readFile(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

// Basic check for CV keywords.
export function isLikelyACV(text: string): boolean {
  const keywords = ["experience", "education", "skills", "contact"];
  return keywords.every(keyword => text.toLowerCase().includes(keyword));
}

// Asynchronously extract metadata from raw text via AI.
export async function extractMetadataFromText(text: string): Promise<any> {
  try {
    if (!text || text.trim() === "") {
      throw new Error("The provided text is empty.");
    }
    if (!isLikelyACV(text)) {
      throw new Error("The text does not appear to be a valid CV.");
    }
    const prompt = `
You are an expert CV reviewer. Analyze the following CV text and extract the following details:
- "atsScore": A percentage score (e.g., "85%") indicating how well the CV is optimized for Applicant Tracking Systems.
- "optimized": "Yes" if the CV is optimized for ATS, otherwise "No".
- "sent": "Yes" if the CV has been sent to employers, otherwise "No".

Return the answer strictly in JSON format.

CV Text:
${text}
    `;
    console.log("extractMetadataFromText: AI Prompt (first 300 chars):", prompt.slice(0, 300));
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
    console.log("extractMetadataFromText: AI Response (first 300 chars):", response.text?.slice(0, 300));
    if (!response.text) {
      throw new Error("No response from AI");
    }
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Error extracting metadata from text:", err);
    return { atsScore: "N/A", optimized: "No", sent: "No" };
  }
}
