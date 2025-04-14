import { NextRequest, NextResponse } from 'next/server';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';

export async function GET(request: NextRequest) {
  try {
    // Get the current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get all CVs for the user
    const allCvs = await getCVsForUser(user.id);
    
    // Map CVs to a simpler format with parsed metadata
    const formattedCvs = allCvs.map((cv: any) => {
      let parsedMetadata: any = {};
      try {
        parsedMetadata = cv.metadata ? JSON.parse(cv.metadata) : {};
      } catch (error) {
        console.error(`Error parsing metadata for CV ${cv.id}:`, error);
        parsedMetadata = { error: 'Failed to parse metadata' };
      }
      
      return {
        id: cv.id,
        fileName: cv.fileName,
        createdAt: cv.createdAt,
        metadata: parsedMetadata,
        rawMetadata: cv.metadata,
        optimizedDocxPath: cv.optimizedDocxPath,
        // Include other fields that might be relevant
        hasOptimizedTag: parsedMetadata.optimized === true || 
                        parsedMetadata.isOptimized === true,
        hasOptimizedPath: Boolean(cv.optimizedDocxPath || 
                        parsedMetadata.optimizedDocxPath),
        status: parsedMetadata.status || 'unknown'
      };
    });

    return NextResponse.json({ 
      userId: user.id,
      totalCvs: allCvs.length,
      cvs: formattedCvs
    });
  } catch (error) {
    console.error('Error fetching CV debug info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CV debug info' },
      { status: 500 }
    );
  }
} 