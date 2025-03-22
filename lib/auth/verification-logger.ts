import { db } from '@/lib/db/drizzle';
import { activityLogs, ActivityType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Log a verification-related activity
 * This is a simplified version that doesn't require a teamId
 */
export async function logVerificationActivity(
  userId: number,
  type: ActivityType,
  additionalData?: Record<string, any>
) {
  try {
    // Try to find the user's team ID
    const teamMember = await db.query.teamMembers.findFirst({
      where: (teamMembers, { eq }) => eq(teamMembers.userId, userId)
    });
    
    // Skip logging if no team ID is found
    if (!teamMember?.teamId) {
      console.warn(`Skipping activity log for user ${userId}: No team found`);
      return;
    }
    
    await db.insert(activityLogs).values({
      teamId: teamMember.teamId,
      userId,
      action: type,
      ipAddress: '',
    });
  } catch (error) {
    console.error('Error logging verification activity:', error);
    // Don't throw - we don't want logging errors to affect the user experience
  }
} 