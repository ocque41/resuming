import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert DOCX buffer to PDF using a direct buffer-based approach
 * 
 * NOTE: This is a fallback implementation that doesn't actually convert to PDF
 * due to PhantomJS dependency issues. Instead, it returns the original DOCX buffer
 * and sets a metadata flag for on-demand conversion later.
 */
export async function convertDOCXToPDF(docxBuffer: Buffer): Promise<{ 
  pdfBuffer?: Buffer; 
  docxBuffer: Buffer;
  conversionSuccessful: boolean;
}> {
  try {
    console.log('Starting DOCX to PDF conversion (fallback mode)');
    
    // In this fallback implementation, we just return the DOCX buffer
    // along with metadata indicating that conversion should happen later
    return {
      docxBuffer,
      conversionSuccessful: false
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during DOCX to PDF conversion (fallback):', error);
    throw new Error(`Failed to convert DOCX to PDF: ${errorMessage}`);
  }
}

/**
 * Save DOCX buffer to temporary file
 * This can be used if we need to save the DOCX for manual conversion later
 */
export async function saveDOCXToTempFile(docxBuffer: Buffer): Promise<string> {
  try {
    const tempDir = os.tmpdir();
    const fileName = `cv_${Date.now()}.docx`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, docxBuffer);
    console.log(`Temporary DOCX file created at ${filePath}`);
    
    return filePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save DOCX to temporary file: ${errorMessage}`);
  }
}

/**
 * Generate a unique filename for a DOCX or PDF file
 */
export function generateUniqueFilename(originalFilename: string, extension: 'docx' | 'pdf'): string {
  const uuid = uuidv4().substring(0, 8);
  const baseName = path.basename(originalFilename, path.extname(originalFilename));
  return `${baseName}-optimized-${uuid}.${extension}`;
} 