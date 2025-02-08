// app/api/upload/route.ts
import { NextResponse } from 'next/server'
import formidable from 'formidable'
import fs from 'fs'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db/drizzle'
import { cvs } from '@/lib/db/schema'

// Disable body parsing by Next.js (if needed, configure in next.config.js)
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(request: Request) {
  // NOTE: In the app directory, you might need to use getServerSession or another method
  // to retrieve the session, depending on your NextAuth configuration.
  const session = await getServerSession(/* your auth options here */, request)
  
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'You must be logged in to upload your CV.' }, { status: 401 })
  }
  
  // Convert the request to a Node.js readable stream for formidable to work with.
  const form = formidable({
    uploadDir: './uploads',
    keepExtensions: true,
  })
  
  // Wrap formidable parsing in a Promise for async/await usage.
  const { fields, files } = await new Promise<any>((resolve, reject) => {
    form.parse(request as any, (err, fields, files) => {
      if (err) return reject(err)
      resolve({ fields, files })
    })
  }).catch((err) => {
    console.error('Formidable parse error:', err)
    return null
  })
  
  if (!files) {
    return NextResponse.json({ message: 'Error processing file upload.' }, { status: 500 })
  }
  
  // Access the uploaded file (ensure the form field name is "file")
  const fileOrFiles = files.file
  const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles
  
  if (!uploadedFile) {
    return NextResponse.json({ message: 'No file was uploaded.' }, { status: 400 })
  }
  
  const fileName = uploadedFile.originalFilename || 'UnnamedCV.pdf'
  const filePath = uploadedFile.filepath
  
  try {
    await db.insert(cvs).values({
      userId: session.user.id,
      fileName,
      filePath,
    })
    return NextResponse.json({ message: 'CV uploaded successfully!' })
  } catch (dbError) {
    console.error('Database error:', dbError)
    return NextResponse.json({ message: 'Error saving CV to database.' }, { status: 500 })
  }
}
