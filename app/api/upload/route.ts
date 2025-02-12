// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import formidable from 'formidable';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { eq } from 'drizzle-orm';

// Disable Next.js body parsing for this route.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Handle preflight OPTIONS requests.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Helper: convert a Buffer into a Node.js Readable stream.
function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function POST(request: Request) {
  // Retrieve the session.
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json(
      { message: 'You must be logged in to upload your CV.' },
      { status: 401 }
    );
  }

  // Use an absolute uploads directory.
  const uploadDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  // Read the request body as a Buffer and convert it into a Node.js stream.
  const buffer = Buffer.from(await request.arrayBuffer());
  const stream = bufferToStream(buffer);

  // Create a fake IncomingMessage by casting the stream and attaching headers/method.
  const fakeReq = stream as unknown as IncomingMessage;
  (fakeReq as any).headers = Object.fromEntries(request.headers.entries());
  (fakeReq as any).method = request.method;

  // Configure formidable to save files in the uploads directory.
  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
  });

  const { fields, files } = await new Promise<any>((resolve, reject) => {
    form.parse(fakeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  }).catch((err) => {
    console.error('Formidable parse error:', err);
    return { fields: null, files: null };
  });

  if (!files) {
    return NextResponse.json(
      { message: 'Error processing file upload.' },
      { status: 500 }
    );
  }

  const fileOrFiles = files.file;
  const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
  if (!uploadedFile) {
    return NextResponse.json(
      { message: 'No file was uploaded.' },
      { status: 400 }
    );
  }

  const fileName = uploadedFile.originalFilename || 'UnnamedCV.pdf';
  const filePath = uploadedFile.filepath;

  try {
    // Insert the new CV record.
    const [newCV] = await db.insert(cvs).values({
      userId: session.user.id,
      fileName,
      filePath,
    }).returning();

    // Import the metadata extraction helper dynamically.
    const { extractMetadata } = await import('@/lib/metadata/extract');
    const metadata = await extractMetadata(filePath);
    if (metadata) {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(cvs.id, newCV.id));
    }

    return NextResponse.json({ message: 'CV uploaded successfully!' });
  } catch (dbError) {
    console.error('Database error:', dbError);
    return NextResponse.json(
      { message: 'Error saving CV to database.' },
      { status: 500 }
    );
  }
}
