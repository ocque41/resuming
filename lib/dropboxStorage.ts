// lib/dropboxStorage.ts
import { Dropbox } from 'dropbox';
import fs from 'fs/promises';
import path from 'path';
import { dbx } from 'lib/dropboxAdmin';

/**
 * Uploads a file to Dropbox and returns the shared link.
 * @param localFilePath - The local file path of the uploaded file.
 * @param filename - The desired filename in Dropbox.
 * @returns A Promise that resolves with the shared URL of the file.
 */
export async function uploadFileToDropbox(localFilePath: string, filename: string): Promise<string> {
  // Read the file from the local file system.
  const fileContents = await fs.readFile(localFilePath);
  
  // Define the destination path in Dropbox (e.g., "/pdfs/filename")
  const dropboxPath = path.join('/pdfs', filename);
  
  // Build the upload parameters.
  const uploadParams: any = {
    path: dropboxPath,
    contents: fileContents,
    mode: { ".tag": "overwrite" }
  };

  // (Team member header is handled via our custom fetch in dropboxAdmin.ts)

  // Upload the file.
  await dbx.filesUpload(uploadParams);
  
  // Create a shared link for the file.
  const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
  
  // Replace the dl parameter to force direct download.
  // Using '?dl=1' should return the raw file content.
  const sharedLink = sharedLinkResult.result.url.replace('?dl=0', '?dl=1');
  
  return sharedLink;
}
