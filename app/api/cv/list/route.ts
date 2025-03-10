import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Fetch CVs for the user
    const cvs = await db.query.cv.findMany({
      where: {
        userId: user.id
      },
      include: {
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({
      cvs: cvs.map(cv => ({
        id: cv.id,
        fileName: cv.fileName,
        createdAt: cv.createdAt,
        metadata: cv.metadata ? {
          optimizedPdfFilePath: cv.metadata.optimizedPdfFilePath,
          optimizedDocxFilePath: cv.metadata.optimizedDocxFilePath
        } : null
      }))
    });
  } catch (error) {
    logger.error('Error fetching CVs', { error, userId: (await getUser())?.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 