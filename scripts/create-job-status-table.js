// Create job_status table script
// This script will create the job_status table directly in the database
// Run with: node scripts/create-job-status-table.js

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
require('dotenv').config();

async function main() {
  console.log('Starting job_status table creation...');
  
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL environment variable is not set');
    process.exit(1);
  }
  
  // Connect to the database
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);
  
  try {
    // Create the job_status table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_status (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        cv_id INTEGER NOT NULL REFERENCES cvs(id),
        status VARCHAR(50) NOT NULL DEFAULT 'processing',
        progress INTEGER NOT NULL DEFAULT 0,
        result JSONB,
        error TEXT,
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        job_type VARCHAR(50) NOT NULL DEFAULT 'tailor',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('job_status table created successfully!');
  } catch (error) {
    console.error('Error creating job_status table:', error);
  } finally {
    // Close database connection
    await client.end();
  }
}

main().catch(err => {
  console.error('Failed to run the script:', err);
  process.exit(1);
}); 