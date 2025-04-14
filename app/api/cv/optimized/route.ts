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
    
    // Format the response - include all CVs, not just optimized ones
    const formattedCvs = allCvs.map((cv) => ({
      id: cv.id,
      name: cv.fileName,
      createdAt: cv.createdAt,
    }));

    return NextResponse.json({ cvs: formattedCvs });
  } catch (error) {
    console.error('Error fetching CVs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CVs' },
      { status: 500 }
    );
  }
} 