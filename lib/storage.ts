// lib/storage.ts
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch"; // Ensure node-fetch is installed

const pdfCache = new Map<string, Uint8Array>();

/**
 * Retrieves the original PDF bytes for a given CV record.
 * If the record’s filepath is missing or empty, falls back to a default PDF.
 *
 * @param cvRecord - The CV record object from the database.
 * @returns A Promise that resolves with the PDF bytes as a Uint8Array.
 */
export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let filePath: string = cvRecord.filepath;
  
  // Check if filePath is missing or empty
  if (!filePath || filePath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    // Set filePath to the default PDF URL
    filePath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
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
