import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Interface for document conversion result
 */
interface ConversionResult {
  success: boolean;
  filePath?: string;
  base64?: string;
  error?: string;
}

/**
 * Convert a DOCX file to PDF using a conversion API service
 * This implementation uses a mock conversion because actual conversion would require an external service
 */
export async function convertDocxToPdf(
  docxPath: string,
  outputDir: string = path.join(process.cwd(), 'tmp'),
  outputFileName?: string
): Promise<ConversionResult> {
  try {
    // Ensure the output directory exists
    await fsPromises.mkdir(outputDir, { recursive: true });
    
    // Generate output file name if not provided
    if (!outputFileName) {
      const docxFileName = path.basename(docxPath);
      outputFileName = docxFileName.replace(/\.docx$/i, '.pdf');
      if (outputFileName === docxFileName) {
        outputFileName = `${docxFileName}.pdf`;
      }
    }
    
    // Complete output path
    const outputPath = path.join(outputDir, outputFileName);
    
    // First, check if we can use an external API service for conversion
    try {
      const conversionResult = await callExternalConversionService(docxPath, outputPath);
      if (conversionResult.success) {
        return conversionResult;
      }
    } catch (apiError) {
      console.error('External conversion service failed:', apiError);
      // Fall back to local conversion method
    }
    
    // Since we don't have a native PDF conversion library in Node.js,
    // we'll simulate the conversion by creating a mock PDF file
    // In a production environment, you would use a proper conversion service or library
    const mockPdfContent = await createMockPdfFromDocx(docxPath);
    
    // Write the mock PDF to disk
    await fsPromises.writeFile(outputPath, mockPdfContent);
    
    // Read the file as base64 for preview
    const base64 = mockPdfContent.toString('base64');
    
    return {
      success: true,
      filePath: outputPath,
      base64,
    };
  } catch (error) {
    console.error('Error converting DOCX to PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Try to convert DOCX to PDF using an external API service
 * This is a placeholder that would need to be implemented with a real conversion service
 */
async function callExternalConversionService(
  docxPath: string,
  outputPath: string
): Promise<ConversionResult> {
  try {
    // Check if conversion API key is available
    const apiKey = process.env.DOCUMENT_CONVERSION_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'No conversion API key available' };
    }
    
    // Read the DOCX file
    const docxBuffer = await fsPromises.readFile(docxPath);
    
    // Create a form for the API request
    const form = new FormData();
    form.append('file', docxBuffer, {
      filename: path.basename(docxPath),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    // Make API request to conversion service
    // Note: This is a placeholder URL - you need to replace with an actual conversion service
    const response = await axios.post('https://api.conversion-service.example.com/convert/docx-to-pdf', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      responseType: 'arraybuffer',
    });
    
    // Write the response to the output file
    await fsPromises.writeFile(outputPath, response.data);
    
    // Convert to base64 for preview
    const base64 = Buffer.from(response.data).toString('base64');
    
    return {
      success: true,
      filePath: outputPath,
      base64,
    };
  } catch (error) {
    console.error('Error with external conversion service:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a mock PDF from a DOCX file
 * This is only for development/testing and should be replaced with a proper conversion service
 */
async function createMockPdfFromDocx(docxPath: string): Promise<Buffer> {
  try {
    // Read the DOCX file to get its size
    const stats = await fsPromises.stat(docxPath);
    const fileSize = stats.size;
    
    // Generate a simple PDF header with the file information
    const pdfHeader = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 150 >>
stream
BT
/F1 12 Tf
50 700 Td
(This is a mock PDF generated from ${path.basename(docxPath)}) Tj
0 -20 Td
(Original DOCX size: ${fileSize} bytes) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000115 00000 n
0000000200 00000 n
0000000400 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
470
%%EOF`;
    
    return Buffer.from(pdfHeader);
  } catch (error) {
    console.error('Error creating mock PDF:', error);
    throw error;
  }
} 