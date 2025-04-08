// Script to apply the migration to add the metadata column to job_status table
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  // Create connection pool using environment variables
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      // Read the SQL migration file
      const migrationPath = path.join(__dirname, 'migrations', 'add_metadata_to_job_status.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log('Applying migration to add metadata column to job_status table...');
      
      // Execute the migration
      await client.query(migrationSQL);
      
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
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
applyMigration(); 