// pages/api/upload-cv.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { getSession } from 'next-auth/react'

// Disable Next.js' default body parsing so that formidable can process the form-data
export const config = {
  api: {
    bodyParser: false,
  },
}

type Data = {
  message: string
  content?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  // Ensure the user is authenticated (using NextAuth as an example)
  const session = await getSession({ req })
  if (!session) {
    return res.status(401).json({ message: 'You must be logged in to upload your CV.' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Use formidable to parse the incoming form (including file uploads)
  const form = new formidable.IncomingForm()

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable parse error:', err)
      return res.status(500).json({ message: 'Error processing file upload.' })
    }

    // Access the uploaded file (the name "file" must match the formData key)
    const fileOrFiles = files.file;
    const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;

    if (!uploadedFile) {
      return res.status(400).json({ message: 'No file was uploaded.' })
    }

    // For demonstration, we read the file's content as text.
    // In production, you might store the file in a cloud storage service or save its path in your database.
    fs.readFile((uploadedFile as formidable.File).filepath, 'utf8', async (readErr, data) => {
      if (readErr) {
        console.error('Error reading file:', readErr)
        return res.status(500).json({ message: 'Error reading file content.' })
      }

      // TODO: Save the file (or its parsed data) to your database.
      // For example, using Prisma:
      // await prisma.user.update({
      //   where: { id: session.user.id },
      //   data: { cvContent: data }, // Or store the file path if you save it somewhere else
      // })

      // For this example, we just return success.
      return res.status(200).json({ message: 'CV uploaded successfully!', content: data })
    })
  })
}
