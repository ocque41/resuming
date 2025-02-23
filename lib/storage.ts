import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch"; // Using cross-fetch is recommended if issues persist

const pdfCache = new Map<string, Uint8Array>();

export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let filePath: string = cvRecord.filepath;
  
  if (!filePath || filePath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    filePath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
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

export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const buffer = Buffer.from(pdfBytes);
  const data = await (await import("pdf-parse")).default(buffer);
  return data.text;
}
