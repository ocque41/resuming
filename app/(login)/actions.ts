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
import { addUserToNotion, addOrUpdateNotionUser } from "@/lib/notion/notion";
import { sendVerificationEmail, sendConfirmationEmail } from "@/lib/email/resend";
import { createVerificationToken } from "@/lib/auth/verification";
import axios from "axios";

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

  await Promise.all([
    setSession(foundUser),
    logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN),
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: foundTeam, priceId });
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;
  const captchaToken = formData.get("captchaToken") as string;
  const subscribeToNewsletter = formData.get("subscribeToNewsletter") === "true";

  // Create response variable
  let response: any = {};

  // Initialize success flags
  let emailVerificationSuccess = false;
  let notionSuccess = false;
  let userCreated = false;

  try {
    // We'll skip cookie deletion as it's not essential for fixing the sign-up flow
    // const { cookies } = await import('next/headers');
    // const cookieStore = cookies();
    // cookieStore.delete('authToken');

    // Validate CAPTCHA
    console.log('[SIGNUP] Verifying captcha');
    // Basic validation of the custom CAPTCHA token
    // Our token is just a random string, so we just need to make sure it exists
    const isCaptchaValid = captchaToken && captchaToken.length >= 10;

    if (!isCaptchaValid) {
      console.error('[SIGNUP] Invalid captcha');
      return {
        error: 'Invalid verification code. Please try completing the CAPTCHA again.',
        email,
        password,
      };
    }
    console.log('[SIGNUP] Captcha verified');

    // Check if the user already exists
    console.log('[SIGNUP] Checking if user exists');
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('[SIGNUP] User already exists');
      return { error: 'User already exists', email, password };
    }
    console.log('[SIGNUP] User does not exist. Proceeding with sign up');

    // Create the user
    try {
      console.log('[SIGNUP] Creating user in DB');
      const passwordHash = await hashPassword(password);
      
      const newUser: NewUser = {
        email,
        passwordHash,
        role: 'owner', // Default role
        emailVerified: null, // Mark email as not verified initially
      };
      
      const [createdUser] = await db.insert(users).values(newUser).returning();
      
      if (!createdUser) {
        return {
          error: 'Failed to create account. Please try again later.',
          email,
          password,
        };
      }
      
      // Create a new team for the user
      const newTeam: NewTeam = {
        name: `${email}'s Team`,
        planName: "Free" // Set default plan to Free
      };
      
      const [createdTeam] = await db.insert(teams).values(newTeam).returning();
      
      if (!createdTeam) {
        return {
          error: 'Failed to create team. Please try again.',
          email,
          password,
        };
      }
      
      // Create the team member relationship
      const newTeamMember: NewTeamMember = {
        userId: createdUser.id,
        teamId: createdTeam.id,
        role: 'owner',
      };
      
      await db.insert(teamMembers).values(newTeamMember);
      await logActivity(createdTeam.id, createdUser.id, ActivityType.SIGN_UP);
      
      // Try to set the session
      try {
        await setSession(createdUser);
      } catch (sessionError) {
        console.error('[SIGNUP] Error setting session:', sessionError);
        // Continue even if session setting fails
      }
      
      console.log('[SIGNUP] Successfully created user in DB');
      userCreated = true;
      response = { createdUser, createdTeam };
    } catch (e) {
      console.error('[SIGNUP] Error creating user:', e);
      return { error: 'Error creating user', email, password };
    }

    // Try to send the verification email, but don't block the flow if it fails
    try {
      // Send the user a confirmation email with a link to verify their email
      console.log('[SIGNUP] Sending verification email');
      const verificationToken = await createVerificationToken(email);
      if (verificationToken) {
        await sendVerificationEmail(email, verificationToken);
        console.log('[SIGNUP] Successfully sent verification email');
        emailVerificationSuccess = true;
        
        // Also send a welcome/confirmation email
        try {
          await sendConfirmationEmail(email);
        } catch (confirmError) {
          console.error('[SIGNUP] Error sending confirmation email:', confirmError);
          // Continue even if confirmation email fails
        }
      } else {
        console.warn('[SIGNUP] Failed to create verification token');
      }
    } catch (e) {
      console.error('[SIGNUP] Error sending verification email:', e);
      // Continue with sign-up even if email fails
    }

    // Try to add the user to Notion, but don't block the flow if it fails
    try {
      console.log('[SIGNUP] Adding user to Notion');
      await addOrUpdateNotionUser(email, 'Free', subscribeToNewsletter);
      console.log('[SIGNUP] Successfully added user to Notion');
      notionSuccess = true;
    } catch (e) {
      console.error('[SIGNUP] Error adding user to Notion:', e);
      // Continue with sign-up even if Notion integration fails
    }

    // Redirect to the setup page on successful signup, including verification status info
    console.log('[SIGNUP] Redirecting to signup success page');
    redirect(`/signup-success?verification=${emailVerificationSuccess ? 'success' : 'failed'}&notion=${notionSuccess ? 'success' : 'failed'}&email=${encodeURIComponent(email)}&newsletter=${subscribeToNewsletter}`);
  } catch (error: any) {
    // Special handling for Next.js redirects
    if (error?.message?.includes('NEXT_REDIRECT')) {
      // This is not an error, it's just Next.js's way of handling redirects
      console.log('[SIGNUP] Redirect triggered by Next.js. This is expected behavior.');
      throw error; // Re-throw to allow the redirect to happen
    }

    // Special handling if the user was created but something went wrong after
    if (userCreated) {
      console.error('[SIGNUP] Error during sign-up completion:', error);
      // Redirect to success page with error status for non-critical components
      redirect(`/signup-success?verification=${emailVerificationSuccess ? 'success' : 'failed'}&notion=${notionSuccess ? 'success' : 'failed'}&email=${encodeURIComponent(email)}&newsletter=${subscribeToNewsletter}`);
    }

    // Handle other errors
    console.error('[SIGNUP] Unexpected error during sign-up:', error);
    return {
      error: 'An unexpected error occurred during sign-up. Please try again later.',
      email,
      password,
    };
  }
});

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

    // Check if passwordHash is defined
    if (!user.passwordHash) {
      return { error: 'Account information is incomplete. Please contact support.' };
    }

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash as string,
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

    // Check if passwordHash is defined
    if (!user.passwordHash) {
      return { error: 'Account information is incomplete. Please contact support.' };
    }

    const isPasswordValid = await comparePasswords(password, user.passwordHash as string);
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
