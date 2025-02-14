import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse";
import fs from "fs/promises";

/**
 * Loads a PDF document using pdf-lib (for validation).
 */
export async function loadPdfWithPdfLib(filePath: string): Promise<PDFDocument> {
  const fileBuffer = await fs.readFile(filePath);
  return PDFDocument.load(fileBuffer);
}

/**
 * Extracts text from a PDF using pdf-parse.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  await loadPdfWithPdfLib(filePath); // Validate the file
  const fileBuffer = await fs.readFile(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

/**
 * Verifies the text likely represents a CV by checking for common keywords.
 */
export function isLikelyACV(text: string): boolean {
  const keywords = ["experience", "education", "skills", "contact"];
  return keywords.every(keyword => text.toLowerCase().includes(keyword));
}

/**
 * Extracts metadata from a CV PDF by calling OpenAI’s API directly.
 * Returns default metadata if any step fails.
 */
export async function extractMetadataDirect(filePath: string): Promise<any> {
  try {
    const text = await extractTextFromPdf(filePath);
    if (!text || text.trim() === "") {
      throw new Error("The extracted text is empty.");
    }
    if (!isLikelyACV(text)) {
      throw new Error("Uploaded file does not appear to be a valid CV.");
    }
    const prompt = `
You are an expert CV reviewer. Analyze the following CV text and extract the following details:
- "atsScore": A percentage score (e.g., "85%") indicating how well the CV is optimized for Applicant Tracking Systems.
- "optimized": "Yes" if the CV is optimized for ATS, otherwise "No".
- "sent": "Yes" if the CV has been sent to employers, otherwise "No".

Return the answer strictly in JSON format (do not include any extra text).

CV Text:
${text}
    `;
    console.log("extractMetadataDirect: Prompt (first 300 chars):", prompt.slice(0, 300));
    
    // Instead of using the Vercel AI SDK, use the direct fetch approach via analyzeCVWithAI:
    const metadata = await analyzeCVWithAI(prompt);
    return metadata;
  } catch (err) {
    console.error("Error in extractMetadataDirect:", err);
    return { atsScore: "N/A", optimized: "No", sent: "No" };
  }
}

// Import the direct analysis function dynamically so that it's only loaded at runtime.
async function analyzeCVWithAI(prompt: string): Promise<any> {
  const { analyzeCVWithAI } = await import("./analyze");
  return analyzeCVWithAI(prompt);
}
