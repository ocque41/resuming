// lib/pdfConversion.ts
import { PDFDocument } from "pdf-lib";

/**
 * Serializes the modified PDF document and converts it to a Base64 string.
 * This Base64 string can be embedded in an <iframe> or used to create a Blob URL on the frontend.
 *
 * @param pdfDoc - The modified PDFDocument after overlaying the optimized content.
 * @returns A Promise that resolves with the Base64-encoded string of the modified PDF.
 */
export async function serializePdfToBase64(pdfDoc: PDFDocument): Promise<string> {
  // Save the PDFDocument to bytes.
  const modifiedPdfBytes = await pdfDoc.save();
  // Convert the PDF bytes to a Base64-encoded string.
  const base64String = Buffer.from(modifiedPdfBytes).toString("base64");
  return base64String;
}
