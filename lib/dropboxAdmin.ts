// lib/dropboxAdmin.ts
import { customFetch } from "./customFetch";

// Ensure our custom fetch is defined globally.
if (!globalThis.fetch) {
  globalThis.fetch = customFetch;
}
console.log("Global fetch defined:", !!globalThis.fetch);

import { Dropbox } from "dropbox";

let currentAccessToken: string = process.env.DROPBOX_ACCESS_TOKEN as string;
let dbxInstance: Dropbox | null = null;

/**
 * Returns the current Dropbox client instance.
 */
export function getDropboxClient(): Dropbox {
  if (!dbxInstance) {
    dbxInstance = new Dropbox({
      accessToken: currentAccessToken,
      clientId: process.env.DROPBOX_APP_KEY as string,
      clientSecret: process.env.DROPBOX_SECRET_KEY as string,
      fetch: customFetch, // Use our custom fetch.
    });
  }
  return dbxInstance;
}

/**
 * Refreshes the Dropbox access token using the refresh token,
 * then updates the Dropbox client instance.
 */
import { refreshDropboxAccessToken } from "./dropboxToken"; // Ensure this file exists.
export async function updateDropboxAccessToken(): Promise<void> {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("DROPBOX_REFRESH_TOKEN is not defined");
  }
  const newAccessToken = await refreshDropboxAccessToken(refreshToken);
  currentAccessToken = newAccessToken;
  dbxInstance = new Dropbox({
    accessToken: newAccessToken,
    clientId: process.env.DROPBOX_APP_KEY as string,
    clientSecret: process.env.DROPBOX_SECRET_KEY as string,
    fetch: customFetch,
  });
  console.log("Dropbox access token refreshed");
}

export { getDropboxClient as dbx };
