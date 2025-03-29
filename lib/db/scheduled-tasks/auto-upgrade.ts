import { db } from '../drizzle';
import { sql } from 'drizzle-orm';

/**
 * Scheduled task to ensure all users have at least Pro plan access
 * except those who already have a Moonlighting subscription
 * 
 * This can be called by a cron job or scheduler at regular intervals
 */
export async function ensureProPlanAccess() {
  console.log("[SCHEDULED TASK] Starting automatic plan upgrade process...");
  
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
    
    console.log("[SCHEDULED TASK] Auto-upgrade completed. All users now have at least Pro access.");
    return { success: true, message: "All users upgraded to at least Pro plan" };
  } catch (error) {
    console.error("[SCHEDULED TASK] Auto-upgrade failed:", error);
    return { success: false, error: String(error) };
  }
}

// If this file is run directly (not imported), execute the task
if (require.main === module) {
  ensureProPlanAccess()
    .then((result) => {
      console.log("[SCHEDULED TASK] Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("[SCHEDULED TASK] Unexpected error:", error);
      process.exit(1);
    });
} 