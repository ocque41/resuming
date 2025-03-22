'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  teams,
  teamMembers,
  activityLogs,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
  ActivityType,
  invitations,
  Team,
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries.server';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';
import { generateVerificationToken, storeVerificationToken } from '@/lib/auth/verification';
import { sendVerificationEmail } from '@/lib/email/send-verification';
import { addUserToNotion } from '@/lib/notion/client';
import { verifyCaptcha } from '@/lib/auth/captcha';
import { logVerificationActivity } from '@/lib/auth/verification-logger';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string,
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || '',
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const userWithTeam = await db
    .select({
      user: users,
      team: teams,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1);

  if (userWithTeam.length === 0) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password,
    };
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0];

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash,
  );

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password,
    };
  }

  // Set session and log activity
  const { emailVerified } = await setSession(foundUser);
  await logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN);

  // Handle specified redirect, if any
  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: foundTeam, priceId });
  }

  // If the user's email is not verified, redirect to the verification required page
  if (!emailVerified) {
    redirect('/verification-required');
  }

  // Otherwise, redirect to the dashboard
  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

export async function signUp(formData: FormData) {
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string;
  const name = formData.get('name') as string || email.split('@')[0];
  const inviteId = formData.get('inviteId') as string;
  const captchaToken = formData.get('captchaToken') as string;
  
  // Require CAPTCHA verification
  if (!captchaToken) {
    return {
      error: 'Please complete the CAPTCHA verification.',
      email,
      password,
    };
  }
  
  // Validate captchaToken with Google reCAPTCHA
  const isValidCaptcha = await verifyCaptcha(captchaToken);
  if (!isValidCaptcha) {
    return {
      error: 'CAPTCHA verification failed. Please try again.',
      email,
      password,
    };
  }

  // Check for existing user
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'An account with this email already exists.',
      email,
      password,
    };
  }

  const passwordHash = await hashPassword(password);

  // Create the user
  const newUser: NewUser = {
    email,
    passwordHash,
    name,
    role: 'member',
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return {
      error: 'Failed to create account. Please try again later.',
      email,
      password,
    };
  }

  let teamId: number;
  let userRole: string = 'owner';
  let createdTeam: typeof teams.$inferSelect;

  // Rest of team creation logic follows...
  if (inviteId) {
    try {
      // Check if there's a valid invitation
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.id, parseInt(inviteId)),
            eq(invitations.email, email),
            eq(invitations.status, 'pending'),
          ),
        )
        .limit(1);

      if (invitation) {
        teamId = invitation.teamId;
        userRole = invitation.role;

        // Mark invitation as accepted
        await db
          .update(invitations)
          .set({ status: 'accepted' })
          .where(eq(invitations.id, invitation.id));

        await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION);

        [createdTeam] = await db
          .select()
          .from(teams)
          .where(eq(teams.id, teamId))
          .limit(1);
      } else {
        // Invalid invitation, create a new team
        console.warn(`Invalid invitation ID provided: ${inviteId} for user: ${email}`);
        
        const newTeam: NewTeam = {
          name: `${name}'s Team`,
          planName: "Free" // Set default plan to Free
        };

        [createdTeam] = await db.insert(teams).values(newTeam).returning();
        
        if (!createdTeam) {
          return {
            error: 'Failed to create team. Please try again.',
            email,
            password,
          };
        }

        teamId = createdTeam.id;
        userRole = 'owner';
        await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
      }
    } catch (error) {
      console.error('Error processing invitation:', error);
      
      // Fallback: create a new team
      const newTeam: NewTeam = {
        name: `${name}'s Team`,
        planName: "Free"
      };

      [createdTeam] = await db.insert(teams).values(newTeam).returning();
      
      if (!createdTeam) {
        return {
          error: 'Failed to create team. Please try again.',
          email,
          password,
        };
      }

      teamId = createdTeam.id;
      await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
    }
  } else {
    // No invitation, create a new team
    const newTeam: NewTeam = {
      name: `${name}'s Team`,
      planName: "Free"
    };

    [createdTeam] = await db.insert(teams).values(newTeam).returning();

    if (!createdTeam) {
      return {
        error: 'Failed to create team. Please try again.',
        email,
        password,
      };
    }

    teamId = createdTeam.id;
    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
  }

  const newTeamMember: NewTeamMember = {
    userId: createdUser.id,
    teamId: teamId,
    role: userRole,
  };

  try {
    // Generate verification token
    const token = generateVerificationToken();
    await storeVerificationToken(createdUser.id, email, token);
    
    // Send verification email using the existing function
    await sendVerificationEmail({
      email,
      token,
      name: createdUser.name || '',
    });
    
    // Add to Notion database if enabled
    try {
      await addUserToNotion({
        email,
        signupDate: new Date(),
        verified: false,
        planName: createdTeam.planName || 'Free',
      });
    } catch (notionError) {
      // Don't fail if Notion integration fails
      console.error('Error adding user to Notion:', notionError);
    }
    
    // Create team member, log activity, and set session
    await db.insert(teamMembers).values(newTeamMember);
    await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP);
    
    // Log verification email sent for the new user
    await logVerificationActivity(createdUser.id, ActivityType.VERIFICATION_RESENT);
    
    await setSession(createdUser);
    
    // Always redirect to verification required page for new users
    redirect('/verification-required');
  } catch (error) {
    console.error('Error after user creation:', error);
    return {
      error: 'Your account was created but we encountered an issue. Please try signing in.',
      email,
      password,
    };
  }
}

export async function signOut() {
  const user = (await getUser()) as User;
  const userWithTeam = await getUserWithTeam(user.id);
  await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT);
  (await cookies()).delete('session');
}

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

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      return { error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return {
        error: 'New password must be different from the current password.',
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD),
    ]);

    return { success: 'Password updated successfully.' };
  },
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return { error: 'Incorrect password. Account deletion failed.' };
    }

    const userWithTeam = await getUserWithTeam(user.id);

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT,
    );

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')`, // Ensure email uniqueness
      })
      .where(eq(users.id, user.id));

    if (userWithTeam?.teamId) {
      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, user.id),
            eq(teamMembers.teamId, userWithTeam.teamId),
          ),
        );
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  },
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT),
    ]);

    return { success: 'Account updated successfully.' };
  },
);

const removeTeamMemberSchema = z.object({
  memberId: z.number(),
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId),
        ),
      );

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER,
    );

    return { success: 'Team member removed successfully' };
  },
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner']),
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(
          eq(users.email, email),
          eq(teamMembers.teamId, userWithTeam.teamId),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this team' };
    }

    // Check if there's an existing invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Create a new invitation
    await db.insert(invitations).values({
      teamId: userWithTeam.teamId,
      email,
      role,
      invitedBy: user.id,
      status: 'pending',
    });

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER,
    );

    // TODO: Send invitation email and include ?inviteId={id} to sign-up URL
    // await sendInvitationEmail(email, userWithTeam.team.name, role)

    return { success: 'Invitation sent successfully' };
  },
);
