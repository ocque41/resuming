export const dynamic = "force-dynamic"; // Prevent pre-rendering at build time

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import fs from "fs/promises";
import path from "path";
import { extractTextFromPdf } from "@/lib/metadata/extract";
import { saveFile } from "@/lib/fileStorage";
import { processCVWithAI } from "@/lib/utils/cvProcessor";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq } from 'drizzle-orm';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: process.env.AWS_S3_ENDPOINT,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || '';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Parse FormData instead of JSON
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    // Convert file to buffer for storage
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate unique ID for the document
    const fileId = uuidv4();
    const fileName = file.name;
    const fileExtension = path.extname(fileName);
    const fileKey = `uploads/${userId}/${fileId}${fileExtension}`;
    
    // Upload to S3
    try {
      logger.info('Uploading file to S3', { 
        bucket: BUCKET_NAME,
        key: fileKey,
        contentType: file.type,
        fileSize: file.size
      });
      
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type,
      });
      
      await s3Client.send(putCommand);
      logger.info('Successfully uploaded file to S3', { fileKey });
      
      // Save record to database
      const result = await db.insert(cvs).values({
        userId: Number(userId),
        fileName: fileName,
        filepath: fileKey,
        createdAt: new Date(),
        metadata: JSON.stringify({
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date().toISOString(),
          storageType: 's3'
        }),
      }).returning();
      
      // Extract text from PDF if it's a PDF file
      if (file.type === 'application/pdf') {
        try {
          const text = await extractTextFromPdf(buffer.toString('utf-8'));
          if (text && result[0]) {
            await db.update(cvs)
              .set({ rawText: text })
              .where(eq(cvs.id, result[0].id));
          }
        } catch (extractError) {
          logger.error('Error extracting text from PDF', extractError as Error);
          // Continue without text extraction
        }
      }
      
      return NextResponse.json({
        success: true,
        fileId: result[0]?.id,
        fileName: fileName,
        fileKey: fileKey,
        message: 'File uploaded successfully',
      });
    } catch (s3Error) {
      logger.error('S3 upload error', s3Error as Error);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error processing upload', error as Error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use POST to upload a file' },
    { status: 200 }
  );
}
