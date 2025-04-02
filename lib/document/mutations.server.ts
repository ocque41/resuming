import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { simpleLogger as logger } from '@/lib/logger';

/**
 * Interface for document creation parameters
 */
interface CreateDocumentParams {
  userId: string;
  s3Key: string;
  fileName: string;
  fileType: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a new document in the database
 */
export async function createDocument(params: CreateDocumentParams) {
  logger.info('Creating document', { 
    userId: params.userId,
    fileName: params.fileName,
  });

  try {
    // Generate a unique ID
    const id = uuidv4();
    const now = new Date();
    
    // Create document object
    const document = {
      id,
      userId: params.userId,
      s3Key: params.s3Key,
      fileName: params.fileName,
      fileType: params.fileType,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
      status: 'active',
      type: 'document' // Set default type
    };

    // Determine document type based on file extension
    const fileExtension = params.fileName.split('.').pop()?.toLowerCase();
    if (fileExtension === 'pdf' || fileExtension === 'doc' || fileExtension === 'docx') {
      document.type = 'document';
    } else if (fileExtension === 'txt') {
      // Check if it's a CV or resume by checking the filename
      const lowerFileName = params.fileName.toLowerCase();
      if (lowerFileName.includes('cv') || lowerFileName.includes('resume')) {
        document.type = 'cv';
      }
    }
    
    // Insert into database (using db client)
    await db.insert('documents', document);
    
    // Return the created document
    return document;
  } catch (error) {
    logger.error('Error creating document', { error });
    throw error;
  }
}

/**
 * Updates an existing document
 */
export async function updateDocument(id: string, updates: Partial<Omit<CreateDocumentParams, 'userId'>>) {
  logger.info('Updating document', { id });
  
  try {
    // Get current document
    const document = await db.get('documents', { id });
    
    if (!document) {
      throw new Error(`Document with ID ${id} not found`);
    }
    
    // Create updated document
    const updatedDocument = {
      ...document,
      ...updates,
      updatedAt: new Date()
    };
    
    // Update in database
    await db.update('documents', { id }, updatedDocument);
    
    // Return updated document
    return updatedDocument;
  } catch (error) {
    logger.error('Error updating document', { error, id });
    throw error;
  }
}

/**
 * Deletes a document
 */
export async function deleteDocument(id: string) {
  logger.info('Deleting document', { id });
  
  try {
    // Soft delete by updating status
    await db.update('documents', { id }, { 
      status: 'deleted',
      updatedAt: new Date()
    });
    
    return true;
  } catch (error) {
    logger.error('Error deleting document', { error, id });
    throw error;
  }
} 