// lib/storage.ts
import fs from "fs/promises";
import fetch from "node-fetch"; // Ensure node-fetch is installed (npm install node-fetch)

// Simple in-memory cache for PDF bytes keyed by file path.
const pdfCache = new Map<string, Uint8Array>();

/**
 * Retrieves the original PDF bytes for a given CV record.
 * Assumes that cvRecord.filepath contains the URL or local file path to the PDF.
 *
 * @param cvRecord - The CV record object from the database.
 * @returns A Promise that resolves with the PDF bytes as a Uint8Array.
 */
export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  const filePath: string = cvRecord.filepath;
  if (!filePath) {
    throw new Error("PDF path not found in CV record");
  }

  // Return from cache if available.
  if (pdfCache.has(filePath)) {
    return pdfCache.get(filePath)!;
  }

  let pdfBytes: Uint8Array;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    // Download the PDF from the URL.
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`Failed to download PDF from URL: ${filePath}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    pdfBytes = new Uint8Array(arrayBuffer);
  } else {
    // Read from the local file system.
    pdfBytes = await fs.readFile(filePath);
  }

  pdfCache.set(filePath, pdfBytes);
  return pdfBytes;
}
