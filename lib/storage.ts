// lib/storage.ts
import fs from "fs/promises";
import fetch from "cross-fetch";
import { getDropboxClient } from "./dropboxAdmin";

const pdfCache = new Map<string, Uint8Array>();

export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let filePath: string = cvRecord.filepath;
  
  // If the stored filePath is missing or empty, fall back to a default PDF.
  if (!filePath || filePath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    filePath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
  }
  
  // If filePath is a Dropbox path (e.g., starts with "/pdfs/"), get a temporary link.
  if (filePath.startsWith("/pdfs/")) {
    const dbx = getDropboxClient();
    const tempLinkResult = await dbx.filesGetTemporaryLink({ path: filePath });
    filePath = tempLinkResult.result.link; // This link is fresh and valid.
  }
  
  // Check cache.
  if (pdfCache.has(filePath)) {
    return pdfCache.get(filePath)!;
  }

  let pdfBytes: Uint8Array;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`Failed to download PDF from URL: ${filePath}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    pdfBytes = new Uint8Array(arrayBuffer);
  } else {
    pdfBytes = await fs.readFile(filePath);
  }
  
  pdfCache.set(filePath, pdfBytes);
  return pdfBytes;
}
