import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db/drizzle';
import { documents } from '@/lib/db/schema';
import * as fs from 'fs';
import * as path from 'path';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; 

// Supported file types
const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/jpeg',
  'image/png',
  'application/rtf',
];

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // Convert file to buffer for storage
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate unique ID for the document
    const documentId = uuidv4();
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create user directory
    const userDir = path.join(uploadsDir, user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Generate file path
    const fileExtension = path.extname(file.name);
    const fileName = `${documentId}${fileExtension}`;
    const filePath = path.join(userDir, fileName);
    const relativePath = path.join('uploads', user.id.toString(), fileName);
    
    // Write file to disk
    fs.writeFileSync(filePath, buffer);
    
    // Save document metadata to database
    const savedDocument = await db.insert(documents).values({
      id: documentId,
      userId: user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      filePath: relativePath,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'uploaded',
      metadata: JSON.stringify({
        originalName: file.name,
        documentType: documentType || file.type,
      }),
    }).returning();

    return NextResponse.json({
      success: true,
      fileId: documentId,
      fileName: file.name,
      fileType: file.type,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
} 