import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// Database connection string from environment variable
const connectionString = process.env.POSTGRES_URL!;

// Client for migrations
const migrationClient = postgres(connectionString, { max: 1 });

/**
 * Run this migration to add the document_analyses table
 */
async function main() {
  console.log("Starting migration to add document_analyses table...");
  
  const db = drizzle(migrationClient);
  
  try {
    // Create the document_analyses table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS document_analyses (
        id SERIAL PRIMARY KEY,
        cv_id INTEGER NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
        version INTEGER NOT NULL DEFAULT 1,
        analysis_type VARCHAR(50) NOT NULL DEFAULT 'general',
        overall_score INTEGER,
        sentiment_score INTEGER,
        keyword_count INTEGER,
        entity_count INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        content_analysis JSONB,
        sentiment_analysis JSONB,
        key_information JSONB,
        summary JSONB,
        raw_analysis_response JSONB
      );
    `);
    
    // Create index for faster lookups
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS document_analyses_cv_id_version_idx 
      ON document_analyses(cv_id, version);
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

// Run the migration
main().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
}); 