import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { getCachedAnalysis, getCachedFilePath } from '@/lib/utils/cvCache';

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
    const cv = await db.cv.findFirst({
      where: {
        id: cvId,
        userId: user.id,
      },
      include: {
        metadata: true,
      },
    });
    
    if (!cv) {
      return NextResponse.json(
        { error: 'CV not found' },
        { status: 404 }
      );
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
    if (cv.metadata?.optimizedPdfFilePath) {
      try {
        let pdfContent;
        
        // Try cache first
        if (cachedPdfPath && fs.existsSync(cachedPdfPath)) {
          pdfContent = fs.readFileSync(cachedPdfPath);
        } else {
          // If not in cache, try to get from storage
          const supabase = createAdminClient();
          const bucketName = 'cvs';
          const filePath = cv.metadata.optimizedPdfFilePath;
          
          const { data, error } = await supabase
            .storage
            .from(bucketName)
            .download(filePath);
            
          if (error) {
            logger.error(`Error downloading PDF: ${error.message}`, { 
              cvId,
              filePath,
              userId: user.id
            });
          } else if (data) {
            pdfContent = await data.arrayBuffer();
          }
        }
        
        if (pdfContent) {
          response.pdfBase64 = Buffer.from(pdfContent).toString('base64');
        }
      } catch (error) {
        logger.error('Error reading PDF file', { error, cvId, userId: user.id });
      }
    }
    
    // Try to get the DOCX content
    if (cv.metadata?.optimizedDocxFilePath) {
      try {
        let docxContent;
        
        // Try cache first
        if (cachedDocxPath && fs.existsSync(cachedDocxPath)) {
          docxContent = fs.readFileSync(cachedDocxPath);
        } else {
          // If not in cache, try to get from storage
          const supabase = createAdminClient();
          const bucketName = 'cvs';
          const filePath = cv.metadata.optimizedDocxFilePath;
          
          const { data, error } = await supabase
            .storage
            .from(bucketName)
            .download(filePath);
            
          if (error) {
            logger.error(`Error downloading DOCX: ${error.message}`, { 
              cvId,
              filePath,
              userId: user.id
            });
          } else if (data) {
            docxContent = await data.arrayBuffer();
          }
        }
        
        if (docxContent) {
          response.docxBase64 = Buffer.from(docxContent).toString('base64');
        }
      } catch (error) {
        logger.error('Error reading DOCX file', { error, cvId, userId: user.id });
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching CV data', { error, cvId: params.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 