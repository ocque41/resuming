// lib/pdf/modify.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";

/**
 * Modifies the PDF by overlaying the optimized content.
 * @param originalPdfPath The path to the original PDF file.
 * @param optimizedContent The optimized content text to overlay onto the PDF.
 * @param outputPdfPath The path where the modified PDF will be saved.
 */
export async function modifyPdf(
  originalPdfPath: string,
  optimizedContent: string,
  outputPdfPath: string
): Promise<void> {
  // Read the original PDF file.
  const existingPdfBytes = await fs.readFile(originalPdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // Get the first page (or adjust to target the appropriate page).
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Embed the Helvetica font.
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = firstPage.getSize();

  // Draw the optimized content on the first page.
  // Adjust the x, y coordinates and styling as necessary.
  firstPage.drawText(optimizedContent, {
    x: 50,
    y: height / 2,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });

  // Save the modified PDF bytes.
  const modifiedPdfBytes = await pdfDoc.save();

  // Write the modified PDF to the specified output path.
  await fs.writeFile(outputPdfPath, modifiedPdfBytes);
}
