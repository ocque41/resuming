import fs from "fs/promises";
import path from "path";
import { getDropboxClient, updateDropboxAccessToken } from "lib/dropboxAdmin";

/**
 * Uploads a file to Dropbox and returns the direct shared link.
 */
export async function uploadFileToDropbox(localFilePath: string, originalFilename: string): Promise<string> {
  const fileContents = await fs.readFile(localFilePath);
  const uniqueFileName = `${path.parse(originalFilename).name}-${Date.now()}${path.extname(originalFilename)}`;
  const dropboxPath = path.join('/pdfs', uniqueFileName);
  const dbx = getDropboxClient();

  try {
    await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContents,
      mode: { ".tag": "overwrite" }
    });
  } catch (error: any) {
    if (error.status === 401) {
      console.error("Access token expired, refreshing token...");
      await updateDropboxAccessToken();
      return await uploadFileToDropbox(localFilePath, originalFilename);
    }
    throw error;
  }
  
  // Get a temporary link for the file.
  const tempLinkResult = await dbx.filesGetTemporaryLink({ path: dropboxPath });
  const directLink = tempLinkResult.result.link;
  return directLink;
}
