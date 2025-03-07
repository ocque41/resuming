import docxPdf from 'docx-pdf';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as util from 'util';

// Promisify docxPdf function
const docxToPdfPromise = (input: string, output: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    docxPdf(input, output, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Convert a DOCX buffer to PDF
 * 
 * This uses temporary files because the docx-pdf library requires file paths
 */
export async function convertDOCXToPDF(docxBuffer: Buffer): Promise<Buffer> {
  try {
    console.log("Starting DOCX to PDF conversion");
    
    // Create temporary file paths
    const tempDir = os.tmpdir();
    const tempDocxPath = path.join(tempDir, `cv_${Date.now()}.docx`);
    const tempPdfPath = path.join(tempDir, `cv_${Date.now()}.pdf`);
    
    // Write DOCX buffer to temporary file
    await fs.promises.writeFile(tempDocxPath, docxBuffer);
    console.log(`Temporary DOCX file created at ${tempDocxPath}`);
    
    try {
      // Convert DOCX to PDF using docx-pdf library
      await docxToPdfPromise(tempDocxPath, tempPdfPath);
      console.log(`PDF conversion completed, saved at ${tempPdfPath}`);
      
      // Read the generated PDF file
      const pdfBuffer = await fs.promises.readFile(tempPdfPath);
      console.log(`Read PDF buffer of size ${pdfBuffer.length} bytes`);
      
      // Clean up temporary files
      try {
        await fs.promises.unlink(tempDocxPath);
        await fs.promises.unlink(tempPdfPath);
        console.log("Temporary files cleaned up");
      } catch (cleanupError) {
        console.warn("Error cleaning up temporary files:", cleanupError);
      }
      
      return pdfBuffer;
    } catch (conversionError: unknown) {
      console.error("Error during DOCX to PDF conversion:", conversionError);
      
      // Clean up the temp DOCX file in case of error
      try {
        await fs.promises.unlink(tempDocxPath);
      } catch (unlinkError) {
        console.warn("Error cleaning up temporary DOCX file:", unlinkError);
      }
      
      const errorMessage = conversionError instanceof Error 
        ? conversionError.message 
        : String(conversionError);
      
      throw new Error(`DOCX to PDF conversion failed: ${errorMessage}`);
    }
  } catch (error: unknown) {
    console.error("Error in DOCX to PDF conversion:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    throw new Error(`Failed to convert DOCX to PDF: ${errorMessage}`);
  }
}

/**
 * Alternative implementation using Buffer directly
 * This is a fallback in case the file-based approach doesn't work
 */
export async function convertDOCXBufferToPDF(docxBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // docx-pdf doesn't have a buffer-to-buffer API, so this is a workaround
    const tempDir = os.tmpdir();
    const tempDocxPath = path.join(tempDir, `cv_${Date.now()}.docx`);
    const tempPdfPath = path.join(tempDir, `cv_${Date.now()}.pdf`);
    
    fs.writeFile(tempDocxPath, docxBuffer, (writeErr) => {
      if (writeErr) {
        return reject(new Error(`Error writing temp DOCX file: ${writeErr.message}`));
      }
      
      docxPdf(tempDocxPath, tempPdfPath, (convertErr: Error | null) => {
        if (convertErr) {
          // Clean up DOCX file
          fs.unlink(tempDocxPath, () => {});
          return reject(new Error(`Error converting DOCX to PDF: ${convertErr.message}`));
        }
        
        fs.readFile(tempPdfPath, (readErr, pdfBuffer) => {
          // Clean up both files regardless of success
          fs.unlink(tempDocxPath, () => {});
          fs.unlink(tempPdfPath, () => {});
          
          if (readErr) {
            return reject(new Error(`Error reading PDF file: ${readErr.message}`));
          }
          
          resolve(pdfBuffer);
        });
      });
    });
  });
} 