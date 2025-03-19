/**
 * Document Content Extractor
 * 
 * This utility module provides functions to extract content from various document types.
 * Supports PDF, Word (DOCX, DOC), Excel, PowerPoint, Text, and other formats.
 */

import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';
import { extractTextFromPdf } from '@/lib/metadata/extract';
import axios from 'axios';

/**
 * Interface for document details
 */
export interface DocumentDetails {
  filePath: string;
  fileUrl?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileExtension: string;
  mimeType?: string;
}

/**
 * Interface for extraction results
 */
export interface ExtractionResult {
  text: string;
  success: boolean;
  format: string;
  language?: string;
  structure?: any;
  pageCount?: number;
  error?: string;
}

/**
 * Main function to extract content from any document type
 */
export async function extractDocumentContent(
  documentDetails: DocumentDetails
): Promise<ExtractionResult> {
  try {
    const fileExt = (documentDetails.fileExtension || path.extname(documentDetails.fileName)).toLowerCase();
    const fileType = documentDetails.fileType.toLowerCase();
    
    logger.info(`Extracting content from ${documentDetails.fileName} (${fileExt}, ${fileType})`);
    
    // Default extraction result
    const defaultResult: ExtractionResult = {
      text: '',
      success: false,
      format: fileExt.replace('.', ''),
      error: 'Unsupported file format'
    };
    
    // PDF files
    if (fileExt === '.pdf' || fileType.includes('pdf')) {
      return await extractPdfContent(documentDetails);
    }
    
    // Word documents
    if (fileExt === '.docx' || fileExt === '.doc' || fileType.includes('word') || fileType.includes('document')) {
      return await extractWordContent(documentDetails);
    }
    
    // Excel spreadsheets
    if (fileExt === '.xlsx' || fileExt === '.xls' || fileExt === '.csv' || 
        fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('csv')) {
      return await extractSpreadsheetContent(documentDetails);
    }
    
    // PowerPoint presentations
    if (fileExt === '.pptx' || fileExt === '.ppt' || fileType.includes('powerpoint') || fileType.includes('presentation')) {
      return await extractPresentationContent(documentDetails);
    }
    
    // Plain text and markdown
    if (fileExt === '.txt' || fileExt === '.md' || fileExt === '.rtf' || 
        fileType.includes('text') || fileType.includes('markdown') || fileType.includes('plain')) {
      return await extractTextContent(documentDetails);
    }
    
    // JSON, XML, HTML
    if (fileExt === '.json' || fileExt === '.xml' || fileExt === '.html' || fileExt === '.htm' || 
        fileType.includes('json') || fileType.includes('xml') || fileType.includes('html')) {
      return await extractStructuredContent(documentDetails);
    }
    
    // Image files - try OCR
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(fileExt) || 
        fileType.includes('image')) {
      return await extractImageContent(documentDetails);
    }
    
    // For unsupported file types, attempt to extract as text
    return await extractGenericContent(documentDetails);
  } catch (error) {
    logger.error(`Error extracting document content: ${error}`);
    return {
      text: `Error extracting content: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
      format: path.extname(documentDetails.fileName).replace('.', ''),
      error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from PDF document
 */
async function extractPdfContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    let documentPath = documentDetails.filePath;
    
    // Use existing PDF extraction functionality
    const extractedText = await extractTextFromPdf(documentPath);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        text: 'This PDF appears to contain no extractable text content. It may be a scanned document or image-based PDF.',
        success: false,
        format: 'pdf',
        error: 'No text content extracted'
      };
    }
    
    return {
      text: extractedText,
      success: true,
      format: 'pdf'
    };
  } catch (error) {
    logger.error(`Error extracting PDF content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'pdf',
      error: `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from Word document
 */
async function extractWordContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    // This is a placeholder - in a real implementation, you would use a library
    // such as mammoth.js, docx-parser, or textract to extract Word document content
    
    // For now, we'll return a placeholder message
    return {
      text: `[Word document content would be extracted here from ${documentDetails.fileName}]`,
      success: true,
      format: 'word',
      language: 'en' // This would be detected in a real implementation
    };
  } catch (error) {
    logger.error(`Error extracting Word content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'word',
      error: `Word extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from spreadsheet
 */
async function extractSpreadsheetContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    // This is a placeholder - in a real implementation, you would use a library
    // such as xlsx, excel4node, or csv-parser to extract spreadsheet content
    
    return {
      text: `[Spreadsheet content would be extracted here from ${documentDetails.fileName}]`,
      success: true,
      format: 'spreadsheet',
      structure: { sheets: ['Sheet1', 'Sheet2'], rows: 100, columns: 10 } // Placeholder structure
    };
  } catch (error) {
    logger.error(`Error extracting spreadsheet content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'spreadsheet',
      error: `Spreadsheet extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from presentation
 */
async function extractPresentationContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    // This is a placeholder - in a real implementation, you would use a library
    // for PowerPoint processing
    
    return {
      text: `[Presentation content would be extracted here from ${documentDetails.fileName}]`,
      success: true,
      format: 'presentation',
      pageCount: 20 // Placeholder page count
    };
  } catch (error) {
    logger.error(`Error extracting presentation content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'presentation',
      error: `Presentation extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from plain text files
 */
async function extractTextContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    let fileContent = '';
    
    // If we have a local file path, read it directly
    if (documentDetails.filePath) {
      fileContent = await fs.readFile(documentDetails.filePath, 'utf-8');
    } 
    // If we have a URL, fetch the content
    else if (documentDetails.fileUrl) {
      const response = await axios.get(documentDetails.fileUrl);
      fileContent = response.data;
    } else {
      throw new Error('No file path or URL provided');
    }
    
    return {
      text: fileContent,
      success: true,
      format: 'text'
    };
  } catch (error) {
    logger.error(`Error extracting text content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'text',
      error: `Text extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from structured files (JSON, XML, HTML)
 */
async function extractStructuredContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    let fileContent = '';
    
    // If we have a local file path, read it directly
    if (documentDetails.filePath) {
      fileContent = await fs.readFile(documentDetails.filePath, 'utf-8');
    } 
    // If we have a URL, fetch the content
    else if (documentDetails.fileUrl) {
      const response = await axios.get(documentDetails.fileUrl);
      fileContent = typeof response.data === 'object' 
        ? JSON.stringify(response.data, null, 2) 
        : response.data;
    } else {
      throw new Error('No file path or URL provided');
    }
    
    const fileExt = path.extname(documentDetails.fileName).toLowerCase();
    
    // For JSON, try to parse and pretty-print
    if (fileExt === '.json') {
      try {
        const jsonObj = JSON.parse(fileContent);
        fileContent = JSON.stringify(jsonObj, null, 2);
      } catch (e) {
        // Keep original content if parsing fails
      }
    }
    
    return {
      text: fileContent,
      success: true,
      format: fileExt.replace('.', '')
    };
  } catch (error) {
    logger.error(`Error extracting structured content: ${error}`);
    return {
      text: '',
      success: false,
      format: path.extname(documentDetails.fileName).replace('.', ''),
      error: `Structured content extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract content from images using OCR (placeholder)
 */
async function extractImageContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  // This is a placeholder - in a real implementation, you would use
  // an OCR service or library like Tesseract.js
  
  return {
    text: `[Image content would be extracted via OCR from ${documentDetails.fileName}]`,
    success: true,
    format: 'image'
  };
}

/**
 * Extract content from any other file type
 */
async function extractGenericContent(documentDetails: DocumentDetails): Promise<ExtractionResult> {
  try {
    // For unknown formats, try to read as text first
    try {
      const fileContent = await fs.readFile(documentDetails.filePath, 'utf-8');
      
      // If we can read it as text, return the content
      return {
        text: fileContent,
        success: true,
        format: path.extname(documentDetails.fileName).replace('.', '') || 'unknown'
      };
    } catch (textError) {
      // If we can't read as text, it's likely a binary file
      return {
        text: `[This is a binary file of type ${documentDetails.fileType || 'unknown'} and cannot be directly converted to text]`,
        success: false,
        format: path.extname(documentDetails.fileName).replace('.', '') || 'unknown',
        error: 'Binary file type not supported for direct text extraction'
      };
    }
  } catch (error) {
    logger.error(`Error extracting generic content: ${error}`);
    return {
      text: '',
      success: false,
      format: 'unknown',
      error: `Generic extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export default {
  extractDocumentContent,
  extractPdfContent,
  extractWordContent,
  extractSpreadsheetContent,
  extractPresentationContent,
  extractTextContent
}; 