import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';

export async function extractTextFromPDF(pdfBytes: Uint8Array): Promise<string> {
  try {
    // First try to extract text using pdf-parse
    try {
      const data = await pdfParse(Buffer.from(pdfBytes));
      const extractedText = data.text;
      
      if (extractedText && extractedText.trim().length > 0) {
        return extractedText;
      }
    } catch (parseError) {
      console.error("Error with primary text extraction:", parseError);
    }
    
    // If that fails, try to get text from our embedded metadata in the Subject field
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const subject = pdfDoc.getSubject();
      
      if (subject) {
        try {
          const metadata = JSON.parse(subject);
          if (metadata.fullText) {
            return metadata.fullText;
          }
        } catch (parseError) {
          console.error("Error parsing PDF metadata:", parseError);
        }
      }
    } catch (metadataError) {
      console.error("Error accessing PDF metadata:", metadataError);
    }
    
    // If all else fails, try a more aggressive text extraction approach
    // This is a simplified fallback that just returns any text we can find
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const title = pdfDoc.getTitle() || '';
      const author = pdfDoc.getAuthor() || '';
      const keywords = pdfDoc.getKeywords() || '';
      const subject = pdfDoc.getSubject() || '';
      
      const combinedText = [title, author, keywords, subject].filter(Boolean).join(' ');
      
      if (combinedText.trim().length > 0) {
        return combinedText;
      }
    } catch (fallbackError) {
      console.error("Error with fallback extraction:", fallbackError);
    }
    
    throw new Error("CV text content not found");
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

// Example alternative extraction method (implementation depends on your library)
async function alternativeExtractionMethod(pdfBytes: Uint8Array): Promise<string> {
  // This is just a placeholder - implement based on your PDF library
  // For example, if using pdf.js:
  // const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  // const pdf = await loadingTask.promise;
  // let text = '';
  // for (let i = 1; i <= pdf.numPages; i++) {
  //   const page = await pdf.getPage(i);
  //   const content = await page.getTextContent();
  //   text += content.items.map(item => item.str).join(' ');
  // }
  // return text;
  
  return ""; // Replace with actual implementation
} 