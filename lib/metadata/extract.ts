// lib/metadata/extractMetadata.ts
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import { openai } from "ai";

/**
 * Extract text from a PDF file.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extract metadata from a CV PDF using the Vercel AI SDK.
 * The prompt asks the LLM to extract an ATS Score, whether the CV is optimized, and whether it has been sent.
 */
export async function extractMetadata(filePath: string): Promise<any> {
  try {
    const text = await extractTextFromPdf(filePath);
    const prompt = `
Given the following CV text, extract the following information:
- ATS Score (as a percentage, e.g. "85%")
- Whether the CV is optimized (Yes or No)
- Whether the CV has been sent (Yes or No)
Return the answer in JSON format with keys "atsScore", "optimized", "sent".

CV Text:
${text}
    `;
    const chat = openai("gpt-4o");
    const response = await chat.generate(prompt);
    return JSON.parse(response);
  } catch (err) {
    console.error("Error extracting metadata:", err);
    return null;
  }
}
