import { db } from '../drizzle';
import { sql } from 'drizzle-orm';
import { client } from '../drizzle';

/**
 * Migration to set all users to the Pro plan
 * This ensures that all users have Pro features
 */
async function upgradeUsersToPro() {
  console.log("Starting user plan migration...");
  
  try {
    // Update all teams to Pro plan status
    await db.execute(sql`
      UPDATE teams
      SET
        plan_name = 'Pro',
        subscription_status = 'active',
        updated_at = NOW()
    `);
    
    console.log("Migration completed successfully! Teams updated to Pro plan.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the migration
upgradeUsersToPro(); 