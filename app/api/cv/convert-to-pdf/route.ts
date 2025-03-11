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

/**
 * POST /api/cv/convert-to-pdf
 * Converts a DOCX file to PDF format
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const session = await getServerSession();
    if (!session?.user) {
      logger.warn("Unauthorized attempt to convert PDF");
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        success: false 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId, docxBase64, forceRefresh = false } = body;

    // Validate required parameters
    if (!cvId && !docxBase64) {
      logger.error("Missing required parameters: either cvId or docxBase64 must be provided");
      return new Response(JSON.stringify({ 
        error: "Missing required parameters: either cvId or docxBase64 must be provided", 
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the valid PDF base64 string
    let pdfBase64;

    // If docxBase64 is provided directly, convert it to PDF (simulated)
    if (docxBase64) {
      logger.info("Converting directly provided DOCX to PDF");
      pdfBase64 = await generatePDFFromDOCX(docxBase64);
    } 
    // Otherwise, fetch the CV record and use its DOCX data
    else {
      // Parse cvId to integer safely
      let cvIdNumber;
      try {
        cvIdNumber = parseInt(cvId);
        if (isNaN(cvIdNumber)) {
          throw new Error(`Invalid cvId: ${cvId} is not a number`);
        }
      } catch (parseError) {
        logger.error(`Error parsing cvId: ${cvId}`, parseError);
        return new Response(JSON.stringify({ 
          error: `Invalid cvId: ${cvId} is not a valid number`,
          success: false 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fetch CV record
      const cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });

      if (!cv) {
        logger.error(`CV not found: ${cvId}`);
        return new Response(JSON.stringify({ 
          error: "CV not found", 
          success: false 
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if we have metadata with docxBase64
      let metadata: CVMetadata = {};
      if (cv.metadata) {
        try {
          metadata = JSON.parse(cv.metadata) as CVMetadata;
        } catch (parseError) {
          logger.error(`Error parsing metadata for CV ${cvId}:`, parseError);
          return new Response(JSON.stringify({ 
            error: "Invalid metadata format", 
            success: false 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Check if we already have a PDF and aren't forcing a refresh
      if (!forceRefresh && metadata.pdfBase64) {
        logger.info(`Using existing PDF for CV ${cvId}`);
        return new Response(JSON.stringify({ 
          success: true, 
          pdfBase64: metadata.pdfBase64,
          message: "Using existing PDF"
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if we have a DOCX to convert
      if (!metadata.docxBase64) {
        logger.error(`No DOCX data found for CV ${cvId}`);
        return new Response(JSON.stringify({ 
          error: "No DOCX data found for this CV. Please generate a DOCX first.", 
          success: false 
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate PDF from DOCX
      logger.info(`Converting DOCX to PDF for CV ${cvId}`);
      pdfBase64 = await generatePDFFromDOCX(metadata.docxBase64);

      // Update metadata with PDF data
      metadata.pdfBase64 = pdfBase64;
      metadata.pdfGeneratedAt = new Date().toISOString();

      // Update CV record
      await db.update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, cvIdNumber));
    }

    // Return PDF data
    return new Response(JSON.stringify({ 
      success: true, 
      pdfBase64,
      message: "PDF conversion successful"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error converting to PDF:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to convert to PDF", 
      details: error instanceof Error ? error.message : "Unknown error",
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Generates a valid PDF base64 string from DOCX base64 data
 * This is a simulated conversion since we don't have access to actual conversion tools
 */
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

    // Determine the appropriate office command based on platform
    const officeCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';
    await execPromise(`${officeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`);
    // Wait for 5000ms to allow the PDF conversion to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if PDF was generated
    let pdfFilePath = tempPdfPath;
    if (!fs.existsSync(tempPdfPath)) {
      // If not found by expected name, try to locate any PDF in the temp directory
      const files = fs.readdirSync(tempDir);
      const pdfFile = files.find(file => file.endsWith('.pdf'));
      if (pdfFile) {
        pdfFilePath = path.join(tempDir, pdfFile);
      } else {
        throw new Error('PDF file not generated');
      }
    }

    // Read and encode the PDF file
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    // Verify that the PDF file starts with '%PDF-'
    const pdfHeader = pdfBuffer.slice(0, 5).toString('utf8');
    if (pdfHeader !== '%PDF-') {
      throw new Error('Generated file is not a valid PDF (invalid header)');
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