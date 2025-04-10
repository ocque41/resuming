/**
 * File type detection utilities for the document analyzer
 */

export type FileCategory = 'document' | 'spreadsheet' | 'presentation' | 'image' | 'cv' | 'scientific' | 'other';

export interface FileTypeInfo {
  extension: string;
  mimeType: string;
  category: FileCategory;
  name: string;
}

// Map of supported file extensions to their MIME types and categories
export const FILE_TYPES: Record<string, FileTypeInfo> = {
  // Documents
  'pdf': {
    extension: 'pdf',
    mimeType: 'application/pdf',
    category: 'document',
    name: 'PDF Document'
  },
  'doc': {
    extension: 'doc',
    mimeType: 'application/msword',
    category: 'document',
    name: 'Word Document'
  },
  'docx': {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    name: 'Word Document'
  },
  'txt': {
    extension: 'txt',
    mimeType: 'text/plain',
    category: 'document',
    name: 'Text Document'
  },
  'rtf': {
    extension: 'rtf',
    mimeType: 'application/rtf',
    category: 'document',
    name: 'Rich Text Document'
  },
  'odt': { // OpenDocument Text
    extension: 'odt',
    mimeType: 'application/vnd.oasis.opendocument.text',
    category: 'document',
    name: 'OpenDocument Text'
  },
  
  // Spreadsheets
  'xlsx': {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'spreadsheet',
    name: 'Excel Spreadsheet'
  },
  'xls': {
    extension: 'xls',
    mimeType: 'application/vnd.ms-excel',
    category: 'spreadsheet',
    name: 'Excel Spreadsheet'
  },
  'csv': {
    extension: 'csv',
    mimeType: 'text/csv',
    category: 'spreadsheet',
    name: 'CSV Spreadsheet'
  },
  'ods': { // OpenDocument Spreadsheet
    extension: 'ods',
    mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
    category: 'spreadsheet',
    name: 'OpenDocument Spreadsheet'
  },
  'tsv': {
    extension: 'tsv',
    mimeType: 'text/tab-separated-values',
    category: 'spreadsheet',
    name: 'Tab-Separated Values'
  },
  
  // Presentations
  'pptx': {
    extension: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    category: 'presentation',
    name: 'PowerPoint Presentation'
  },
  'ppt': {
    extension: 'ppt',
    mimeType: 'application/vnd.ms-powerpoint',
    category: 'presentation',
    name: 'PowerPoint Presentation'
  },
  'odp': { // OpenDocument Presentation
    extension: 'odp',
    mimeType: 'application/vnd.oasis.opendocument.presentation',
    category: 'presentation',
    name: 'OpenDocument Presentation'
  },
  'key': { // Apple Keynote
    extension: 'key',
    mimeType: 'application/vnd.apple.keynote',
    category: 'presentation',
    name: 'Apple Keynote Presentation'
  },
  
  // Additional document formats
  'md': {
    extension: 'md',
    mimeType: 'text/markdown',
    category: 'document',
    name: 'Markdown Document'
  },
  'html': {
    extension: 'html',
    mimeType: 'text/html',
    category: 'document',
    name: 'HTML Document'
  },
  'htm': {
    extension: 'htm',
    mimeType: 'text/html',
    category: 'document',
    name: 'HTML Document'
  },
  'json': {
    extension: 'json',
    mimeType: 'application/json',
    category: 'document',
    name: 'JSON Document'
  },
  'xml': {
    extension: 'xml',
    mimeType: 'application/xml',
    category: 'document',
    name: 'XML Document'
  },
  
  // Images (for completeness)
  'jpg': {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    category: 'image',
    name: 'JPEG Image'
  },
  'jpeg': {
    extension: 'jpeg',
    mimeType: 'image/jpeg',
    category: 'image',
    name: 'JPEG Image'
  },
  'png': {
    extension: 'png',
    mimeType: 'image/png',
    category: 'image',
    name: 'PNG Image'
  },
  'gif': {
    extension: 'gif',
    mimeType: 'image/gif',
    category: 'image',
    name: 'GIF Image'
  },
};

// Common CV/resume-related keywords to detect in filenames
const CV_KEYWORDS = [
  'cv', 'resume', 'curriculum', 'vitae', 
  'bio', 'profile', 'professional',
  'jobseeker', 'job-seeker', 'job_seeker',
  'career'
];

// Common scientific paper-related keywords to detect in filenames
const SCIENTIFIC_KEYWORDS = [
  'research', 'paper', 'study', 'article', 
  'journal', 'thesis', 'dissertation',
  'conference', 'proceedings', 'publication',
  'scientific', 'academic', 'analysis',
  'experiment', 'findings', 'methodology'
];

/**
 * Detects the file type based on filename or MIME type
 * @param fileName The name of the file
 * @param mimeType Optional MIME type if known
 * @returns FileTypeInfo object or undefined if type not recognized
 */
export function detectFileType(fileName: string, mimeType?: string): FileTypeInfo | undefined {
  // First try to match by MIME type if provided
  if (mimeType) {
    const matchByMime = Object.values(FILE_TYPES).find(type => type.mimeType === mimeType);
    if (matchByMime) return matchByMime;
  }
  
  // Then try to match by file extension
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) {
    // If no extension found, attempt to provide a generic "document" type
    console.log(`No file extension found for: ${fileName}, defaulting to generic document`);
    return {
      extension: 'txt',
      mimeType: 'text/plain',
      category: 'document',
      name: 'Generic Document'
    };
  }
  
  const fileType = FILE_TYPES[extension];
  if (!fileType) {
    // If extension not recognized, also provide a generic "document" type
    console.log(`Unknown file extension: ${extension}, defaulting to generic document`);
    return {
      extension: extension,
      mimeType: 'application/octet-stream',
      category: 'document',
      name: 'Unknown Document Type'
    };
  }
  
  // Create a copy of the file type that we can modify
  const result = { ...fileType };
  
  // Check if this is likely a CV based on the filename
  const lowerFileName = fileName.toLowerCase();
  
  // If any CV-related keywords are found in the filename, categorize as a CV
  const isCVByName = CV_KEYWORDS.some(keyword => 
    lowerFileName.includes(keyword)
  );
  
  if (isCVByName && (fileType.category === 'document')) {
    // It's a document with CV-related keywords, so categorize as CV
    result.category = 'cv';
    result.name = 'CV / Resume';
  }
  
  // Check if this is likely a scientific paper based on the filename
  const isScientificByName = SCIENTIFIC_KEYWORDS.some(keyword => 
    lowerFileName.includes(keyword)
  );
  
  if (isScientificByName && (fileType.category === 'document')) {
    // It's a document with scientific-related keywords, so categorize as scientific
    result.category = 'scientific';
    result.name = 'Scientific Paper / Research Article';
  }
  
  return result;
}

/**
 * Checks if a file type is supported for analysis
 * @param fileType The file type to check
 * @returns Boolean indicating if the file type is supported
 */
export function isSupportedForAnalysis(fileType: FileTypeInfo | undefined): boolean {
  if (!fileType) return false;
  
  // Currently we support documents, spreadsheets, presentations, CVs, and scientific papers
  // We'll be more permissive to ensure better user experience
  return ['document', 'spreadsheet', 'presentation', 'cv', 'scientific'].includes(fileType.category);
}

/**
 * Get an appropriate analysis type based on file category
 * @param fileType The file type information
 * @returns String identifier for the type of analysis to perform
 */
export function getAnalysisTypeForFile(fileType: FileTypeInfo | undefined): string {
  if (!fileType) return 'general';
  
  switch (fileType.category) {
    case 'cv':
      return 'cv';
    case 'document':
      return 'document';
    case 'spreadsheet':
      return 'spreadsheet';
    case 'presentation':
      return 'presentation';
    case 'scientific':
      return 'scientific';
    default:
      return 'general';
  }
}

/**
 * Checks if a file is a PDF based on its file extension
 * @param fileName The name of the file to check
 * @returns Boolean indicating if the file is a PDF
 */
export function isPdfFile(fileName: string): boolean {
  // Get the file extension
  const extension = fileName.split('.').pop()?.toLowerCase();
  // Check if the extension is 'pdf'
  return extension === 'pdf';
}

/**
 * Gets a fallback mime type for files that don't have one
 * @param fileName The name of the file
 * @returns A best-guess MIME type string
 */
export function getFallbackMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return 'application/octet-stream';
  
  const fileType = FILE_TYPES[extension];
  return fileType?.mimeType || 'application/octet-stream';
} 