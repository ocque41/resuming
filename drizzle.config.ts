import type { Config } from 'drizzle-kit';
import { parse } from 'pg-connection-string';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    ...parse(process.env.POSTGRES_URL!),
  },
} satisfies Config;
