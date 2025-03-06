import fs from "fs/promises";
import path from "path";
import crossFetch from "cross-fetch";
import { getDropboxClient, updateDropboxAccessToken } from "./dropboxAdmin";
import pdfParse from "pdf-parse";

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
  throw new Error(`Failed to download PDF from URL: ${url}`); // Should not reach here.
}

/**
 * Retrieves the original PDF bytes for a given CV record.
 * If the record's filepath is missing, uses a default PDF.
 * If the filepath is a Dropbox path (e.g., "/pdfs/filename.pdf"),
 * obtains a fresh temporary link via Dropbox API before downloading.
 *
 * @param cvRecord - The CV record object from the database.
 * @returns A Promise that resolves with the PDF bytes as a Uint8Array.
 */
export async function getOriginalPdfBytes(cvRecord: any): Promise<Uint8Array> {
  let storedPath: string = cvRecord.filepath;
  
  // If storedPath is missing or empty, fall back to a default PDF.
  if (!storedPath || storedPath.trim() === "") {
    console.warn("No valid PDF path found for CV record", cvRecord.id, "- using default PDF.");
    storedPath = "https://next-js-saas-starter-three-resuming.vercel.app/pdfs/default.pdf";
  }
  
  // If storedPath is a Dropbox path (starts with "/pdfs/"), get a fresh temporary link.
  let fileUrl: string;
  if (storedPath.startsWith("/pdfs/")) {
    const dbx = getDropboxClient();
    try {
      const tempLinkResult = await dbx.filesGetTemporaryLink({ path: storedPath });
      fileUrl = tempLinkResult.result.link;
      console.log("Fresh temporary link obtained:", fileUrl);
    } catch (err) {
      console.error("Error getting temporary link for Dropbox file:", err);
      throw new Error(`Failed to get temporary link for Dropbox file at path: ${storedPath}`);
    }
  } else {
    fileUrl = storedPath;
  }
  
  // Do not cache Dropbox temporary links.
  if (!fileUrl.startsWith("http") || !fileUrl.includes("dl.dropboxusercontent.com")) {
    if (pdfCache.has(fileUrl)) {
      return pdfCache.get(fileUrl)!;
    }
  }
  
  let response;
  try {
    response = await fetchWithRetry(fileUrl, 1);
  } catch (err) {
    console.error("Error fetching PDF from URL:", err);
    throw new Error(`Failed to download PDF from URL: ${fileUrl}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  // Cache non-Dropbox URLs if desired.
  if (!fileUrl.includes("dl.dropboxusercontent.com")) {
    pdfCache.set(fileUrl, pdfBytes);
  }
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

/**
 * Uploads a buffer to Dropbox and returns the path.
 * @param buffer - The file buffer to upload
 * @param dropboxPath - The path where the file should be stored in Dropbox
 * @returns A Promise that resolves with the Dropbox path
 */
export async function uploadBufferToStorage(buffer: Buffer, dropboxPath: string): Promise<string> {
  const dbx = getDropboxClient();

  try {
    await dbx.filesUpload({
      path: dropboxPath,
      contents: buffer,
      mode: { ".tag": "overwrite" }
    });
    
    return dropboxPath;
  } catch (error: any) {
    if (error.status === 401) {
      console.error("Access token expired, refreshing token...");
      await updateDropboxAccessToken();
      return await uploadBufferToStorage(buffer, dropboxPath);
    }
    throw error;
  }
}
