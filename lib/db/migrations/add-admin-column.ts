import { sql } from 'drizzle-orm';
import { db } from '../drizzle';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  console.log('Applying admin column migration...');

  try {
    // Add admin column to users table if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added admin column to users table');

    // Add index for faster queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS users_admin_idx ON users(admin);
    `);
    console.log('Added index on admin column');

    console.log('Admin column migration applied successfully!');
  } catch (error) {
    console.error('Error applying admin column migration:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('Admin column migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin column migration script failed:', error);
    process.exit(1);
  }); 