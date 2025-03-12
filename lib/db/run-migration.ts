import { db } from './drizzle';
import { sql } from 'drizzle-orm';
import { client } from './drizzle';

async function runMigration() {
  console.log("Starting migration...");
  
  try {
    // Add optimizedDocxPath column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE "cvs" ADD COLUMN IF NOT EXISTS "optimized_docx_path" TEXT;
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the migration
runMigration(); 