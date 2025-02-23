// lib/dropboxToken.ts
import crossFetch from "cross-fetch";

/**
 * Exchanges a refresh token for a new access token.
 * @param refreshToken - Your stored Dropbox refresh token.
 * @returns A Promise that resolves with the new access token.
 */
export async function refreshDropboxAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", process.env.DROPBOX_APP_KEY as string);
  params.append("client_secret", process.env.DROPBOX_SECRET_KEY as string);

  const response = await crossFetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    body: params.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}
