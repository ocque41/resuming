import { Dropbox } from 'dropbox';
import fs from 'fs/promises';
import path from 'path';
import { dbx } from 'lib/dropboxAdmin';

/**
 * Uploads a file to Dropbox and returns a direct shared link.
 * The direct link is obtained by converting the shared link into a raw file URL.
 *
 * @param localFilePath - The local file path of the uploaded file.
 * @param originalFilename - The original filename of the uploaded file.
 * @returns A Promise that resolves with the direct shared URL of the file.
 */
export async function uploadFileToDropbox(localFilePath: string, originalFilename: string): Promise<string> {
  // Generate a unique filename to avoid conflicts.
  const uniqueFileName = `${path.parse(originalFilename).name}-${Date.now()}${path.extname(originalFilename)}`;
  
  // Read the file from the local file system.
  const fileContents = await fs.readFile(localFilePath);
  
  // Define the destination path in Dropbox (e.g., "/pdfs/uniqueFileName")
  const dropboxPath = path.join('/pdfs', uniqueFileName);
  
  // Upload the file using the Dropbox SDK.
  await dbx.filesUpload({
    path: dropboxPath,
    contents: fileContents,
    mode: { ".tag": "overwrite" }
  });
  
  // Create a shared link for the file.
  const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
  const sharedLink = sharedLinkResult.result.url;
  
  // Convert the shared link into a direct link:
  // Replace "www.dropbox.com" with "dl.dropboxusercontent.com" and remove query parameters.
  const directLink = sharedLink
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace(/\?.*$/, "");
  
  return directLink;
}
