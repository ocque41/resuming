import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCVsForUser } from '@/lib/db/queries.server';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Fetch CVs for the user - using the existing getCVsForUser function
    const userCvs = await getCVsForUser(user.id);
    
    // Map to the format expected by the client
    const formattedCvs = userCvs.map(cv => {
      // Parse metadata if it exists
      let metadata = null;
      
      if (cv.metadata) {
        try {
          metadata = typeof cv.metadata === 'string' 
            ? JSON.parse(cv.metadata) 
            : cv.metadata;
        } catch (e) {
          // Silent fail for metadata parsing
        }
      }
      
      return {
        id: cv.id,
        fileName: cv.fileName,
        createdAt: cv.createdAt,
        metadata: metadata ? {
          optimizedPdfFilePath: metadata.optimizedPdfFilePath,
          optimizedDocxFilePath: metadata.optimizedDocxFilePath
        } : null
      };
    });
    
    return NextResponse.json({ cvs: formattedCvs });
  } catch (err) {
    logger.error('Error fetching CVs');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 