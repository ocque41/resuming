import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentById } from '@/lib/document/queries.server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents/[id]
 * 
 * Fetch a single document by ID for the authenticated user
 * Ensures the user owns the document before returning it
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const documentId = params.id;
    
    // Log the request
    logger.info('Fetching document by ID', {
      userId: session.user.id,
      documentId,
    });

    // Fetch the document
    const document = await getDocumentById(documentId);

    // Check if document exists
    if (!document) {
      logger.warn('Document not found', {
        userId: session.user.id,
        documentId,
      });
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Ensure the user owns the document
    if (document.userId !== parseInt(session.user.id)) {
      logger.warn('Unauthorized access attempt to document', {
        userId: session.user.id,
        documentId,
        ownerUserId: document.userId,
      });
      return NextResponse.json(
        { error: 'You do not have permission to access this document' },
        { status: 403 }
      );
    }

    // Return the document
    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    logger.error('Error fetching document by ID', error instanceof Error ? error : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
} 