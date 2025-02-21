// app/api/dropbox-upload/route.ts
import { NextResponse } from 'next/server';
import { uploadFileToDropbox } from '../../../lib/dropboxStorage';
import fs from 'fs/promises';

export async function POST(request: Request) {
  try {
    // Parse the incoming form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const filename = file.name;
    
    // Convert the file to an ArrayBuffer and then to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    
    // Write the file to a temporary location
    const tempPath = `/tmp/${filename}`;
    await fs.writeFile(tempPath, fileBuffer);
    
    // Upload the file to Dropbox
    const publicUrl = await uploadFileToDropbox(tempPath, filename);
    
    // Clean up the temporary file
    await fs.unlink(tempPath);
    
    // Return the public URL in the response
    return NextResponse.json({ message: 'Upload successful', filepath: publicUrl });
  } catch (error: any) {
    console.error('Dropbox upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
