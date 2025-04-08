import { db } from '@/lib/db/drizzle';
import { cvs, users, documentAnalyses } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { getCachedFilePath, getCachedFile } from '@/lib/utils/cvCache';

/**
 * Get a CV by its ID and verify the user owns it
 */
export async function getCVById(id: number, userId: number) {
  try {
    const cv = await db.query.cvs.findFirst({
      where: and(
        eq(cvs.id, id),
        eq(cvs.userId, userId)
      )
    });
    
    return cv;
  } catch (error) {
    logger.error('Error getting CV by ID:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Get CV content for a specific CV ID
 * This function handles authentication check, file loading, and content retrieval
 */
export async function getSpecificCVContent(cvId: number, userId: number): Promise<string | null> {
  try {
    // Check if the CV exists and belongs to the user
    const cv = await getCVById(cvId, userId);
    
    if (!cv) {
      logger.error(`CV ${cvId} not found or does not belong to user ${userId}`);
      return null;
    }
    
    // Get file path from CV record
    const filePath = cv.fileName ? getCachedFilePath(cv.fileName, 'docx') : null;
    
    // First try to get from cache if it exists
    if (cv.fileName) {
      const cachedContent = await getCachedFile(cv.fileName, 'docx');
      if (cachedContent) {
        logger.info(`Retrieved cached CV content for ${cv.fileName}`);
        return cachedContent.toString();
      }
    }
    
    // If no cached version, load from file
    try {
      // Check if file exists
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        logger.info(`Read CV content from file: ${filePath}`);
        return content;
      } else {
        logger.error(`CV file not found at path: ${filePath || 'unknown'}`);
        return null;
      }
    } catch (fileError) {
      logger.error(`Error reading CV file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      
      // Fallback to content stored in the database if available
      if (cv.rawText) {
        logger.info(`Using database-stored content for CV ${cvId}`);
        return cv.rawText;
      }
      
      return null;
    }
  } catch (error) {
    logger.error(`Error retrieving CV content: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
} 