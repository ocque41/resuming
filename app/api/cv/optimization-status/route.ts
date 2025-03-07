import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');
    const fileName = searchParams.get('fileName');
    
    if (!cvId && !fileName) {
      return NextResponse.json({ error: "CV ID or filename is required" }, { status: 400 });
    }
    
    // Query the CV record
    let cvRecord;
    if (cvId) {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId))
      });
    } else if (fileName) {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.fileName, fileName)
      });
    }
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Parse metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Return optimization status
    return NextResponse.json({
      id: cvRecord.id,
      fileName: cvRecord.fileName,
      optimizing: metadata.optimizing || false,
      optimized: metadata.optimized || false,
      progress: metadata.progress || 0,
      error: metadata.error || null,
      startTime: metadata.startTime || null,
      completedAt: metadata.completedAt || null,
      optimizedText: metadata.optimizedText || null,
      hasOptimizedText: !!metadata.optimizedText
    });
    
  } catch (error) {
    console.error("Error checking optimization status:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to check status: ${errorMessage}` }, { status: 500 });
  }
} 