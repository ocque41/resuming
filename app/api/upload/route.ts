import { NextResponse } from 'next/server';
import formidable from 'formidable';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';

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
  // Retrieve the session using your custom getSession function.
  const session = await getSession();

  // Ensure the session exists and that a user id is present.
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json(
      { message: 'You must be logged in to upload your CV.' },
      { status: 401 }
    );
  }

  // Read the entire request body into a Buffer.
  const buffer = Buffer.from(await request.arrayBuffer());
  // Convert the Buffer into a Node.js Readable stream.
  const stream = bufferToStream(buffer);

  // Create a "fake" IncomingMessage by casting the stream.
  // We also attach the headers and method from the original Request.
  const fakeReq = stream as unknown as IncomingMessage;
  (fakeReq as any).headers = Object.fromEntries(request.headers.entries());
  (fakeReq as any).method = request.method;

  // Configure formidable to save files to the "uploads" folder.
  const form = formidable({
    uploadDir: './uploads',
    keepExtensions: true,
  });

  // Parse the "fake" IncomingMessage with formidable.
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

  // Access the uploaded file (ensure the form field name is "file")
  const fileOrFiles = files.file;
  const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;

  if (!uploadedFile) {
    return NextResponse.json(
      { message: 'No file was uploaded.' },
      { status: 400 }
    );
  }

  // Use the file's original filename if available.
  const fileName = uploadedFile.originalFilename || 'UnnamedCV.pdf';
  const filePath = uploadedFile.filepath;

  try {
    // Insert a record into the cvs table.
    await db.insert(cvs).values({
      userId: session.user.id,
      fileName,
      filePath,
    });

    return NextResponse.json({ message: 'CV uploaded successfully!' });
  } catch (dbError) {
    console.error('Database error:', dbError);
    return NextResponse.json(
      { message: 'Error saving CV to database.' },
      { status: 500 }
    );
  }
}
