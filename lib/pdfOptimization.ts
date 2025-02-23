import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { getOverlayCoordinates } from "./templateMatching";

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testLineWidth > maxWidth && currentLine !== "") {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function modifyPDFWithOptimizedContent(
  originalPdfBytes: Uint8Array,
  optimizedText: string
): Promise<string> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const coordinates = await getOverlayCoordinates(originalPdfBytes);

  let pageToModify;
  if (coordinates) {
    pageToModify = pdfDoc.getPage(0);
  } else {
    const { width, height } = pdfDoc.getPage(0).getSize();
    pageToModify = pdfDoc.addPage([width, height]);
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = pageToModify.getSize();
  const margin = 50;
  const fontSize = 12;
  const lineHeight = fontSize * 1.2;
  const maxWidth = width - margin * 2;
  let startY = coordinates ? coordinates.experienceY : height - margin;

  if (coordinates) {
    pageToModify.drawRectangle({
      x: margin,
      y: startY - 200,
      width: maxWidth,
      height: 200,
      color: rgb(1, 1, 1),
    });
  }

  const lines = wrapText(optimizedText, helveticaFont, fontSize, maxWidth);
  let currentPage = pageToModify;
  let currentY = startY;

  for (const line of lines) {
    if (currentY - lineHeight < margin) {
      currentPage = pdfDoc.addPage([width, height]);
      currentY = height - margin;
    }
    currentPage.drawText(line, {
      x: margin,
      y: currentY,
      size: fontSize,
      font: helveticaFont,
      color: rgb(0, 0, 0),
      maxWidth,
    });
    currentY -= lineHeight;
  }

  const modifiedPdfBytes = await pdfDoc.save();
  const base64String = Buffer.from(modifiedPdfBytes).toString("base64");
  return base64String;
}
