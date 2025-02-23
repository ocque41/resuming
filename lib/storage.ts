// lib/storage.ts
import fs from "fs/promises";
import path from "path";
import crossFetch from "cross-fetch";

const pdfCache = new Map<string, Uint8Array>();

// Ensure global fetch is defined.
if (!globalThis.fetch) {
  globalThis.fetch = crossFetch;
}

export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let filePath: string = cvRecord.filepath; // Ensure your database column is "filepath" (all lowercase)
  
  // If the filePath is missing or empty, fall back to a default PDF.
  if (!filePath || filePath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    filePath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
  }
  
  // Check cache
  if (pdfCache.has(filePath)) {
    return pdfCache.get(filePath)!;
  }

  let pdfBytes: Uint8Array;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    // Download from URL.
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

export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const buffer = Buffer.from(pdfBytes);
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}
