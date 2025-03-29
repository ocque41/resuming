import { db } from '../drizzle';
import { sql } from 'drizzle-orm';
import { client } from '../drizzle';

/**
 * Migration to set all users to Pro plan except those who already have Moonlighting
 * This ensures that all users have at least Pro features while preserving paid subscriptions
 */
async function upgradeUsersToPro() {
  console.log("Starting user plan migration...");
  
  try {
    // Update all teams to Pro plan status except those already on Moonlighting
    await db.execute(sql`
      UPDATE teams 
      SET 
        plan_name = 'Pro', 
        subscription_status = 'active', 
        updated_at = NOW()
      WHERE 
        (plan_name IS NULL OR plan_name = 'Free' OR plan_name != 'Moonlighting')
        AND (plan_name != 'Moonlighting')
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