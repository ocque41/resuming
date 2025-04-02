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

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get file details from request
    const { fileName, fileType, fileSize } = await request.json();
    
    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate file size (optional)
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique file key
    const fileId = uuidv4();
    const fileKey = `uploads/${fileId}/${fileName}`;
    
    // Create S3 upload command
    const putObjectCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
    });
    
    // Generate pre-signed URL for direct upload
    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 3600, // URL expires in 1 hour
    });
    
    // Return upload URL and file details to client
    return NextResponse.json({
      uploadUrl,
      fileId,
      fileKey,
      s3Key: fileKey,
      expiresIn: 3600,
    });
    
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use POST to get a pre-signed upload URL' },
    { status: 200 }
  );
}
