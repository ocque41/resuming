import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUser } from '@/lib/document/queries.server';
import { logger } from '@/lib/logger';
import { createDocument } from '@/lib/document/mutations.server';
import { Document } from '@/types/documents';

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
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Log the request
    logger.info('Fetching documents', {
      userId: session.user.id,
      limit,
      page,
      search: search || undefined,
      type: type || undefined,
      sortBy,
      sortOrder,
    });

    // Fetch documents
    const documents = await getDocumentsForUser(session.user.id);

    // Apply filtering if needed (since our database query might not support all filters)
    let filteredDocs = documents;
    
    // Filter by search term if provided
    if (search) {
      filteredDocs = filteredDocs.filter((doc: Document) => {
        const fileNameMatch = doc.fileName.toLowerCase().includes(search.toLowerCase());
        
        // Check metadata if it exists
        let metadataMatch = false;
        if (doc.metadata) {
          if (typeof doc.metadata === 'string') {
            metadataMatch = doc.metadata.toLowerCase().includes(search.toLowerCase());
          } else if (typeof doc.metadata === 'object') {
            // If metadata is an object, convert to JSON string for searching
            metadataMatch = JSON.stringify(doc.metadata).toLowerCase().includes(search.toLowerCase());
          }
        }
        
        return fileNameMatch || metadataMatch;
      });
    }
    
    // Filter by type if provided
    if (type) {
      filteredDocs = filteredDocs.filter((doc: Document) => 
        doc.fileName.toLowerCase().includes(type.toLowerCase())
      );
    }

    // Apply sorting
    filteredDocs.sort((a: Document, b: Document) => {
      // Get the values to compare
      const valueA = a[sortBy as keyof Document];
      const valueB = b[sortBy as keyof Document];
      
      // Handle different data types
      if (valueA instanceof Date && valueB instanceof Date) {
        return sortOrder === 'desc' ? 
          valueB.getTime() - valueA.getTime() : 
          valueA.getTime() - valueB.getTime();
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'desc' ? 
          valueB.localeCompare(valueA) : 
          valueA.localeCompare(valueB);
      }
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
      }
      
      // Default fallback
      return 0;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDocs = filteredDocs.slice(startIndex, endIndex);

    // Calculate pagination info
    const totalDocs = filteredDocs.length;
    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Return the documents and pagination info
    return NextResponse.json({
      success: true,
      documents: paginatedDocs,
      pagination: {
        total: totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    // Use the proper error method signature
    logger.error('Error fetching documents', error instanceof Error ? error : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
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
    // Log the error
    logger.error('Error creating document', error instanceof Error ? error : 'Unknown error');
    
    // Return an error response
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
} 