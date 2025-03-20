import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentsForUser } from '@/lib/document/queries.server';
import { logger } from '@/lib/logger';

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
      filteredDocs = filteredDocs.filter(doc => 
        doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (doc.metadata && doc.metadata.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    // Filter by type if provided
    if (type) {
      filteredDocs = filteredDocs.filter(doc => 
        doc.fileName.toLowerCase().includes(type.toLowerCase())
      );
    }

    // Apply sorting
    filteredDocs.sort((a, b) => {
      // Get the values to compare
      const valueA = a[sortBy as keyof typeof a];
      const valueB = b[sortBy as keyof typeof b];
      
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