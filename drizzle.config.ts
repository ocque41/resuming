import type { Config } from 'drizzle-kit';
import { parse } from 'pg-connection-string';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: parse(process.env.POSTGRES_URL!).host!,
    port: parseInt(parse(process.env.POSTGRES_URL!).port || '5432', 10),
    user: parse(process.env.POSTGRES_URL!).user!,
    password: parse(process.env.POSTGRES_URL!).password,
    database: parse(process.env.POSTGRES_URL!).database!,
    ssl: true,
  },
} satisfies Config;
