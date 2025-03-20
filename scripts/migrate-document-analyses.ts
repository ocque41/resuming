/**
 * Migration script for document analyses
 * 
 * This script:
 * 1. Runs the migration to create the document_analyses table
 * 2. Migrates existing analysis data from CVs metadata to the new table
 * 
 * Usage: npx ts-node scripts/migrate-document-analyses.ts
 */

import { migrateExistingAnalyses } from "@/lib/db/queries.server";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
config();

// Import and run the table creation migration
async function runMigration() {
  console.log("Starting document analyses migration process...");
  
  try {
    // First, run the migration to create the table
    console.log("Step 1: Running migration to create document_analyses table...");
    const migrationModule = await import("../lib/db/migrations/add-document-analyses-table");
    console.log("Table migration completed.");
    
    // Next, migrate existing data
    console.log("Step 2: Migrating existing analysis data...");
    const migratedCount = await migrateExistingAnalyses();
    console.log(`Migration complete! Migrated ${migratedCount} analysis records.`);
    
    console.log("\nMigration process successfully completed!");
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(console.error); 