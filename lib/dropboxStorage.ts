import fs from "fs/promises";
import path from "path";
import { getDropboxClient, updateDropboxAccessToken } from "lib/dropboxAdmin";

/**
 * Uploads a file to Dropbox and returns the shared link.
 * Generates a unique filename to avoid conflicts.
 *
 * @param localFilePath - The local file path of the uploaded file.
 * @param originalFilename - The original filename of the uploaded file.
 * @returns A Promise that resolves with the direct shared URL of the file.
 */
export async function uploadFileToDropbox(localFilePath: string, originalFilename: string): Promise<string> {
  // Generate a unique filename by appending a timestamp.
  const uniqueFileName = `${path.parse(originalFilename).name}-${Date.now()}${path.extname(originalFilename)}`;
  
  // Read the file from the local file system.
  const fileContents = await fs.readFile(localFilePath);
  
  // Define the destination path in Dropbox.
  const dropboxPath = path.join('/pdfs', uniqueFileName);
  
  const dbx = getDropboxClient();
  
  // Upload the file using the Dropbox SDK.
  try {
    await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContents,
      mode: { ".tag": "overwrite" }
    });
  } catch (error: any) {
    // If a 401 error occurs, attempt to refresh the token and retry once.
    if (error.status === 401) {
      console.error("Access token expired, refreshing token...");
      await updateDropboxAccessToken();
      return await uploadFileToDropbox(localFilePath, originalFilename);
    }
    throw error;
  }
  
  // Create a shared link for the file.
  const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
  
  // Convert the shared link into a direct download URL.
  const directLink = sharedLinkResult.result.url.replace('?dl=0', '?dl=1');
  
  return directLink;
}
