// lib/dropboxAdmin.ts
import "../../polyfill"; // Adjust the path if necessary so that polyfill.ts is imported first

import { Dropbox } from 'dropbox';

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN as string,
  clientId: process.env.DROPBOX_APP_KEY as string,
  clientSecret: process.env.DROPBOX_SECRET_KEY as string,
});

export { dbx };
