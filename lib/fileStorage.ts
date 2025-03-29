import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { getDropboxClient } from './dropboxAdmin';
import { uploadFileToS3, getFileFromS3, deleteFileFromS3, getSignedS3Url } from './s3Storage';
import { logger } from './logger';

/**
 * File Storage Service
 * 
 * This service provides a unified interface for storing and retrieving files,
 * with support for local file system, Dropbox, and S3 storage.
 */

// Define storage types
export type StorageType = 'local' | 'dropbox' | 's3';

// Define file types
export type FileType = 'pdf' | 'docx' | 'txt';

// Define file metadata
export interface FileMetadata {
  id: string;
  fileName: string;
  filePath: string;
  fileType: FileType;
  fileSize: number;
  storageType: StorageType;
  createdAt: string;
  url?: string;
}

/**
 * Save a file to storage
 * 
 * @param buffer - The file buffer to save
 * @param fileName - The name of the file
 * @param fileType - The type of the file
 * @param storageType - The type of storage to use
 * @returns A Promise that resolves with the file metadata
 */
export async function saveFile(
  buffer: Buffer,
  fileName: string,
  fileType: FileType,
  storageType: StorageType = 'local'
): Promise<FileMetadata> {
  try {
    const id = uuidv4();
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFileName(fileName);
    const fileNameWithTimestamp = `${sanitizedFileName}-${timestamp}`;
    
    // Add the appropriate extension if not already present
    const extension = fileType === 'pdf' ? '.pdf' : fileType === 'docx' ? '.docx' : '.txt';
    const fullFileName = fileNameWithTimestamp.endsWith(extension) 
      ? fileNameWithTimestamp 
      : `${fileNameWithTimestamp}${extension}`;
    
    let filePath: string;
    let url: string | undefined;
    
    if (storageType === 'dropbox') {
      // Save to Dropbox
      filePath = await saveToDropbox(buffer, fullFileName, fileType);
      url = await getDropboxTemporaryLink(filePath);
    } else if (storageType === 's3') {
      // Save to S3
      const basePath = fileType === 'pdf' ? 'pdfs' : fileType === 'docx' ? 'docx' : 'txt';
      const s3Path = `${basePath}/${fullFileName}`;
      filePath = await uploadFileToS3(buffer, s3Path);
      url = await getSignedS3Url(filePath);
    } else {
      // Save to local file system
      filePath = await saveToLocalFileSystem(buffer, fullFileName);
    }
    
    // Create and return file metadata
    const metadata: FileMetadata = {
      id,
      fileName: fullFileName,
      filePath,
      fileType,
      fileSize: buffer.length,
      storageType,
      createdAt: new Date().toISOString(),
      url
    };
    
    return metadata;
  } catch (error) {
    logger.error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieve a file from storage
 * 
 * @param filePath - The path of the file to retrieve
 * @param storageType - The type of storage where the file is stored
 * @returns A Promise that resolves with the file buffer
 */
export async function retrieveFile(
  filePath: string,
  storageType: StorageType = 'local'
): Promise<Buffer> {
  try {
    if (storageType === 'dropbox') {
      // Retrieve from Dropbox
      return await retrieveFromDropbox(filePath);
    } else if (storageType === 's3') {
      // Retrieve from S3
      return await getFileFromS3(filePath);
    } else {
      // Retrieve from local file system
      return await retrieveFromLocalFileSystem(filePath);
    }
  } catch (error) {
    logger.error(`Failed to retrieve file: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to retrieve file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a file from storage
 * 
 * @param filePath - The path of the file to delete
 * @param storageType - The type of storage where the file is stored
 * @returns A Promise that resolves with a boolean indicating success
 */
export async function deleteFile(
  filePath: string,
  storageType: StorageType = 'local'
): Promise<boolean> {
  try {
    if (storageType === 'dropbox') {
      // Delete from Dropbox
      return await deleteFromDropbox(filePath);
    } else if (storageType === 's3') {
      // Delete from S3
      return await deleteFileFromS3(filePath);
    } else {
      // Delete from local file system
      return await deleteFromLocalFileSystem(filePath);
    }
  } catch (error) {
    logger.error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a temporary URL for a file
 * 
 * @param filePath - The path of the file
 * @param storageType - The type of storage where the file is stored
 * @returns A Promise that resolves with the temporary URL
 */
export async function getFileUrl(
  filePath: string,
  storageType: StorageType = 'local'
): Promise<string> {
  try {
    if (storageType === 'dropbox') {
      // Get a temporary link from Dropbox
      return await getDropboxTemporaryLink(filePath);
    } else if (storageType === 's3') {
      // Get a signed URL from S3
      return await getSignedS3Url(filePath);
    } else {
      // For local files, we can't provide a URL
      throw new Error('URL generation not supported for local files');
    }
  } catch (error) {
    logger.error(`Failed to get file URL: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to get file URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

/**
 * Save a file to the local file system
 */
async function saveToLocalFileSystem(buffer: Buffer, fileName: string): Promise<string> {
  try {
    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'cv-optimizer');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (mkdirError) {
      console.warn('Error creating temp directory:', mkdirError);
      // Continue anyway, the directory might already exist
    }
    
    // Create the file path
    const filePath = path.join(tempDir, fileName);
    
    // Write the file
    await fs.writeFile(filePath, buffer);
    
    console.log(`File saved to local file system: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error saving to local file system:', error);
    throw error;
  }
}

/**
 * Retrieve a file from the local file system
 */
async function retrieveFromLocalFileSystem(filePath: string): Promise<Buffer> {
  try {
    // Read the file
    const buffer = await fs.readFile(filePath);
    
    console.log(`File retrieved from local file system: ${filePath}`);
    return buffer;
  } catch (error) {
    console.error('Error retrieving from local file system:', error);
    throw error;
  }
}

/**
 * Delete a file from the local file system
 */
async function deleteFromLocalFileSystem(filePath: string): Promise<boolean> {
  try {
    // Delete the file
    await fs.unlink(filePath);
    
    console.log(`File deleted from local file system: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error deleting from local file system:', error);
    throw error;
  }
}

/**
 * Save a file to Dropbox
 */
async function saveToDropbox(buffer: Buffer, fileName: string, fileType: FileType): Promise<string> {
  try {
    // Get the Dropbox client
    const dbx = getDropboxClient();
    
    // Determine the appropriate path based on file type
    const basePath = fileType === 'pdf' ? '/pdfs' : fileType === 'docx' ? '/docx' : '/txt';
    const filePath = `${basePath}/${fileName}`;
    
    // Upload the file
    const result = await dbx.filesUpload({
      path: filePath,
      contents: buffer,
      mode: { '.tag': 'overwrite' }
    });
    
    // Access the path_display property safely
    const pathDisplay = result.result?.path_display || filePath;
    console.log(`File saved to Dropbox: ${pathDisplay}`);
    
    return pathDisplay;
  } catch (error) {
    console.error('Error saving to Dropbox:', error);
    throw error;
  }
}

/**
 * Retrieve a file from Dropbox
 */
async function retrieveFromDropbox(filePath: string): Promise<Buffer> {
  try {
    // Get the Dropbox client
    const dbx = getDropboxClient();
    
    // Download the file
    const result = await dbx.filesDownload({ path: filePath });
    
    // Convert the file content to a buffer
    // Note: The actual property might be different based on the Dropbox SDK version
    // This is a workaround for type issues
    const fileData = result.result as any;
    if (!fileData || !fileData.fileBinary) {
      throw new Error('File binary data not available in Dropbox response');
    }
    
    const buffer = Buffer.from(fileData.fileBinary);
    
    console.log(`File retrieved from Dropbox: ${filePath}`);
    return buffer;
  } catch (error) {
    console.error('Error retrieving from Dropbox:', error);
    throw error;
  }
}

/**
 * Delete a file from Dropbox
 */
async function deleteFromDropbox(filePath: string): Promise<boolean> {
  try {
    // Get the Dropbox client
    const dbx = getDropboxClient();
    
    // Delete the file
    await dbx.filesDelete({ path: filePath });
    
    console.log(`File deleted from Dropbox: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error deleting from Dropbox:', error);
    throw error;
  }
}

/**
 * Get a temporary link for a Dropbox file
 */
async function getDropboxTemporaryLink(filePath: string): Promise<string> {
  try {
    // Get the Dropbox client
    const dbx = getDropboxClient();
    
    // Get a temporary link
    const result = await dbx.filesGetTemporaryLink({ path: filePath });
    
    // Access the link property safely
    const link = result.result?.link;
    if (!link) {
      throw new Error('Temporary link not available in Dropbox response');
    }
    
    console.log(`Temporary link generated for Dropbox file: ${filePath}`);
    return link;
  } catch (error) {
    console.error('Error getting temporary link from Dropbox:', error);
    throw error;
  }
}

/**
 * Sanitize a file name to ensure it's valid
 */
function sanitizeFileName(fileName: string): string {
  // Remove invalid characters
  let sanitized = fileName.replace(/[<>:"/\\|?*]/g, '_');
  
  // Ensure the file name is not too long
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  return sanitized;
}