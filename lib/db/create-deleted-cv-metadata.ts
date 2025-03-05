import { db } from './drizzle';
import { sql } from 'drizzle-orm';

async function createDeletedCvMetadataTable() {
  console.log("Creating deleted_cv_metadata table...");
  
  try {
    // Create the table directly with IF NOT EXISTS clause
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deleted_cv_metadata (
        id SERIAL PRIMARY KEY,
        original_cv_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        metadata TEXT,
        raw_text TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP NOT NULL
      );
    `);
    
    console.log("Table 'deleted_cv_metadata' created or already exists!");
  } catch (error) {
    console.error("Error creating deleted_cv_metadata table:", error);
    throw error;
  }
}

// Only run this function directly if this script is executed directly
if (require.main === module) {
  createDeletedCvMetadataTable()
    .then(() => {
      console.log("Script completed successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

export { createDeletedCvMetadataTable }; 