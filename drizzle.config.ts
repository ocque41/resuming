import type { Config } from 'drizzle-kit';
import { parse } from 'pg-connection-string';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
} satisfies Config;
