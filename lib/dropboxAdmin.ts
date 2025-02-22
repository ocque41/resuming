// lib/dropboxAdmin.ts
import { Dropbox } from 'dropbox';
import fetch, { RequestInfo } from 'node-fetch';

// Ensure that global fetch is defined.
if (!globalThis.fetch) {
  globalThis.fetch = fetch as unknown as typeof global.fetch;
}

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
  clientId: process.env.DROPBOX_APP_KEY as string,
  clientSecret: process.env.DROPBOX_SECRET_KEY as string,
});

export { dbx };
