import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get user session for authentication
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get CV ID from query params
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    
    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }
    
    console.log(`Loading optimized content for CV: ${cvId}`);
    
    // Get the CV from database - handle both numeric IDs and filenames
    let cvRecord;
    const cvIdNum = parseInt(cvId, 10);
    
    if (!isNaN(cvIdNum)) {
      // If it's a valid number, lookup by ID
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNum),
      });
    } else {
      // If it's a filename, use the filename to find the CV
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.fileName, cvId),
      });
    }
    
    if (!cvRecord) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }
    
    // Verify the CV belongs to the authenticated user
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: 'Unauthorized access to CV' }, { status: 401 });
    }
    
    // Parse the metadata to get optimized content
    let metadata = null;
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid metadata format' 
      }, { status: 500 });
    }
    
    if (!metadata) {
      return NextResponse.json({ error: 'No metadata found for this CV' }, { status: 404 });
    }
    
    // Check if optimized text exists in metadata
    const optimizedText = metadata.optimizedText;
    if (!optimizedText) {
      return NextResponse.json({ 
        error: 'No optimized text found for this CV' 
      }, { status: 404 });
    }
    
    // Return optimized text and PDF base64 if available
    return NextResponse.json({
      optimizedText: optimizedText,
      optimizedPDFBase64: metadata.optimizedPDFBase64 || null,
    });
    
  } catch (error) {
    console.error('Error loading optimized content:', error);
    return NextResponse.json({ 
      error: `Failed to load optimized content: ${(error as Error).message}` 
    }, { status: 500 });
  }
} 