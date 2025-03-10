import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { getCachedAnalysis, getCachedFilePath } from '@/lib/utils/cvCache';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const cvId = parseInt(params.id);
    
    if (isNaN(cvId)) {
      return NextResponse.json(
        { error: 'Invalid CV ID' },
        { status: 400 }
      );
    }
    
    // Fetch the CV from the database to ensure it belongs to the user
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId));
    
    if (!cv || cv.userId !== user.id) {
      return NextResponse.json(
        { error: 'CV not found' },
        { status: 404 }
      );
    }
    
    // Get metadata if available
    let metadata = null;
    if (cv.metadata) {
      try {
        metadata = typeof cv.metadata === 'string' 
          ? JSON.parse(cv.metadata) 
          : cv.metadata;
      } catch (e) {
        logger.error('Error parsing CV metadata', { cvId });
      }
    }
    
    // Prepare the response
    const response: {
      id: number;
      fileName: string;
      pdfBase64?: string;
      docxBase64?: string;
    } = {
      id: cv.id,
      fileName: cv.fileName,
    };
    
    // Check cache first
    const cachedAnalysis = getCachedAnalysis(cvId);
    const cachedPdfPath = getCachedFilePath(cvId, 'pdf');
    const cachedDocxPath = getCachedFilePath(cvId, 'docx');
    
    // Try to get the PDF content
    if (metadata?.optimizedPdfFilePath) {
      try {
        let pdfContent;
        
        // Try cache first
        if (cachedPdfPath && fs.existsSync(cachedPdfPath)) {
          pdfContent = fs.readFileSync(cachedPdfPath);
        } else if (fs.existsSync(metadata.optimizedPdfFilePath)) {
          // If not in cache but file exists on disk
          pdfContent = fs.readFileSync(metadata.optimizedPdfFilePath);
        }
        
        if (pdfContent) {
          response.pdfBase64 = Buffer.from(pdfContent).toString('base64');
        }
      } catch (err) {
        logger.error('Error reading PDF file', { cvId });
      }
    }
    
    // Try to get the DOCX content
    if (metadata?.optimizedDocxFilePath) {
      try {
        let docxContent;
        
        // Try cache first
        if (cachedDocxPath && fs.existsSync(cachedDocxPath)) {
          docxContent = fs.readFileSync(cachedDocxPath);
        } else if (fs.existsSync(metadata.optimizedDocxFilePath)) {
          // If not in cache but file exists on disk
          docxContent = fs.readFileSync(metadata.optimizedDocxFilePath);
        }
        
        if (docxContent) {
          response.docxBase64 = Buffer.from(docxContent).toString('base64');
        }
      } catch (err) {
        logger.error('Error reading DOCX file', { cvId });
      }
    }
    
    return NextResponse.json(response);
  } catch (err) {
    logger.error('Error fetching CV data');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 