import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { cvs } from '@/lib/db/schema';

/**
 * Get a document by ID
 */
export async function getDocumentById(documentId: string | number) {
  try {
    const numericId = typeof documentId === 'string' ? parseInt(documentId) : documentId;
    
    const document = await db.query.cvs.findFirst({
      where: eq(cvs.id, numericId),
    });
    
    return document;
  } catch (error) {
    console.error(`Error getting document by ID ${documentId}:`, error);
    return null;
  }
}

/**
 * Get all documents for a user
 */
export async function getDocumentsForUser(userId: string | number) {
  try {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    const documents = await db.query.cvs.findMany({
      where: eq(cvs.userId, numericId),
      orderBy: (cvs, { desc }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting documents for user ${userId}:`, error);
    return [];
  }
}

/**
 * Get documents by file type for a user
 */
export async function getDocumentsByFileTypeForUser(userId: string | number, fileType: string) {
  try {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    const documents = await db.query.cvs.findMany({
      where: (fields, { eq, and, like }) => 
        and(
          eq(fields.userId, numericId),
          like(fields.fileName, `%.${fileType}%`),
        ),
      orderBy: (cvs, { desc }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting ${fileType} documents for user ${userId}:`, error);
    return [];
  }
}

/**
 * Get recent documents for a user
 */
export async function getRecentDocumentsForUser(userId: string | number, limit: number = 5) {
  try {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    const documents = await db.query.cvs.findMany({
      where: eq(cvs.userId, numericId),
      orderBy: (cvs, { desc }) => [desc(cvs.createdAt)],
      limit,
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting recent documents for user ${userId}:`, error);
    return [];
  }
} 