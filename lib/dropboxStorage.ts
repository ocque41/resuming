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
  
  // Upload the file using the proper WriteMode format.
  await dbx.filesUpload({
    path: dropboxPath,
    contents: fileContents,
    mode: { ".tag": "overwrite" }
  });
  
  // Create a shared link for the file.
  const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
  
  // Modify the shared link to force direct access (adjust as needed).
  const sharedLink = sharedLinkResult.result.url.replace('?dl=0', '?raw=1');
  
  return sharedLink;
}
