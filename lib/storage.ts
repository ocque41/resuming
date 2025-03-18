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
 * Enhanced text extraction from PDF with better formatting and structure detection
 * This improved version attempts to preserve document structure and formatting
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  try {
    const buffer = Buffer.from(pdfBytes);
    const data = await pdfParse(buffer, {
      // Use more aggressive text extraction options
      pagerender: render_page
    });
    
    // Process the extracted text to improve structure
    const processedText = processExtractedText(data.text);
    
    return processedText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Custom page renderer for PDF.js to improve text extraction
 */
function render_page(pageData: any) {
  // Check if the page has content
  if (!pageData.getTextContent) {
    return null;
  }
  
  return pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false
  })
  .then(function(textContent: any) {
    let lastY = -1;
    let text = '';
    
    // Process each text item
    for (const item of textContent.items) {
      // Check if this is a new line based on Y position
      if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 5) {
        text += '\n';
      }
      
      // Add the text content
      text += item.str;
      
      // Update the last Y position
      lastY = item.transform[5];
    }
    
    return text;
  });
}

/**
 * Process extracted text to improve structure and formatting
 */
function processExtractedText(text: string): string {
  // Remove excessive whitespace
  let processed = text.replace(/\s+/g, ' ');
  
  // Detect and preserve paragraphs
  processed = processed.replace(/\.\s+([A-Z])/g, '.\n\n$1');
  
  // Detect and preserve bullet points
  processed = processed.replace(/•\s*/g, '\n• ');
  processed = processed.replace(/\*\s*/g, '\n* ');
  processed = processed.replace(/(\d+)\.\s+([A-Z])/g, '\n$1. $2');
  
  // Detect and preserve section headings
  processed = processed.replace(/([A-Z][A-Z\s]{2,}:)/g, '\n\n$1\n');
  
  // Detect contact information patterns
  processed = processed.replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '\nEmail: $1\n');
  processed = processed.replace(/(\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4})/g, '\nPhone: $1\n');
  processed = processed.replace(/(https?:\/\/[^\s]+)/g, '\nWebsite: $1\n');
  
  // Clean up multiple newlines
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  // Ensure the text starts with a clean line
  processed = processed.trim();
  
  return processed;
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

/**
 * Saves a file buffer to Dropbox
 * @param dbx - The Dropbox client instance
 * @param dropboxPath - The path where the file should be stored in Dropbox
 * @param buffer - The file buffer to upload
 * @returns A Promise that resolves when the file is saved
 */
export async function saveFileToDropbox(
  dbx: any,
  dropboxPath: string, 
  buffer: Buffer
): Promise<void> {
  try {
    await dbx.filesUpload({
      path: dropboxPath,
      contents: buffer,
      mode: { ".tag": "overwrite" }
    });
    
    console.log(`File saved to Dropbox at: ${dropboxPath}`);
  } catch (error: any) {
    if (error.status === 401) {
      console.error("Access token expired, refreshing token...");
      await updateDropboxAccessToken();
      const refreshedDbx = getDropboxClient();
      return await saveFileToDropbox(refreshedDbx, dropboxPath, buffer);
    }
    console.error(`Error saving file to Dropbox: ${error.message || error}`);
    throw new Error(`Failed to save file to Dropbox: ${error.message || error}`);
  }
}

// Re-export the Dropbox client getter to make it accessible
export { getDropboxClient } from "./dropboxAdmin";
