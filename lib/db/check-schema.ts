import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

// Get database connection string
const connectionString = process.env.POSTGRES_URL!;

// Client for schema checking
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function checkSchema() {
  console.log("=== Database Schema Check ===");
  
  try {
    // Check for users table
    console.log("\n📋 Checking users table structure...");
    const usersColumns = await db.execute(sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log("\nUsers table columns:");
    console.table(usersColumns);
    
    // Check for email_verified column specifically
    console.log("\n🔍 Looking for email_verified column...");
    const emailVerifiedColumn = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'email_verified';
    `);
    
    if (emailVerifiedColumn && emailVerifiedColumn.length > 0) {
      console.log("✅ email_verified column found:", emailVerifiedColumn);
    } else {
      console.log("❌ email_verified column NOT FOUND");
      
      // Try to add it
      console.log("\n⚙️ Attempting to add email_verified column...");
      try {
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        `);
        console.log("✅ Column added successfully!");
      } catch (addError) {
        console.error("❌ Failed to add column:", addError);
      }
    }
    
    // Check the schema migration table if it exists
    console.log("\n📋 Checking for schema migration table...");
    const migrationTables = await db.execute(sql`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE tablename LIKE '%migration%';
    `);
    
    console.log("Migration-related tables:");
    console.table(migrationTables);
    
    // Do a sample query to verify we can read from the users table
    console.log("\n🧪 Testing query on users table...");
    try {
      const userCount = await db.execute(sql`SELECT COUNT(*) FROM users;`);
      console.log("User count:", userCount);
      
      // Try updating a user's email_verified field
      console.log("\n🧪 Testing update on email_verified field...");
      await db.execute(sql`
        UPDATE users SET email_verified = true WHERE id = 1;
      `);
      console.log("Update operation successful!");
    } catch (queryError) {
      console.error("Query error:", queryError);
    }
    
    console.log("\n✅ Schema check completed");
  } catch (error) {
    console.error("Schema check failed:", error);
  } finally {
    await client.end();
  }
}

// Run the schema check
checkSchema().catch(console.error); 