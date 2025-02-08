// pages/api/upload-cv.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { getSession } from 'next-auth/react'

// Adjust these import paths if needed (if you prefer using path aliases, update tsconfig.json accordingly)
import { db } from '@/lib/db/drizzle'
import { cvs } from '@/lib/db/schema'

export const config = {
  api: {
    bodyParser: false,
  },
}

type Data = {
  message: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  // Get the session from NextAuth
  const session = await getSession({ req })
  
  // Check that the session exists, and that session.user exists with an id property
  if (!session || !session.user || !(session.user as any).id) {
    return res.status(401).json({ message: 'You must be logged in to upload your CV.' })
  }
  
  // Extract the user id using a type assertion
  const userId = (session.user as { id: number }).id

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Set up formidable to save files in the "uploads" folder (make sure this folder exists)
  const form = new formidable.IncomingForm({
    uploadDir: './uploads',
    keepExtensions: true,
  })

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable parse error:', err)
      return res.status(500).json({ message: 'Error processing file upload.' })
    }

    // Access the uploaded file (ensure the form field name is "file")
    const fileOrFiles = files.file
    const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles

    if (!uploadedFile) {
      return res.status(400).json({ message: 'No file was uploaded.' })
    }

    // Use the file's original filename and filepath
    const fileName = uploadedFile.originalFilename || 'UnnamedCV.pdf'
    const filePath = uploadedFile.filepath // path where the file was saved

    try {
      // Insert a record in the cvs table using Drizzle ORM
      await db.insert(cvs).values({
        userId: userId,
        fileName: fileName,
        filePath: filePath,
      })

      return res.status(200).json({ message: 'CV uploaded successfully!' })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return res.status(500).json({ message: 'Error saving CV to database.' })
    }
  })
}
