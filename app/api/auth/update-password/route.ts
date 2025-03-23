import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, ActivityType, activityLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { comparePasswords, hashPassword } from '@/lib/auth/session';
import { getUserWithTeam } from '@/lib/db/queries.server';
import { z } from 'zod';

// Schema for password update validation
const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(100),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
) {
  if (teamId === null || teamId === undefined) {
    return;
  }

  await db.insert(activityLogs).values({
    teamId,
    userId,
    action: type,
    ipAddress: '',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if the user is authenticated
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'You must be logged in to update your password' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const result = updatePasswordSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }
    
    const { currentPassword, newPassword } = result.data;
    
    // Get the user from the database
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    
    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const user = userResult[0];
    
    // Check if passwordHash is defined
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Account information is incomplete. Please contact support.' },
        { status: 400 }
      );
    }
    
    // Verify current password
    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }
    
    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from the current password' },
        { status: 400 }
      );
    }
    
    // Hash the new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Get user's team for activity logging
    const userWithTeam = await getUserWithTeam(user.id);
    
    // Update the password in the database
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, user.id));
    
    // Log the activity
    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.UPDATE_PASSWORD
    );
    
    return NextResponse.json(
      { message: 'Password updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 