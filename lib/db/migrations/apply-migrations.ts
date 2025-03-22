import { sql } from 'drizzle-orm';
import { db } from '../drizzle';
import fs from 'fs';
import path from 'path';

async function applyMigrations() {
  console.log('Applying database migrations...');

  try {
    // Add emailVerified column to users table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;
    `);
    console.log('Added email_verified column to users table');

    // Create verification_tokens table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token TEXT NOT NULL,
        expires TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
      );
    `);
    console.log('Created verification_tokens table');

    // Add indexes for faster lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS verification_tokens_email_idx ON verification_tokens(email);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS verification_tokens_token_idx ON verification_tokens(token);
    `);
    console.log('Added indexes to verification_tokens table');

    console.log('All migrations applied successfully!');
  } catch (error) {
    console.error('Error applying migrations:', error);
    process.exit(1);
  }
}

// Run the migrations
applyMigrations()
  .then(() => {
    console.log('Migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 