// lib/storage.ts
import fs from "fs/promises";

// Simple in-memory cache for PDF bytes keyed by file path.
const pdfCache = new Map<string, Uint8Array>();

/**
 * Retrieves the original PDF bytes for a given CV record.
 * Assumes that cvRecord.pdfPath contains the file system path to the PDF.
 *
 * @param cvRecord - The CV record object from the database.
 * @returns A Promise that resolves with the PDF bytes as a Uint8Array.
 */
export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  const pdfPath = cvRecord.pdfPath;
  if (!pdfPath) {
    throw new Error("PDF path not found in CV record");
  }

  // Return from cache if available.
  if (pdfCache.has(pdfPath)) {
    return pdfCache.get(pdfPath)!;
  }

  // Read the PDF file from storage.
  const pdfBytes = await fs.readFile(pdfPath);
  // Cache the result.
  pdfCache.set(pdfPath, pdfBytes);
  return pdfBytes;
}
