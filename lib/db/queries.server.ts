// lib/db/queries.server.ts
import { desc, and, eq, isNull, like, ilike } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, cvs } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId: number) {
  const result = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.teamMembers[0]?.team || null;
}

export async function getCVsForUser(userId: number) {
  return await db.select().from(cvs).where(eq(cvs.userId, userId));
}

// ------------------------------
// New functions for CV analysis
// ------------------------------

/**
 * Retrieves a CV record by its fileName.
 * Uses a more flexible search to handle case differences, partial matches, and filenames with pipe characters.
 */
export async function getCVByFileName(fileName: string) {
  console.log(`getCVByFileName called with: "${fileName}"`);
  
  // Check if the filename contains a pipe character with an ID
  if (fileName.includes('|')) {
    // Extract the actual filename part (before the pipe)
    const actualFileName = fileName.split('|')[0];
    console.log(`Filename contains pipe character. Using actual filename: "${actualFileName}"`);
    
    // Try to find by the actual filename
    const fileNameMatch = await db
      .select()
      .from(cvs)
      .where(eq(cvs.fileName, actualFileName))
      .limit(1);
    
    if (fileNameMatch.length) {
      console.log(`Found CV by actual filename: ${actualFileName}`);
      return fileNameMatch[0];
    }
    
    // If not found, try to find by ID (after the pipe)
    const idPart = fileName.split('|')[1];
    if (idPart && !isNaN(parseInt(idPart))) {
      const cvId = parseInt(idPart);
      console.log(`Trying to find CV by ID: ${cvId}`);
      
      const idMatch = await db
        .select()
        .from(cvs)
        .where(eq(cvs.id, cvId))
        .limit(1);
      
      if (idMatch.length) {
        console.log(`Found CV by ID: ${cvId}`);
        return idMatch[0];
      }
    }
  }
  
  // First try exact match
  const exactMatch = await db
    .select()
    .from(cvs)
    .where(eq(cvs.fileName, fileName))
    .limit(1);
  
  if (exactMatch.length) {
    console.log(`Found CV by exact filename match: ${fileName}`);
    return exactMatch[0];
  }
  
  // If no exact match, try case-insensitive match
  const caseInsensitiveMatch = await db
    .select()
    .from(cvs)
    .where(ilike(cvs.fileName, fileName))
    .limit(1);
  
  if (caseInsensitiveMatch.length) {
    console.log(`Found CV by case-insensitive match: ${fileName}`);
    return caseInsensitiveMatch[0];
  }
  
  // If still no match, try partial match (filename might be stored with path)
  const partialMatch = await db
    .select()
    .from(cvs)
    .where(like(cvs.fileName, `%${fileName}%`))
    .limit(1);
  
  if (partialMatch.length) {
    console.log(`Found CV by partial match: ${fileName}`);
    return partialMatch[0];
  }
  
  console.log(`No CV found for filename: ${fileName}`);
  return null;
}

/**
 * Updates the CV record with new analysis metadata.
 * @param cvId - The ID of the CV record.
 * @param metadata - The analysis metadata as a JSON string.
 * @returns A promise that resolves to true when the update is complete.
 */
export async function updateCVAnalysis(cvId: number, metadata: string): Promise<boolean> {
  await db.update(cvs).set({ metadata }).where(eq(cvs.id, cvId));
  return true;
}
