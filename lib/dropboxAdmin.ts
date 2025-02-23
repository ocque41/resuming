// Ensure our custom fetch is loaded first.
import { customFetch } from "./customFetch";

// Force global fetch to use our customFetch.
if (!globalThis.fetch) {
  globalThis.fetch = customFetch as unknown as typeof globalThis.fetch;
}
console.log("Global fetch defined:", !!globalThis.fetch);

import { Dropbox } from "dropbox";

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
  clientId: process.env.DROPBOX_APP_KEY as string,
  clientSecret: process.env.DROPBOX_SECRET_KEY as string,
  // Pass our customFetch explicitly, with type cast.
  fetch: customFetch as unknown as (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>,
});

export { dbx };
