import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUser } from '@/lib/document/queries.server';
import { createDocument } from '@/lib/document/mutations.server';
import { Document } from '@/types/documents';
import { getSession } from '@/lib/auth/session';

// Use simple console logging to avoid any import issues
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  }
};

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents
 * 
 * Fetch all documents for the authenticated user
 * Optional query parameters:
 * - limit: number (default: 100)
 * - page: number (default: 1)
 * - search: string
 * - type: string (filter by document type)
 * - sortBy: string (default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get documents for the authenticated user
    try {
      const documents = await getDocumentsForUser(String(session.user.id));
      return NextResponse.json({ documents });
    } catch (dbError) {
      console.error('Database error fetching documents:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch documents', documents: [] },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in documents API:', error);
    return NextResponse.json(
      { error: 'Internal server error', documents: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * 
 * Create a new document
 * Required body parameters:
 * - s3Key: string (S3 key of the uploaded file)
 * - fileName: string (Original filename)
 * - fileType: string (MIME type of the file)
 * 
 * Optional body parameters:
 * - metadata: object (Additional metadata for the document)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.s3Key) {
      return NextResponse.json(
        { error: 'Missing required parameter: s3Key' },
        { status: 400 }
      );
    }
    
    if (!body.fileName) {
      return NextResponse.json(
        { error: 'Missing required parameter: fileName' },
        { status: 400 }
      );
    }
    
    if (!body.fileType) {
      return NextResponse.json(
        { error: 'Missing required parameter: fileType' },
        { status: 400 }
      );
    }
    
    // Log the request
    logger.info('Creating document', {
      userId: session.user.id,
      fileName: body.fileName,
      fileType: body.fileType,
    });

    // Create the document
    const document = await createDocument({
      userId: session.user.id,
      s3Key: body.s3Key,
      fileName: body.fileName,
      fileType: body.fileType,
      metadata: body.metadata || {},
    });

    // Return the created document
    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    // Use a simpler error logging format
    logger.error('Error creating document', error instanceof Error ? error.message : 'Unknown error');
    
    // Return an error response
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
} 