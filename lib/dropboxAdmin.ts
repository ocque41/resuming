import { Dropbox } from "dropbox";
import crossFetch from "cross-fetch";
import { refreshDropboxAccessToken } from "./dropboxToken";

// Ensure global fetch is defined.
if (!globalThis.fetch) {
  globalThis.fetch = crossFetch;
}
console.log("Global fetch defined:", !!globalThis.fetch);

// We'll store our Dropbox client instance here.
let dbxInstance: Dropbox | null = null;

/**
 * Returns the current Dropbox client instance.
 * If it does not exist, creates a new instance using environment variables.
 */
export function getDropboxClient(): Dropbox {
  if (!dbxInstance) {
    dbxInstance = new Dropbox({
      accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
      clientId: process.env.DROPBOX_APP_KEY as string,
      clientSecret: process.env.DROPBOX_SECRET_KEY as string,
      fetch: crossFetch,
    });
  }
  return dbxInstance;
}

/**
 * Refreshes the Dropbox access token using the stored refresh token,
 * and updates the Dropbox client instance.
 */
export async function updateDropboxAccessToken(): Promise<void> {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("DROPBOX_REFRESH_TOKEN is not defined");
  }
  const newAccessToken = await refreshDropboxAccessToken(refreshToken);
  dbxInstance = new Dropbox({
    accessToken: newAccessToken,
    clientId: process.env.DROPBOX_APP_KEY as string,
    clientSecret: process.env.DROPBOX_SECRET_KEY as string,
    fetch: crossFetch,
  });
  console.log("Dropbox access token refreshed");
}
