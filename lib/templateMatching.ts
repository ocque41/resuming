import pdfParse from "pdf-parse";

/**
 * Extract text from PDF bytes using pdf-parse.
 * @param pdfBytes - The PDF file as a Uint8Array.
 * @returns A Promise that resolves with the extracted text.
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const buffer = Buffer.from(pdfBytes);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Identifies key section coordinates based on a simple template.
 * For example, if the text contains "Experience", we assume that section starts at y = 500.
 * @param extractedText - The full extracted text from the PDF.
 * @returns An object with coordinates if found, otherwise null.
 */
export function identifySectionCoordinates(extractedText: string): { experienceY: number } | null {
  if (extractedText.includes("Experience")) {
    // In this example, we assume the "Experience" section always starts at y = 500.
    return { experienceY: 500 };
  }
  return null;
}

/**
 * Combines text extraction and template matching to determine where to overlay content.
 * @param pdfBytes - The original PDF bytes.
 * @returns An object with overlay coordinates if the section is found; otherwise, null.
 */
export async function getOverlayCoordinates(pdfBytes: Uint8Array): Promise<{ experienceY: number } | null> {
  try {
    const text = await extractTextFromPdf(pdfBytes);
    return identifySectionCoordinates(text);
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return null;
  }
}
