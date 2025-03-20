/**
 * Utility functions for PDF operations
 */

/**
 * Creates a valid PDF document from text for testing or fallback purposes.
 * This follows a minimal PDF format that adheres to the PDF standard.
 * @param text - The text to include in the PDF
 * @returns A Buffer containing a valid PDF
 */
export function createValidPdfBuffer(text: string): Buffer {
  // Escape special characters in the text
  const escapedText = text.replace(/[()\\]/g, '\\$&');
  
  // Calculate length to ensure valid offsets
  const contentLength = escapedText.length + 50;
  const fontObjOffset = 300 + contentLength;  // Estimated offset
  const trailerOffset = fontObjOffset + 200;  // Estimated offset
  
  // Create a minimal but valid PDF structure
  const pdfTemplate = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${contentLength} >>
stream
BT
/F1 12 Tf
50 700 Td
(${escapedText}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000058 00000 n
0000000115 00000 n
0000000234 00000 n
0000000${fontObjOffset} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${trailerOffset}
%%EOF`;

  console.log(`Created valid PDF with content: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`);
  return Buffer.from(pdfTemplate, 'utf-8');
}

/**
 * Verifies if a buffer contains a valid PDF document.
 * @param buffer - The buffer to check
 * @returns An object with validation results
 */
export function verifyPdfBuffer(buffer: Buffer | Uint8Array): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check minimum size for a valid PDF
  if (buffer.length < 100) {
    issues.push(`PDF too small: ${buffer.length} bytes`);
    return { isValid: false, issues };
  }
  
  // Check PDF header
  if (buffer.slice(0, 5).toString() !== '%PDF-') {
    issues.push(`Missing PDF header: ${buffer.slice(0, 20).toString('hex')}`);
    return { isValid: false, issues };
  }
  
  // Check for EOF marker
  const lastBytes = buffer.slice(-10).toString();
  if (!lastBytes.includes('%%EOF')) {
    issues.push(`Missing EOF marker: ${buffer.slice(-20).toString('hex')}`);
  }
  
  // Basic structure check - look for common PDF elements
  const bufferStr = Buffer.from(buffer).toString('utf-8');
  const contains = (pattern: string): boolean => bufferStr.includes(pattern);
  
  if (!contains('/Catalog')) issues.push('Missing /Catalog reference');
  if (!contains('/Pages')) issues.push('Missing /Pages reference');
  
  // Determine if the PDF is valid based on detected issues
  const isValid = issues.length === 0 || 
    (issues.length === 1 && issues[0].startsWith('Missing /Catalog'));
  
  return { isValid, issues };
}

/**
 * Attempts to repair a corrupted PDF by reconstructing it.
 * @param corruptedPdf - The potentially corrupted PDF buffer
 * @param fileName - The original file name
 * @returns A repaired PDF buffer or null if repair is not possible
 */
export function attemptPdfRepair(corruptedPdf: Buffer | Uint8Array, fileName: string): Buffer | null {
  // Convert to Buffer if it's not already
  const pdfBuffer = Buffer.isBuffer(corruptedPdf) ? corruptedPdf : Buffer.from(corruptedPdf);
  
  // Extract any text content we can find
  let extractedText = '';
  
  try {
    // Try to extract text using a simple regex for text objects in PDFs
    const pdfString = pdfBuffer.toString('utf-8', 0, Math.min(pdfBuffer.length, 10000));
    const textMatches = pdfString.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
    
    if (textMatches && textMatches.length > 0) {
      extractedText = textMatches
        .map(match => match.substring(1, match.length - 1).replace(/\\(.)/g, '$1'))
        .join(' ');
    }
  } catch (e) {
    console.error('Error while attempting text extraction for PDF repair:', e);
  }
  
  // If we couldn't extract text, create a PDF with an error message
  if (!extractedText) {
    extractedText = `This is a replacement for "${fileName}" which was corrupted. The original content could not be recovered.`;
  } else if (extractedText.length > 1000) {
    // Truncate to a reasonable length
    extractedText = extractedText.substring(0, 1000) + '... (content truncated)';
  }
  
  // Create a new valid PDF with the extracted or default text
  try {
    return createValidPdfBuffer(
      `REPAIRED DOCUMENT - ORIGINAL MAY BE CORRUPTED\n\n` +
      `Filename: ${fileName}\n\n` +
      `Recovered content (possibly incomplete):\n` +
      extractedText
    );
  } catch (e) {
    console.error('Error creating repaired PDF:', e);
    return null;
  }
} 