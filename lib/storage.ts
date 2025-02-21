// lib/storage.ts
import fs from "fs/promises";
import fetch from "node-fetch"; // Ensure node-fetch is installed

const pdfCache = new Map<string, Uint8Array>();

export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  const filePath: string = cvRecord.filepath;
  console.log("DEBUG: cvRecord.filepath =", filePath);
  if (!filePath || filePath.trim() === "") {
    throw new Error("PDF path not found in CV record");
  }

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
