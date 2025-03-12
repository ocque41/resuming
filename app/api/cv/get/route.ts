import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { getCachedAnalysis, getCachedFilePath } from '@/lib/utils/cvCache';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get CV ID from query parameter (support both 'id' and 'cvId')
    const { searchParams } = new URL(request.url);
    const cvIdParam = searchParams.get('cvId') || searchParams.get('id');
    
    if (!cvIdParam) {
      return NextResponse.json(
        { success: false, error: 'CV ID is required' },
        { status: 400 }
      );
    }
    
    const cvId = parseInt(cvIdParam);
    
    if (isNaN(cvId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CV ID' },
        { status: 400 }
      );
    }
    
    // Fetch the CV from the database to ensure it belongs to the user
    const cv = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });
    
    if (!cv || cv.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
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
        logger.error('Error parsing CV metadata');
      }
    }
    
    // Prepare the response with full CV data
    interface CVResponse {
      id: number;
      fileName: string;
      createdAt: Date;
      metadata: any;
      rawText?: string;
      hasAnalysis: boolean;
      hasOptimization: boolean;
      analysisDate: any;
      optimizationDate: any;
      pdfBase64?: string;
      docxBase64?: string;
    }
    
    const cvData: CVResponse = {
      id: cv.id,
      fileName: cv.fileName,
      createdAt: cv.createdAt,
      metadata: metadata,
      rawText: cv.rawText?.substring(0, 200) + (cv.rawText && cv.rawText.length > 200 ? '...' : ''), // Send a preview of the text
      hasAnalysis: !!(metadata?.atsScore),
      hasOptimization: !!(metadata?.optimizedText),
      analysisDate: metadata?.analyzedAt || null,
      optimizationDate: metadata?.optimizedAt || null
    };
    
    const response = {
      success: true,
      cv: cvData
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
          cvData.pdfBase64 = Buffer.from(pdfContent).toString('base64');
        }
      } catch (err) {
        logger.error('Error reading PDF file');
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
          cvData.docxBase64 = Buffer.from(docxContent).toString('base64');
        }
      } catch (err) {
        logger.error('Error reading DOCX file');
      }
    }
    
    return NextResponse.json(response);
  } catch (err) {
    logger.error('Error fetching CV data:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 