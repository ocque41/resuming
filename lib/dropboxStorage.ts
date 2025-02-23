// lib/dropboxStorage.ts
import { Dropbox } from 'dropbox';
import fs from 'fs/promises';
import path from 'path';
import { dbx } from 'lib/dropboxAdmin';

/**
 * Uploads a file to Dropbox and returns the shared link.
 * Generates a unique filename to avoid conflicts.
 *
 * @param localFilePath - The local file path of the uploaded file.
 * @param originalFilename - The original filename of the uploaded file.
 * @returns A Promise that resolves with the shared URL of the file.
 */
export async function uploadFileToDropbox(localFilePath: string, originalFilename: string): Promise<string> {
  // Generate a unique filename to avoid conflicts (append a timestamp).
  const uniqueFileName = `${path.parse(originalFilename).name}-${Date.now()}${path.extname(originalFilename)}`;
  
  // Read the file from the local file system.
  const fileContents = await fs.readFile(localFilePath);
  
  // Define the destination path in Dropbox (e.g., "/pdfs/uniqueFileName")
  const dropboxPath = path.join('/pdfs', uniqueFileName);
  
  try {
    // Upload the file using the Dropbox SDK.
    await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContents,
      mode: { ".tag": "overwrite" }
    });
  } catch (uploadError) {
    // Log detailed error and rethrow.
    console.error("Dropbox filesUpload error:", JSON.stringify(uploadError, null, 2));
    throw uploadError;
  }
  
  try {
    // Create a shared link for the file.
    const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
    
    // Modify the shared link to force direct download.
    const sharedLink = sharedLinkResult.result.url.replace('?dl=0', '?dl=1');
    return sharedLink;
  } catch (sharingError) {
    console.error("Dropbox sharingCreateSharedLinkWithSettings error:", JSON.stringify(sharingError, null, 2));
    throw sharingError;
  }
}
