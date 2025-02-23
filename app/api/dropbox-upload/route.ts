import { NextResponse } from 'next/server';
import { uploadFileToDropbox } from '../../../lib/dropboxStorage';
import fs from 'fs/promises';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const filename = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const tempPath = `/tmp/${filename}`;
    await fs.writeFile(tempPath, fileBuffer);
    
    const publicUrl = await uploadFileToDropbox(tempPath, filename);
    await fs.unlink(tempPath);
    
    return NextResponse.json({ message: 'Upload successful', filepath: publicUrl });
  } catch (error: any) {
    console.error('Dropbox upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
