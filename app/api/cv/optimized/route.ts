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
    
    // Filter for optimized CVs only
    const optimizedCvs = allCvs.filter((cv) => {
      try {
        const metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
        return metadata.optimized === true;
      } catch (error) {
        return false;
      }
    });

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