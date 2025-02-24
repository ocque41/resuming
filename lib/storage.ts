import fs from "fs/promises";
import path from "path";
import crossFetch from "cross-fetch";
import { getDropboxClient } from "./dropboxAdmin";
import pdfParse from 'pdf-parse';

const pdfCache = new Map<string, Uint8Array>();

// Helper function: fetch with a single retry.
async function fetchWithRetry(url: string, retries = 1): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await crossFetch(url);
    if (res.ok) {
      return res;
    }
    if (i < retries) {
      console.warn(`Fetch failed for URL: ${url}. Retrying (${i + 1}/${retries})...`);
    } else {
      const text = await res.text();
      console.error(`Failed to fetch URL after ${retries + 1} attempts. Status: ${res.status} - ${res.statusText}. Response: ${text}`);
      throw new Error(`Failed to download PDF from URL: ${url}`);
    }
  }
  throw new Error(`Failed to download PDF from URL: ${url}`); // Fallback (should not reach here)
}

/**
 * Retrieves the original PDF bytes for a given CV record.
 * If the record's filepath is missing, uses a default PDF.
 * If the filepath is a Dropbox path (e.g., "/pdfs/filename.pdf"),
 * generates a fresh temporary link via Dropbox API before downloading.
 *
 * @param cvRecord - The CV record object from the database.
 * @returns A Promise that resolves with the PDF bytes as a Uint8Array.
 */
export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let filePath: string = cvRecord.filepath;
  
  // If filePath is missing or empty, fall back to a default PDF.
  if (!filePath || filePath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    filePath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
  }
  
  // If filePath is a Dropbox path (e.g., starts with "/pdfs/"), obtain a fresh temporary link.
  if (filePath.startsWith("/pdfs/")) {
    const dbx = getDropboxClient();
    try {
      const tempLinkResult = await dbx.filesGetTemporaryLink({ path: filePath });
      filePath = tempLinkResult.result.link;
      console.log("Fresh temporary link obtained:", filePath);
    } catch (err) {
      console.error("Error getting temporary link for Dropbox file:", err);
      throw new Error(`Failed to get temporary link for Dropbox file at path: ${filePath}`);
    }
  }
  
  // Return from cache if available.
  if (pdfCache.has(filePath)) {
    return pdfCache.get(filePath)!;
  }
  
  // Use fetch with retry to download the PDF.
  let response;
  try {
    response = await fetchWithRetry(filePath, 1);
  } catch (err) {
    console.error("Error fetching PDF from URL:", err);
    throw new Error(`Failed to download PDF from URL: ${filePath}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  pdfCache.set(filePath, pdfBytes);
  return pdfBytes;
}

/**
 * Extracts text from PDF bytes using pdf-parse.
 * @param pdfBytes - The PDF file as a Uint8Array.
 * @returns A Promise that resolves with the extracted text.
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const buffer = Buffer.from(pdfBytes);
  const data = await pdfParse(buffer);
  return data.text;
}
