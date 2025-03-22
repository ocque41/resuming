import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

// Get database connection string
const connectionString = process.env.POSTGRES_URL!;

// Client for migrations
const migrationClient = postgres(connectionString, { max: 1 });

/**
 * Run this migration to add the email_verification_tokens table
 */
async function main() {
  console.log("Starting migration to add email_verification_tokens table...");
  console.log("Using connection string:", connectionString.substr(0, 10) + "...");
  
  const db = drizzle(migrationClient);
  
  try {
    console.log("Checking if table exists...");
    const tableExistsResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_verification_tokens';
    `);
    
    if (tableExistsResult.length > 0) {
      console.log("Table email_verification_tokens already exists, no need to create it");
      return;
    }
    
    console.log("Creating email_verification_tokens table...");
    await db.execute(sql`
      CREATE TABLE email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log("Table email_verification_tokens created successfully!");
    
    // Verify the table was created
    const verifyResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_verification_tokens';
    `);
    
    console.log("Verification result:", verifyResult);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    throw error;
  } finally {
    await migrationClient.end();
  }
}

// Run the migration
main().catch(console.error); 