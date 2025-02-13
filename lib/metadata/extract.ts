// lib/metadata/extract.ts
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
  // Validate the file is accessible.
  await loadPdfWithPdfLib(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

/**
 * Checks if the text likely represents a CV by verifying presence of common keywords.
 */
export function isLikelyACV(text: string): boolean {
  const keywords = ["experience", "education", "skills", "contact"];
  return keywords.every(keyword => text.toLowerCase().includes(keyword));
}

/**
 * Extracts metadata from a CV PDF by calling OpenAI’s API directly.
 * If any step fails, returns default metadata.
 */
export async function extractMetadataDirect(filePath: string): Promise<any> {
  try {
    // Step 1: Extract text from the PDF.
    const text = await extractTextFromPdf(filePath);
    if (!text || text.trim() === "") {
      throw new Error("The extracted text is empty.");
    }
    // Step 2: Verify the document appears to be a CV.
    if (!isLikelyACV(text)) {
      throw new Error("Uploaded file does not appear to be a valid CV.");
    }
    // Step 3: Build the prompt.
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
    
    // Step 4: Call OpenAI's API directly using fetch.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not defined");
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4", // or "gpt-4-0314" or another variant as needed
        messages: [{
          role: "user",
          content: prompt
        }],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("extractMetadataDirect: API Response:", data);
    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error("No content returned from OpenAI API.");
    }
    
    return JSON.parse(messageContent);
  } catch (err) {
    console.error("Error in extractMetadataDirect:", err);
    // Return default metadata if extraction fails.
    return {
      atsScore: "N/A",
      optimized: "No",
      sent: "No"
    };
  }
}
