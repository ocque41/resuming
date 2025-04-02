import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { cvs, CV } from '@/lib/db/schema';

/**
 * Get all documents for a specific user
 */
export async function getAllDocuments(userId: string) {
  try {
    const documents = await db.query.cvs.findMany({
      where: eq(cvs.userId, parseInt(userId)),
      orderBy: (cvs: typeof import('@/lib/db/schema').cvs, { desc }: { desc: any }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error('Error getting all documents:', error);
    return [];
  }
}

/**
 * Get a document by ID
 */
export async function getDocumentById(documentId: number) {
  try {
    const document = await db.query.cvs.findFirst({
      where: eq(cvs.id, documentId),
    });
    
    return document;
  } catch (error) {
    console.error(`Error getting document by ID ${documentId}:`, error);
    return null;
  }
}

/**
 * Get recent documents for a user
 */
export async function getRecentDocuments(userId: string, limit: number = 10) {
  try {
    const documents = await db.query.cvs.findMany({
      where: eq(cvs.userId, parseInt(userId)),
      orderBy: (cvs: typeof import('@/lib/db/schema').cvs, { desc }: { desc: any }) => [desc(cvs.createdAt)],
      limit,
    });
    
    return documents;
  } catch (error) {
    console.error('Error getting recent documents:', error);
    return [];
  }
}

/**
 * Get documents by type for a user
 */
export async function getDocumentsByType(userId: string, type: string) {
  try {
    const documents = await db.query.cvs.findMany({
      where: (fields: any, { eq, and, like }: { eq: any, and: any, like: any }) => 
        and(
          eq(fields.userId, parseInt(userId)),
          like(fields.fileName, `%${type}%`),
        ),
      orderBy: (cvs: typeof import('@/lib/db/schema').cvs, { desc }: { desc: any }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting documents by type ${type}:`, error);
    return [];
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: number) {
  try {
    await db.delete(cvs).where(eq(cvs.id, documentId));
    return true;
  } catch (error) {
    console.error(`Error deleting document ${documentId}:`, error);
    return false;
  }
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(documentId: number, metadata: any) {
  try {
    const [updatedDocument] = await db.update(cvs)
      .set({
        metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      })
      .where(eq(cvs.id, documentId))
      .returning();
    
    return updatedDocument;
  } catch (error) {
    console.error(`Error updating document metadata for ${documentId}:`, error);
    return null;
  }
}

/**
 * Get all documents by file extension
 */
export async function getDocumentsByExtension(userId: string, extension: string) {
  try {
    const documents = await db.query.cvs.findMany({
      where: (fields: any, { eq, and, like }: { eq: any, and: any, like: any }) => 
        and(
          eq(fields.userId, parseInt(userId)),
          like(fields.fileName, `%.${extension}`),
        ),
      orderBy: (cvs: typeof import('@/lib/db/schema').cvs, { desc }: { desc: any }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error(`Error getting documents by extension ${extension}:`, error);
    return [];
  }
}

/**
 * Search documents by filename
 */
export async function searchDocumentsByName(userId: string, searchTerm: string) {
  try {
    const documents = await db.query.cvs.findMany({
      where: (fields: any, { eq, and, like }: { eq: any, and: any, like: any }) => 
        and(
          eq(fields.userId, parseInt(userId)),
          like(fields.fileName, `%${searchTerm}%`),
        ),
      orderBy: (cvs: typeof import('@/lib/db/schema').cvs, { desc }: { desc: any }) => [desc(cvs.createdAt)],
    });
    
    return documents;
  } catch (error) {
    console.error(`Error searching documents by name "${searchTerm}":`, error);
    return [];
  }
} 