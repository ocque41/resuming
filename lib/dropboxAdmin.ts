// lib/dropboxAdmin.ts
import fetch from 'node-fetch';

// Ensure global fetch is defined, with a type cast to bypass incompatibility.
if (!globalThis.fetch) {
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
}
console.log("Global fetch defined:", !!globalThis.fetch);

import { Dropbox } from 'dropbox';

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
  clientId: process.env.DROPBOX_APP_KEY as string,
  clientSecret: process.env.DROPBOX_SECRET_KEY as string,
});

export { dbx };
