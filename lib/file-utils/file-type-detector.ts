/**
 * File type detection utilities for the document analyzer
 */

export type FileCategory = 'document' | 'spreadsheet' | 'presentation' | 'image' | 'cv' | 'other';

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
  
  // Images (for completeness)
  'jpg': {
    extension: 'jpg',
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
};

// Common CV/resume-related keywords to detect in filenames
const CV_KEYWORDS = [
  'cv', 'resume', 'curriculum', 'vitae', 
  'bio', 'profile', 'professional',
  'jobseeker', 'job-seeker', 'job_seeker',
  'career'
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
  if (!extension) return undefined;
  
  const fileType = FILE_TYPES[extension];
  if (!fileType) return undefined;
  
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
  
  return result;
}

/**
 * Checks if a file type is supported for analysis
 * @param fileType The file type to check
 * @returns Boolean indicating if the file type is supported
 */
export function isSupportedForAnalysis(fileType: FileTypeInfo | undefined): boolean {
  if (!fileType) return false;
  
  // Currently we support documents, spreadsheets, presentations, and CVs
  return ['document', 'spreadsheet', 'presentation', 'cv'].includes(fileType.category);
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