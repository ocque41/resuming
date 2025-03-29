/**
 * Dropbox to S3 Migration Utility
 * 
 * This utility provides functions to migrate files from Dropbox to S3.
 * It can be used to migrate all files or specific files by CV ID.
 */

import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { retrieveFile, saveFile, FileType } from "@/lib/fileStorage";
import { getDropboxClient } from "@/lib/dropboxAdmin";
import { logger } from "@/lib/logger";

interface MigrationResult {
  id: number;
  fileName: string;
  oldPath: string;
  newPath: string;
  success: boolean;
  error?: string;
}

/**
 * Migrates a single CV's file from Dropbox to S3
 * 
 * @param cvId - The ID of the CV to migrate
 * @returns The migration result
 */
export async function migrateFileToS3(cvId: number): Promise<MigrationResult> {
  try {
    // Get the CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });

    if (!cvRecord) {
      return {
        id: cvId,
        fileName: 'unknown',
        oldPath: 'unknown',
        newPath: '',
        success: false,
        error: 'CV record not found'
      };
    }

    // Skip if not a Dropbox path
    if (!cvRecord.filepath.startsWith('/')) {
      return {
        id: cvId,
        fileName: cvRecord.fileName,
        oldPath: cvRecord.filepath,
        newPath: cvRecord.filepath,
        success: true,
        error: 'Already migrated or not a Dropbox file'
      };
    }

    // Parse metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Determine file type
    let fileType: FileType = 'pdf';
    if (cvRecord.filepath.includes('/docx/')) {
      fileType = 'docx';
    } else if (cvRecord.filepath.includes('/txt/')) {
      fileType = 'txt';
    }

    // Retrieve the file from Dropbox
    logger.info(`Retrieving file from Dropbox: ${cvRecord.filepath}`);
    const fileBuffer = await retrieveFile(cvRecord.filepath, 'dropbox');

    // Save to S3
    logger.info(`Uploading file to S3: ${cvRecord.fileName}`);
    const fileMetadata = await saveFile(
      fileBuffer,
      cvRecord.fileName,
      fileType,
      's3'
    );

    // Update the CV record
    metadata.storageType = 's3';
    metadata.originalDropboxPath = cvRecord.filepath; // Keep the original path for reference
    const newMetadata = JSON.stringify(metadata);

    await db.update(cvs)
      .set({
        filepath: fileMetadata.filePath,
        metadata: newMetadata
      })
      .where(eq(cvs.id, cvId));

    return {
      id: cvId,
      fileName: cvRecord.fileName,
      oldPath: cvRecord.filepath,
      newPath: fileMetadata.filePath,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error migrating file to S3: ${errorMessage}`);
    
    return {
      id: cvId,
      fileName: 'unknown',
      oldPath: 'unknown',
      newPath: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Migrates all CV files from Dropbox to S3
 * 
 * @param limit - Optional limit on the number of files to migrate
 * @returns Array of migration results
 */
export async function migrateAllFilesToS3(limit?: number): Promise<MigrationResult[]> {
  try {
    // Get all CV records with Dropbox paths
    const allCvs = await db.query.cvs.findMany({
      where: eq(cvs.userId, eq(cvs.userId, cvs.userId)) // This is a dummy condition to get all records
    });

    // Filter for Dropbox files only
    const dropboxCvs = allCvs.filter(cv => cv.filepath && cv.filepath.startsWith('/'));
    
    logger.info(`Found ${dropboxCvs.length} files to migrate from Dropbox to S3`);
    
    const results: MigrationResult[] = [];
    const filesToMigrate = limit ? dropboxCvs.slice(0, limit) : dropboxCvs;

    // Migrate each file
    for (const cv of filesToMigrate) {
      logger.info(`Migrating file: ${cv.fileName} (ID: ${cv.id})`);
      const result = await migrateFileToS3(cv.id);
      results.push(result);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error during migration: ${errorMessage}`);
    throw error;
  }
}

/**
 * Checks if a CV file is stored in Dropbox
 * 
 * @param cvId - The ID of the CV to check
 * @returns True if the file is in Dropbox, false otherwise
 */
export async function isFileInDropbox(cvId: number): Promise<boolean> {
  try {
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });

    if (!cvRecord || !cvRecord.filepath) {
      return false;
    }

    return cvRecord.filepath.startsWith('/');
  } catch (error) {
    logger.error(`Error checking if file is in Dropbox: ${error}`);
    return false;
  }
}

/**
 * Gets statistics about storage usage
 * 
 * @returns Object containing counts of files in different storage types
 */
export async function getStorageStats(): Promise<{ total: number, dropbox: number, s3: number, other: number }> {
  try {
    const allCvs = await db.query.cvs.findMany();
    
    const dropbox = allCvs.filter(cv => cv.filepath && cv.filepath.startsWith('/')).length;
    const s3 = allCvs.filter(cv => {
      const metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
      return metadata.storageType === 's3' || 
             (cv.filepath && !cv.filepath.startsWith('/') && 
              (cv.filepath.startsWith('pdfs/') || 
               cv.filepath.startsWith('docx/') || 
               cv.filepath.startsWith('txt/')));
    }).length;
    
    return {
      total: allCvs.length,
      dropbox,
      s3,
      other: allCvs.length - dropbox - s3
    };
  } catch (error) {
    logger.error(`Error getting storage stats: ${error}`);
    return { total: 0, dropbox: 0, s3: 0, other: 0 };
  }
} 