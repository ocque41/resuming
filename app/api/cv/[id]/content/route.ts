export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Legacy route handler that maintains compatibility with old endpoint pattern
 * This implementation combines redirection with direct CV fetching for maximum compatibility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the CV ID from the route parameter
    const cvId = params.id;
    
    if (!cvId || isNaN(Number(cvId))) {
      return NextResponse.json(
        { success: false, error: 'Invalid CV ID' },
        { status: 400 }
      );
    }
    
    // Get the user session for authentication
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Fetch the CV from the database
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId)),
    });
    
    // Check if the CV exists
    if (!cvRecord) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }
    
    // Check if the CV belongs to the user
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to access this CV' },
        { status: 403 }
      );
    }
    
    // Check if the CV has content
    if (!cvRecord.rawText || cvRecord.rawText.trim().length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'CV text content not available',
          needsProcessing: true 
        },
        { status: 404 }
      );
    }
    
    // Return the CV content in the format expected by the client
    return NextResponse.json({
      success: true,
      text: cvRecord.rawText,
      content: cvRecord.rawText, // Provide both property names for compatibility
      fileName: cvRecord.fileName,
      cvId: cvRecord.id
    });
    
  } catch (error) {
    console.error('Error fetching CV content:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve CV content' },
      { status: 500 }
    );
  }
} 