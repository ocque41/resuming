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
 * Run this migration to add the email_verified column to users table
 */
async function main() {
  console.log("Starting migration to add email_verified column...");
  console.log("Using connection string:", connectionString.substr(0, 10) + "...");
  
  const db = drizzle(migrationClient);
  
  try {
    console.log("Checking if column exists...");
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verified';
    `);
    
    console.log("Column check result:", result);
    
    // Add email_verified column if it doesn't exist
    console.log("Adding email_verified column...");
    const alterResult = await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);
    
    console.log("Alter table result:", alterResult);
    
    // Verify the column was added
    const verifyResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verified';
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