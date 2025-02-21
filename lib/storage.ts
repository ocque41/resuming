// lib/storage.ts
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch"; // Ensure you have installed node-fetch
import { NextApiRequest, NextApiResponse } from "next";

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

/**
 * Moves the uploaded file from a temporary location to a public directory.
 * @param tempPath - The temporary file path.
 * @param filename - The filename to use in the public directory.
 * @returns A Promise that resolves with the public URL of the moved file.
 */
export async function moveUploadedFile(tempPath: string, filename: string): Promise<string> {
  const publicFolder = path.join(process.cwd(), 'public', 'pdfs');
  // Ensure the public folder exists
  await fs.mkdir(publicFolder, { recursive: true });
  
  const newPath = path.join(publicFolder, filename);
  await fs.rename(tempPath, newPath);

  // Construct the public URL for the file
  const publicUrl = `https://next-js-saas-starter-three-resuming.vercel.app/pdfs/${filename}`;
  return publicUrl;
}

/**
 * Example handler for a file upload API route.
 * @param req - The Next.js API request.
 * @param res - The Next.js API response.
 */
export async function handleUpload(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // For demonstration, we simulate file upload values.
  const tempPath: string = '/tmp/uploads/1871be96c5aaafc4bc4639a00.pdf';
  const filename: string = 'CV Miguel Ocque.pdf'; // You may want to sanitize/normalize this name

  try {
    const publicUrl = await moveUploadedFile(tempPath, filename);
    // Now update your database record with publicUrl in the "filepath" column.
    res.status(200).json({ message: 'Upload successful', filepath: publicUrl });
  } catch (error) {
    console.error("File move error:", error);
    res.status(500).json({ error: "Failed to move uploaded file" });
  }
}
