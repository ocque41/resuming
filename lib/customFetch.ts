// lib/customFetch.ts
import crossFetch from "cross-fetch";

export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const selectUser = process.env.DROPBOX_SELECT_USER;
  let headers: Record<string, string> = {};

  // Convert init.headers to a plain object.
  if (init && init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value;
      }
    } else {
      headers = { ...init.headers } as Record<string, string>;
    }
  }

  // Inject the Dropbox-API-Select-User header if available.
  if (selectUser) {
    headers["Dropbox-API-Select-User"] = selectUser;
  }

  // Set headers back into init.
  if (init) {
    init.headers = headers;
  } else {
    init = { headers };
  }

  // Optionally log outgoing headers for debugging.
  console.log("customFetch - outgoing headers:", headers);

  return crossFetch(input, init);
}
