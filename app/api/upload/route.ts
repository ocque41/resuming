// app/api/upload/route.ts

export const dynamic = "force-dynamic"; // Prevent build-time pre-rendering

import { NextResponse } from "next/server";
import formidable from "formidable";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { Readable } from "stream";
import { IncomingMessage } from "http";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { extractTextFromPdf } from "@/lib/metadata/extract";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

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
      { message: "You must be logged in to upload your CV." },
      { status: 401 }
    );
  }

  // Determine upload directory.
  const baseDir = process.env.NODE_ENV === "production" ? "/tmp" : process.cwd();
  const uploadDir = path.join(baseDir, "uploads");
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  // Parse the form.
  const buffer = Buffer.from(await request.arrayBuffer());
  const stream = bufferToStream(buffer);
  const fakeReq = stream as unknown as IncomingMessage;
  (fakeReq as any).headers = Object.fromEntries(request.headers.entries());
  (fakeReq as any).method = request.method;

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
    console.error("Formidable parse error:", err);
    return { fields: null, files: null };
  });
  if (!files) {
    return NextResponse.json(
      { message: "Error processing file upload." },
      { status: 500 }
    );
  }

  const fileOrFiles = files.file;
  const uploadedFile = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
  if (!uploadedFile) {
    return NextResponse.json(
      { message: "No file was uploaded." },
      { status: 400 }
    );
  }

  const fileName = uploadedFile.originalFilename || "UnnamedCV.pdf";
  const filePath = uploadedFile.filepath;
  console.log("File saved at:", filePath);

  // Extract raw text from the PDF.
  let rawText = "";
  try {
    rawText = await extractTextFromPdf(filePath);
    console.log("Extracted raw text (first 200 chars):", rawText.slice(0, 200));
  } catch (err) {
    console.error("Error extracting raw text:", err);
    // You can choose to fail the upload or continue with empty rawText.
  }

  try {
    // Insert the new CV record (including rawText and default metadata).
    const [newCV] = await db.insert(cvs).values({
      userId: session.user.id,
      fileName,
      filePath,
      rawText,
      metadata: JSON.stringify({ atsScore: "N/A", optimized: "No", sent: "No" }),
    }).returning();
    return NextResponse.json({ message: "CV uploaded successfully!" });
  } catch (dbError) {
    console.error("Database error:", dbError);
    return NextResponse.json(
      { message: "Error saving CV to database." },
      { status: 500 }
    );
  }
}
