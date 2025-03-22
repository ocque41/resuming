import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

// Get database connection string
if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}
const connectionString = process.env.POSTGRES_URL;

/**
 * Validates and fixes database schema issues
 * - Checks for missing email_verified column in users table
 * - Checks for missing email_verification_tokens table
 * - Adds any missing schema elements
 */
async function validateAndFixSchema() {
  console.log("=== Database Schema Validation and Fix ===");
  console.log("Connecting to database...");
  
  // Create a dedicated Postgres client for this operation
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  
  try {
    // STEP 1: Check and fix email_verified column
    console.log("\n1. Checking if email_verified column exists in users table...");
    const emailVerifiedCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verified';
    `);
    
    if (emailVerifiedCheck.length === 0) {
      console.log("Column email_verified doesn't exist, adding it...");
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
      `);
      console.log("✅ Successfully added email_verified column to users table");
    } else {
      console.log("✅ email_verified column already exists in users table");
    }
    
    // STEP 2: Check and fix email_verification_tokens table
    console.log("\n2. Checking if email_verification_tokens table exists...");
    const tableExistsResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_verification_tokens';
    `);
    
    if (tableExistsResult.length === 0) {
      console.log("Table email_verification_tokens doesn't exist, creating it...");
      await db.execute(sql`
        CREATE TABLE email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log("✅ Successfully created email_verification_tokens table");
    } else {
      console.log("✅ email_verification_tokens table already exists");
    }
    
    // STEP 3: Validate the schema changes
    console.log("\n3. Validating schema changes...");
    
    // Validate email_verified column
    const validateColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verified';
    `);
    
    if (validateColumn.length > 0) {
      console.log("✅ email_verified column validation successful");
    } else {
      console.error("❌ Failed to validate email_verified column");
    }
    
    // Validate email_verification_tokens table
    const validateTable = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'email_verification_tokens';
    `);
    
    if (validateTable.length > 0) {
      console.log("✅ email_verification_tokens table validation successful");
    } else {
      console.error("❌ Failed to validate email_verification_tokens table");
    }
    
    console.log("\n=== Database Schema Validation Summary ===");
    console.log(`users.email_verified column: ${validateColumn.length > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);
    console.log(`email_verification_tokens table: ${validateTable.length > 0 ? 'PRESENT ✓' : 'MISSING ✗'}`);
    
    if (validateColumn.length > 0 && validateTable.length > 0) {
      console.log("\n✅ DATABASE SCHEMA VALIDATION PASSED");
    } else {
      console.error("\n❌ DATABASE SCHEMA VALIDATION FAILED");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Error validating/fixing database schema:", error);
    throw error;
  } finally {
    // Always close the database connection
    await client.end();
    console.log("Database connection closed");
  }
}

// Run the validation and fix
validateAndFixSchema()
  .then(() => {
    console.log("Schema validation completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Schema validation failed:", error);
    process.exit(1);
  }); 