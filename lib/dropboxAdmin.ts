// lib/dropboxAdmin.ts
import { Dropbox } from 'dropbox';

// Ensure you have set the following environment variables:
// DROPBOX_APP_KEY, DROPBOX_SECRET_KEY, DROPBOX_ACCESS_TOKEN

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
  clientId: process.env.DROPBOX_APP_KEY as string,
  clientSecret: process.env.DROPBOX_SECRET_KEY as string,
});

export { dbx };
