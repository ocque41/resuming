// Script to apply the migration to add the metadata column to job_status table using Vercel CLI
// Usage: npx vercel env pull .env.local && node lib/db/migrations/vercel-add-metadata.js

const { Client } = require('pg');
require('dotenv').config();

async function applyMigration() {
  // Create client using environment variables
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Applying migration to add metadata column to job_status table...');
    
    // Execute the migration
    await client.query(`ALTER TABLE job_status ADD COLUMN IF NOT EXISTS metadata JSONB;`);
    
    console.log('Migration applied successfully!');
    console.log('Checking if column was added...');
    
    // Verify the column was added
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'job_status' AND column_name = 'metadata'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Metadata column successfully added to job_status table');
    } else {
      console.error('❌ Failed to add metadata column');
    }
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    // Close the client
    await client.end();
  }
}

// Run the migration
applyMigration(); 