import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

// For drizzle-kit v0.18.1
// Try a minimal configuration
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  
  // Try using a different property name for the database connection
  // Based on the error messages, neither 'driver' nor 'dbCredentials' seem to be valid
  // Let's try the most basic configuration possible
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
} satisfies Config;
