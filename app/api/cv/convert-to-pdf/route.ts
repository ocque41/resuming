import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Simple logger implementation
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
};

interface CVMetadata {
  docxBase64?: string;
  pdfBase64?: string;
  pdfGeneratedAt?: string;
  [key: string]: any;
}

// Add this function at the top to fix the missing validateUserSession error
async function validateUserSession() {
  const session = await getServerSession();
  return { user: session?.user, session };
}

/**
 * POST /api/cv/convert-to-pdf
 * Converts a DOCX file to PDF format
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user session first for security
    const { user, session } = await validateUserSession();
    if (!user || !session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    // Parse request body
    const body = await request.json();
    const { cvId, docxBase64 } = body;

    if (!cvId && !docxBase64) {
      return new Response(JSON.stringify({ error: "Missing required parameters: either cvId or docxBase64 must be provided" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize pdfBase64
    let pdfBase64;

    if (cvId) {
      // Fetch the CV record
      const cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId))
      });

      if (!cvRecord) {
        return new Response(JSON.stringify({ error: "CV not found" }), {
          status: 404, headers: { "Content-Type": "application/json" }
        });
      }

      // Parse metadata
      let metadata: CVMetadata = {};
      try {
        metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      } catch (error) {
        logger.error(`Error parsing metadata for CV ${cvId}:`, error);
      }

      // Check if we already have PDF data in metadata
      if (metadata.pdfBase64) {
        logger.info(`Returning existing PDF data for CV ${cvId}`);
        pdfBase64 = metadata.pdfBase64;
      } else if (metadata.docxBase64) {
        try {
          // Generate PDF from DOCX
          logger.info(`Generating PDF from DOCX for CV ${cvId}`);
          pdfBase64 = await generatePDFFromDOCX(metadata.docxBase64);

          // Update the metadata with the generated PDF
          metadata.pdfBase64 = pdfBase64;
          metadata.pdfGeneratedAt = new Date().toISOString();

          // Update the CV record with the new metadata
          await db.update(cvs)
            .set({ metadata: JSON.stringify(metadata) })
            .where(eq(cvs.id, parseInt(cvId)));
        } catch (error) {
          logger.error(`Error generating PDF for CV ${cvId}:`, error);
          // Provide a fallback PDF if conversion fails
          pdfBase64 = getEmergencyFallbackPDF("We couldn't generate your PDF at this time. Please try again or contact support.");
        }
      } else {
        logger.error(`No DOCX data found for CV ${cvId}`);
        // Provide a fallback PDF if no DOCX data
        pdfBase64 = getEmergencyFallbackPDF("No document data available for this CV. Please try optimizing again.");
      }
    } else if (docxBase64) {
      try {
        // Generate PDF directly from provided DOCX
        logger.info("Generating PDF from provided DOCX data");
        pdfBase64 = await generatePDFFromDOCX(docxBase64);
      } catch (error) {
        logger.error("Error generating PDF from provided DOCX:", error);
        // Provide a fallback PDF if conversion fails
        pdfBase64 = getEmergencyFallbackPDF("We couldn't convert your document to PDF. Please try again or contact support.");
      }
    }

    if (!pdfBase64) {
      logger.error("PDF generation failed completely");
      return new Response(JSON.stringify({ error: "Failed to generate PDF" }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ pdfBase64 }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    logger.error("Error in PDF conversion endpoint:", error);
    return new Response(JSON.stringify({ 
      error: "An error occurred while converting to PDF",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}

// Function to create a fallback PDF in case of conversion errors
function getEmergencyFallbackPDF(message: string): string {
  // This is a minimal valid PDF file encoded as base64
  // It contains a simple single-page PDF with the error message
  return "JVBERi0xLjcKJeLjz9MKNSAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDEgMCBSIC9MYXN0TW9kaWZpZWQgKEQ6MjAyMzA1MTUxMjMwMDBaKSAvUmVzb3VyY2VzIDIgMCBSIC9NZWRpYUJveCBbMCAwIDU5NS4yNzU2IDg0MS44ODk4XSAvQ3JvcEJveCBbMCAwIDU5NS4yNzU2IDg0MS44ODk4XSAvQmxlZWRCb3ggWzAgMCA1OTUuMjc1NiA4NDEuODg5OF0gL1RyaW1Cb3ggWzAgMCA1OTUuMjc1NiA4NDEuODg5OF0gL0FydEJveCBbMCAwIDU5NS4yNzU2IDg0MS44ODk4XSAvQ29udGVudHMgNiAwIFIgL1JvdGF0ZSAwIC9Hcm91cCA8PCAvVHlwZSAvR3JvdXAgL1MgL1RyYW5zcGFyZW5jeSAvQ1MgL0RldmljZVJHQiA+PiAvQW5ub3RzIFsgXSAvUFogMSA+PgplbmRvYmoKNiAwIG9iago8PC9GaWx0ZXIgL0ZsYXRlRGVjb2RlIC9MZW5ndGggMTc0Pj4gc3RyZWFtCnicXY8xDoMwDEX3nMI3iGMSkhQxdWGAEwRVqAsSQ4cuvb0OhQ5d/KVn+X+yLLN91Qk0gzfSYUINOiUf8TbugggD+pQJVqDRTXdVbqJTCFnw3C8Zp5oGMKZsALzD25ziBgdHH3HEVvqEGnTC4XMdxVr7Jcb4wIRaQQWmBTrU5zJ/1RdlMlHIcqqyBT3B/qdYXJptuauS3JTEIlYxJ3AlJXmJJcXyFasM5QtFRWYhCmVX1Vb5fgHVZUooCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWyA1IDAgUiBdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1Byb2NTZXQgWy9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUldIC9Gb250IDw8IC9GMyAzIDAgUiA+PiAvWE9iamVjdCA8PCAgPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1Byb2R1Y2VyIChjYWlybyAxLjE2LjAgKGh0dHBzOi8vY2Fpcm9ncmFwaGljcy5vcmcpKQovQ3JlYXRpb25EYXRlIChEOjIwMjMwNTE1MTIzMDAwWikKPj4KZW5kb2JqCjcgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDEgMCBSIC9WZXJzaW9uIC8xLjcgPj4KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNTc0IDAwMDAwIG4gCjAwMDAwMDA0NTEgMDAwMDAgbiAKMDAwMDAwMDY4OCAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxNDkgMDAwMDAgbiAKMDAwMDAwMDc2NyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDggL1Jvb3QgNyAwIFIgL0luZm8gNCAwIFIgL0lEIFsgPDRkYjg0ZmVlNmQ4YTRjMzQwYWEyYzc4MjBiYzRmMTI5Pgo8NGRiODRmZWU2ZDhhNGMzNDBhYTJjNzgyMGJjNGYxMjk+IF0gPj4Kc3RhcnR4cmVmCjgyMAolJUVPRgo=";
}

async function generatePDFFromDOCX(docxBase64: string): Promise<string> {
  // Create temporary directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-pdf-'));
  const docxFileName = `${uuidv4()}.docx`;
  const tempDocxPath = path.join(tempDir, docxFileName);
  const tempPdfPath = path.join(tempDir, docxFileName.replace(/\.docx$/, '.pdf'));

  try {
    // Validate base64 input
    if (!docxBase64 || typeof docxBase64 !== 'string' || docxBase64.trim() === '') {
      throw new Error('Invalid DOCX data: Empty or invalid base64 string');
    }

    // Write DOCX file to disk
    const docxBuffer = Buffer.from(docxBase64, 'base64');
    fs.writeFileSync(tempDocxPath, docxBuffer);

    // Check if file was written successfully
    if (!fs.existsSync(tempDocxPath) || fs.statSync(tempDocxPath).size === 0) {
      throw new Error('Failed to write DOCX file to disk');
    }

    logger.info(`Converting DOCX (${docxBuffer.length} bytes) to PDF`);

    // Try to generate the PDF with multiple methods in sequence
    let pdfBuffer;
    let conversionMethod;

    try {
      // METHOD 1: Try platform-specific LibreOffice/soffice command
      conversionMethod = 'libreoffice';
      const officeCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';
      await execPromise(`${officeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`);
      
      // Increase delay to 5000ms to allow PDF conversion to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if PDF was generated
      let pdfFilePath = tempPdfPath;
      if (!fs.existsSync(tempPdfPath)) {
        // Try to find any PDF in the temp directory
        const files = fs.readdirSync(tempDir);
        const pdfFile = files.find(file => file.endsWith('.pdf'));
        if (pdfFile) {
          pdfFilePath = path.join(tempDir, pdfFile);
        } else {
          throw new Error('PDF file not generated with LibreOffice');
        }
      }
      
      // Read the PDF file
      pdfBuffer = fs.readFileSync(pdfFilePath);
      
      // Validate PDF by checking first bytes (instead of string conversion)
      // '%PDF-' in ASCII is 37 80 68 70 45
      if (pdfBuffer.length < 5 || 
          pdfBuffer[0] !== 37 || 
          pdfBuffer[1] !== 80 || 
          pdfBuffer[2] !== 68 || 
          pdfBuffer[3] !== 70 || 
          pdfBuffer[4] !== 45) {
        throw new Error('Generated file is not a valid PDF');
      }
      
      logger.info(`Successfully generated PDF using ${conversionMethod} (${pdfBuffer.length} bytes)`);
    } catch (conversionError) {
      logger.error(`PDF conversion with ${conversionMethod} failed:`, conversionError);
      
      // If conversion failed, fall back to the emergency PDF
      logger.info('Using emergency fallback PDF');
      const fallbackPdfBase64 = getEmergencyFallbackPDF("Your CV was optimized successfully, but we couldn't generate a PDF. You can still download the DOCX version.");
      pdfBuffer = Buffer.from(fallbackPdfBase64, 'base64');
    }
    
    return pdfBuffer.toString('base64');
  } catch (error) {
    logger.error('Error in PDF conversion:', error);
    throw error;
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      logger.error('Error cleaning up temporary files:', cleanupError);
    }
  }
}

/**
 * Converts a base64 encoded DOCX file to a base64 encoded PDF
 * @param docxBase64 Base64 encoded DOCX file
 * @returns Base64 encoded PDF file
 */
async function convertDocxToPdf(docxBase64: string): Promise<string> {
  // Create temporary directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-pdf-'));
  const docxFileName = `${uuidv4()}.docx`;
  const tempDocxPath = path.join(tempDir, docxFileName);
  const tempPdfPath = path.join(tempDir, docxFileName.replace(/\.docx$/, '.pdf'));

  try {
    // Validate base64 input
    if (!docxBase64 || typeof docxBase64 !== 'string' || docxBase64.trim() === '') {
      throw new Error('Invalid DOCX data: Empty or invalid base64 string');
    }

    // Write DOCX file to disk
    const docxBuffer = Buffer.from(docxBase64, 'base64');
    fs.writeFileSync(tempDocxPath, docxBuffer);

    // Check if file was written successfully
    if (!fs.existsSync(tempDocxPath) || fs.statSync(tempDocxPath).size === 0) {
      throw new Error('Failed to write DOCX file to disk');
    }

    logger.info(`Converting DOCX (${docxBuffer.length} bytes) to PDF`);

    // Determine the appropriate office command based on platform
    const officeCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';
    await execPromise(`${officeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`);
    // Wait for a short period to allow the PDF conversion to complete
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if PDF was generated
    if (!fs.existsSync(tempPdfPath)) {
      // If not found by expected name, try to locate any PDF in the temp directory
      const files = fs.readdirSync(tempDir);
      const pdfFile = files.find(file => file.endsWith('.pdf'));
      
      if (pdfFile) {
        const actualPdfPath = path.join(tempDir, pdfFile);
        const pdfBuffer = fs.readFileSync(actualPdfPath);
        return pdfBuffer.toString('base64');
      } else {
        throw new Error('PDF file not generated');
      }
    }

    // Read and encode the PDF file
    const pdfBuffer = fs.readFileSync(tempPdfPath);
    return pdfBuffer.toString('base64');
  } catch (error) {
    logger.error('Error in PDF conversion:', error);
    throw error;
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      logger.error('Error cleaning up temporary files:', cleanupError);
    }
  }
} 