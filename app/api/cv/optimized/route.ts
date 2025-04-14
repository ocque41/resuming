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
    console.log(`Found ${allCvs.length} total CVs for user ${user.id}`);
    
    // Filter for optimized CVs only
    const optimizedCvs = allCvs.filter((cv) => {
      try {
        const metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
        console.log(`CV ${cv.id} (${cv.fileName}) metadata:`, metadata);
        
        // Check for optimization flag in multiple possible locations
        const isOptimized = 
          metadata.optimized === true || 
          metadata.isOptimized === true || 
          metadata.optimizedDocxPath || 
          (metadata.status && metadata.status.includes('optimized'));
        
        return isOptimized;
      } catch (error) {
        console.error(`Error parsing metadata for CV ${cv.id}:`, error);
        return false;
      }
    });
    
    console.log(`Found ${optimizedCvs.length} optimized CVs after filtering`);

    // Format the response
    const formattedCvs = optimizedCvs.map((cv) => ({
      id: cv.id,
      name: cv.fileName,
      createdAt: cv.createdAt,
    }));

    return NextResponse.json({ cvs: formattedCvs });
  } catch (error) {
    console.error('Error fetching optimized CVs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimized CVs' },
      { status: 500 }
    );
  }
} 