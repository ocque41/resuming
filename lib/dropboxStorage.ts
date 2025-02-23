import { Dropbox } from 'dropbox';
import fs from 'fs/promises';
import path from 'path';
import { dbx } from 'lib/dropboxAdmin';

/**
 * Uploads a file to Dropbox and returns a temporary direct link.
 * This link points directly to the file’s content (PDF bytes).
 *
 * @param localFilePath - The local file path of the uploaded file.
 * @param originalFilename - The desired filename in Dropbox.
 * @returns A Promise that resolves with the temporary direct URL of the file.
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
  
  // Get a temporary direct link for the file.
  const tempLinkResult = await dbx.filesGetTemporaryLink({ path: dropboxPath });
  const directLink = tempLinkResult.result.link;
  
  return directLink;
}
