import { db } from '@/lib/db';
import { simpleLogger as logger } from '@/lib/logger';

/**
 * Interface for document query options
 */
interface DocumentQueryOptions {
  limit?: number;
  page?: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'active' | 'deleted' | 'all';
}

/**
 * Retrieves all documents for a specific user
 * 
 * @param userId The ID of the user
 * @param options Optional query parameters
 * @returns Array of documents
 */
export async function getDocumentsForUser(
  userId: string, 
  options: DocumentQueryOptions = {}
) {
  try {
    logger.info('Fetching documents for user', { userId, options });
    
    // Set defaults
    const limit = options.limit || 100;
    const page = options.page || 1;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    const status = options.status || 'active';
    
    // Build query conditions
    const query = {
      where: {
        userId,
        ...(status !== 'all' ? { status } : {})
      },
      orderBy: { [sortBy]: sortOrder },
      limit,
      offset: (page - 1) * limit
    };
    
    // Execute query
    const documents = await db.query.document.findMany(query);
    
    // Apply search filter if needed (for in-memory search)
    let filteredDocs = documents;
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredDocs = filteredDocs.filter((doc: any) => 
        doc.fileName.toLowerCase().includes(searchLower) || 
        (doc.metadata && JSON.stringify(doc.metadata).toLowerCase().includes(searchLower))
      );
    }
    
    // Apply type filter if needed
    if (options.type) {
      filteredDocs = filteredDocs.filter((doc: any) => doc.type === options.type);
    }
    
    return filteredDocs;
  } catch (error) {
    logger.error('Error fetching documents', error instanceof Error ? error : 'Unknown error');
    return [];
  }
}

/**
 * Retrieves a single document by ID
 * 
 * @param id The document ID
 * @returns The document or null if not found
 */
export async function getDocumentById(id: string) {
  try {
    logger.info('Fetching document by ID', { id });
    
    const document = await db.query.document.findFirst({
      where: { id }
    });
    
    return document;
  } catch (error) {
    logger.error('Error fetching document by ID', error instanceof Error ? error : 'Unknown error');
    return null;
  }
}

/**
 * Retrieves documents by a list of IDs
 * 
 * @param ids Array of document IDs
 * @returns Array of documents
 */
export async function getDocumentsByIds(ids: string[]) {
  try {
    logger.info('Fetching documents by IDs', { count: ids.length });
    
    // For databases that support 'in' operators, we would use:
    // const documents = await db.query.document.findMany({ where: { id: { in: ids } } });
    
    // For our implementation, filter documents manually
    const allDocuments = await db.query.document.findMany({});
    const filteredDocuments = allDocuments.filter((doc: any) => ids.includes(doc.id));
    
    return filteredDocuments;
  } catch (error) {
    logger.error('Error fetching documents by IDs', error instanceof Error ? error : 'Unknown error');
    return [];
  }
}

/**
 * Get documents by file type for a user
 * 
 * @param userId User ID
 * @param fileType File extension (pdf, docx, etc)
 * @returns Array of documents
 */
export async function getDocumentsByFileTypeForUser(userId: string, fileType: string) {
  try {
    logger.info('Fetching documents by file type', { userId, fileType });
    
    // Get all documents for user
    const documents = await getDocumentsForUser(userId);
    
    // Filter by file extension
    const filteredDocs = documents.filter((doc: any) => {
      const extension = doc.fileName.split('.').pop()?.toLowerCase();
      return extension === fileType.toLowerCase();
    });
    
    return filteredDocs;
  } catch (error) {
    logger.error('Error fetching documents by file type', error instanceof Error ? error : 'Unknown error');
    return [];
  }
}

/**
 * Get recent documents for a user
 * 
 * @param userId User ID
 * @param limit Number of documents to return
 * @returns Array of documents
 */
export async function getRecentDocumentsForUser(userId: string, limit: number = 5) {
  try {
    logger.info('Fetching recent documents', { userId, limit });
    
    // Use the main function with limit
    const documents = await getDocumentsForUser(userId, {
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    return documents;
  } catch (error) {
    logger.error('Error fetching recent documents', error instanceof Error ? error : 'Unknown error');
    return [];
  }
} 