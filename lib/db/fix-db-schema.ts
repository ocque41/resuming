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

async function fixDatabaseSchema() {
  console.log("=== Starting Database Schema Fix ===");
  console.log("Connecting to database...");
  
  // Create a dedicated Postgres client for this operation
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  
  try {
    // STEP 1: Check if email_verified column exists
    console.log("\n1. Checking if email_verified column exists...");
    const emailVerifiedCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_verified';
    `);
    
    let needToAddColumn = false;
    
    if (emailVerifiedCheck.length === 0) {
      console.log("Column email_verified doesn't exist, will add it");
      needToAddColumn = true;
    } else {
      console.log("Column email_verified already exists, no need to add it");
    }
    
    if (needToAddColumn) {
      // STEP 2: Add the missing column
      console.log("\n2. Adding email_verified column to users table...");
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
      `);
      console.log("Successfully added email_verified column");
    }
    
    // STEP 3: Validate that the column exists and can be updated
    console.log("\n3. Validating that the column works...");
    try {
      // A test update that should not affect data but just validate the column works
      await db.execute(sql`
        UPDATE users SET email_verified = email_verified WHERE FALSE;
      `);
      console.log("Successfully validated email_verified column");
    } catch (validationError) {
      console.error("Failed to validate email_verified column:", validationError);
      throw validationError;
    }
    
    console.log("\n✅ Database schema fix completed successfully!");
  } catch (error) {
    console.error("❌ Error fixing database schema:", error);
    throw error;
  } finally {
    // Always close the database connection
    await client.end();
    console.log("Database connection closed");
  }
}

// Run the fix
fixDatabaseSchema()
  .then(() => {
    console.log("Fix process completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fix process failed:", error);
    process.exit(1);
  }); 