import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import { getDropboxClient } from "@/lib/dropboxAdmin";

// Define metadata interface
interface CVMetadata {
  docxBase64?: string;
  docxDownloadLink?: string;
  [key: string]: any; // Allow for additional properties
}

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      console.error("Unauthorized access attempt to download-optimized-docx");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    if (!cvId) {
      console.error("Missing cvId parameter for download-optimized-docx");
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }

    console.log(`Processing optimized DOCX download request for CV ID: ${cvId}`);

    // Fetch the CV record from the database
    let cvRecord;
    try {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId)),
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ 
        error: "Database error while fetching CV" 
      }, { status: 500 });
    }
    
    if (!cvRecord) {
      console.error(`CV not found with ID: ${cvId}`);
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }

    // Create a new filename for the optimized version
    const fileName = cvRecord.fileName || `cv-${cvId}.docx`;
    const fileNameParts = fileName.split('.');
    fileNameParts.pop(); // Remove extension
    const baseName = fileNameParts.join('.');
    const optimizedFileName = `${baseName}-optimized.docx`;

    // Check if the optimized DOCX path exists
    if (!cvRecord.optimizedDocxPath) {
      // Parse the metadata to see if we have a base64 version as fallback
      let metadata: CVMetadata = {};
      try {
        metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      } catch (parseError) {
        console.error("Error parsing metadata:", parseError);
      }
      
      // If we have base64 data in metadata, use that
      if (metadata.docxBase64) {
        console.log(`Using base64 DOCX data for CV ${cvId}`);
        const buffer = Buffer.from(metadata.docxBase64, 'base64');
        
        console.log(`Returning DOCX from base64 for CV ${cvId} as ${optimizedFileName}`);
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${optimizedFileName}"`,
            'Cache-Control': 'no-cache',
          },
        });
      }
      
      console.error(`No optimized DOCX available for CV ${cvId}`);
      return NextResponse.json({ 
        error: "No optimized DOCX file available for download" 
      }, { status: 404 });
    }

    // Parse the metadata to get the Dropbox link if available
    let metadata: CVMetadata = {};
    let dropboxLink = '';
    
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      if (metadata.docxDownloadLink) {
        dropboxLink = metadata.docxDownloadLink;
      }
    } catch (parseError) {
      console.error("Error parsing metadata:", parseError);
    }
    
    // Get a fresh link from Dropbox using the stored path
    let docxBuffer;
    try {
      console.log(`Fetching optimized DOCX from Dropbox for CV ${cvId}`);
      
      if (!dropboxLink || true) { // Always get a fresh link to avoid expiration issues
        try {
          // Use Dropbox API to get a fresh temporary link
          const dbx = getDropboxClient();
          const tempLinkResult = await dbx.filesGetTemporaryLink({ path: cvRecord.optimizedDocxPath });
          dropboxLink = tempLinkResult.result.link;
          console.log(`Generated fresh Dropbox link for ${cvRecord.optimizedDocxPath}`);
        } catch (err) {
          console.error("Failed to get fresh Dropbox link:", err);
          return NextResponse.json({ 
            error: "Failed to retrieve file from storage" 
          }, { status: 500 });
        }
      }
      
      // Fetch the file from Dropbox
      console.log(`Downloading file from Dropbox link: ${dropboxLink}`);
      const response = await axios({
        method: 'get',
        url: dropboxLink,
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'application/octet-stream'
        }
      });
      
      docxBuffer = Buffer.from(response.data);
      console.log(`Successfully downloaded ${docxBuffer.length} bytes from Dropbox`);
    } catch (fetchError) {
      console.error("Error fetching DOCX from Dropbox:", fetchError);
      return NextResponse.json({ 
        error: "Failed to retrieve optimized DOCX from storage" 
      }, { status: 500 });
    }

    console.log(`Returning optimized DOCX for CV ${cvId} as ${optimizedFileName}`);

    // Return the DOCX file with correct content type and proper Content-Disposition header
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${optimizedFileName}"; filename*=UTF-8''${encodeURIComponent(optimizedFileName)}`,
        'Cache-Control': 'no-cache'
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error downloading optimized DOCX:", error);
    return NextResponse.json({ 
      error: `Failed to download optimized DOCX: ${errorMessage}` 
    }, { status: 500 });
  }
} 