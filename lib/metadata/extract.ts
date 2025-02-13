// lib/metadata/extract.ts
import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { openai } from "@ai-sdk/openai";

/**
 * Loads a PDF document using pdf-lib. This serves as a check to ensure the file is valid.
 */
export async function loadPdfWithPdfLib(filePath: string): Promise<PDFDocument> {
  const fileBuffer = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  return pdfDoc;
}

/**
 * Extracts text from a PDF file using pdf-parse.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  // Validate file exists using pdf-lib.
  await loadPdfWithPdfLib(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

/**
 * Verifies if the extracted text likely represents a CV by checking for common keywords.
 */
export function isLikelyACV(text: string): boolean {
  const keywords = ["experience", "education", "skills", "contact"];
  const lowerText = text.toLowerCase();
  return keywords.every(keyword => lowerText.includes(keyword));
}

/**
 * Extracts metadata from a CV PDF.
 * - Loads the PDF (via pdf-lib) to validate the file.
 * - Extracts text (via pdf-parse) and verifies that it contains typical CV keywords.
 * - Builds a prompt and calls an AI model to extract metadata.
 * - Returns default metadata if any step fails.
 */
export async function extractMetadata(filePath: string): Promise<any> {
  try {
    // Step 1: Validate the file by loading it with pdf-lib.
    await loadPdfWithPdfLib(filePath);
    
    // Step 2: Extract text from the PDF.
    const text = await extractTextFromPdf(filePath);
    if (!text || text.trim() === "") {
      throw new Error("The extracted text is empty.");
    }
    
    // Step 3: Verify the document appears to be a CV.
    if (!isLikelyACV(text)) {
      throw new Error("Uploaded file does not appear to be a valid CV.");
    }
    
    // Step 4: Build the prompt for the AI model.
    const prompt = `
You are an expert CV reviewer. Analyze the following CV text and extract the following details:
- "atsScore": A percentage score (e.g., "85%") indicating how well the CV is optimized for Applicant Tracking Systems.
- "optimized": "Yes" if the CV is optimized for ATS, otherwise "No".
- "sent": "Yes" if the CV has been sent to employers, otherwise "No".

Return the answer strictly in JSON format (do not include any extra text).

CV Text:
${text}
    `;
    console.log("extractMetadata: AI Prompt (first 300 chars):", prompt.slice(0, 300));
    
    // Step 5: Call the AI model.
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
    console.log("extractMetadata: AI Response text (first 300 chars):", response.text?.slice(0, 300));
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
