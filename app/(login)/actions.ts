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
  let verificationEmailId: string | null = null;

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
        admin: false, // Explicitly set admin to false
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
        planName: "Pro" // Set default plan to Pro instead of Free
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
      console.log('[SIGNUP] Creating verification token');
      const verificationToken = await createVerificationToken(email);
      
      if (verificationToken) {
        console.log('[SIGNUP] Sending verification email');
        const emailResult = await sendVerificationEmail(email, verificationToken);
        
        if (emailResult.success && emailResult.data) {
          console.log('[SIGNUP] Successfully sent verification email with ID:', emailResult.data.id);
          emailVerificationSuccess = true;
          verificationEmailId = emailResult.data.id;
          
          // Also send a welcome/confirmation email
          try {
            console.log('[SIGNUP] Sending confirmation email');
            const confirmResult = await sendConfirmationEmail(email);
            
            if (confirmResult.success) {
              console.log('[SIGNUP] Successfully sent confirmation email with ID:', confirmResult.data?.id);
            } else {
              console.warn('[SIGNUP] Failed to send confirmation email:', confirmResult.error);
            }
          } catch (confirmError) {
            console.error('[SIGNUP] Error sending confirmation email:', confirmError);
            // Continue even if confirmation email fails
          }
        } else {
          console.warn('[SIGNUP] Failed to send verification email:', emailResult.error);
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
      console.log(`[SIGNUP] Adding user to Notion with newsletter subscription: ${subscribeToNewsletter}`);
      
      // Try multiple times with different approaches to ensure Notion integration works
      let notionAttempts = 0;
      const maxNotionAttempts = 3;
      let notionError = null;
      
      while (notionAttempts < maxNotionAttempts && !notionSuccess) {
        notionAttempts++;
        try {
          // Add the user to Notion with their newsletter preference
          const result = await addOrUpdateNotionUser(email, 'Pro', subscribeToNewsletter);
          
          if (result) {
            console.log(`[SIGNUP] Successfully added user to Notion on attempt ${notionAttempts}`);
            notionSuccess = true;
            break;
          } else {
            console.warn(`[SIGNUP] Notion integration returned empty result on attempt ${notionAttempts}`);
          }
        } catch (attemptError) {
          notionError = attemptError;
          console.error(`[SIGNUP] Error adding user to Notion (attempt ${notionAttempts}):`, attemptError);
          
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (!notionSuccess) {
        throw notionError || new Error('Failed to add user to Notion after multiple attempts');
      }
    } catch (e) {
      console.error('[SIGNUP] Error adding user to Notion:', e);
      // Continue with sign-up even if Notion integration fails
    }

    // Redirect to the setup page on successful signup, including verification status info
    const redirectParams = new URLSearchParams({
      verification: emailVerificationSuccess ? 'success' : 'failed',
      notion: notionSuccess ? 'success' : 'failed',
      email: email,
      newsletter: subscribeToNewsletter ? 'true' : 'false'
    });
    
    if (verificationEmailId) {
      redirectParams.append('email_id', verificationEmailId);
    }
    
    console.log('[SIGNUP] Redirecting to signup success page');
    redirect(`/signup-success?${redirectParams.toString()}`);
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
      const redirectParams = new URLSearchParams({
        verification: emailVerificationSuccess ? 'success' : 'failed',
        notion: notionSuccess ? 'success' : 'failed',
        email: email,
        newsletter: subscribeToNewsletter ? 'true' : 'false'
      });
      
      if (verificationEmailId) {
        redirectParams.append('email_id', verificationEmailId);
      }
      
      redirect(`/signup-success?${redirectParams.toString()}`);
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
        deletedAt: sql`NOW()`
      })
      .where(eq(users.id, user.id));

    // Delete session
    (await cookies()).delete('session');
    
    return { success: 'Account deleted successfully.' };
  },
);

const updateAccountSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const updates: Partial<NewUser> = {};
    
    if (name !== undefined) {
      updates.name = name;
    }
    
    if (email !== undefined && email !== user.email) {
      // Check if email is already in use
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return { error: 'Email is already in use' };
      }
      
      updates.email = email;
      // Reset email verification if email changes
      updates.emailVerified = null;
    }
    
    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id));
      
      const userWithTeam = await getUserWithTeam(user.id);
      await logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT);
      
      return { success: 'Account updated successfully' };
    }
    
    return { success: 'No changes made' };
  },
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    
    // Get user's team
    const userWithTeam = await getUserWithTeam(user.id);
    
    if (!userWithTeam || !userWithTeam.teamId) {
      return { error: 'You are not a member of any team' };
    }
    
    // Get user's role in the team
    const memberData = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, user.id),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);
    
    if (memberData.length === 0) {
      return { error: 'Your team membership information could not be found' };
    }
    
    const userRole = memberData[0].role;
    
    // Check if user has permission to invite (should be owner or admin)
    if (userRole !== 'owner' && userRole !== 'admin') {
      return { error: 'You do not have permission to invite team members' };
    }
    
    // Check if email is already a team member
    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(
          eq(users.email, email),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);
    
    if (existingMember.length > 0) {
      return { error: 'User is already a member of this team' };
    }
    
    // Check if there's a pending invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);
    
    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }
    
    // Create new invitation
    const newInvitation = {
      teamId: userWithTeam.teamId,
      email,
      role,
      invitedBy: user.id,
      status: 'pending',
    };
    
    await db.insert(invitations).values(newInvitation);
    
    // Log the activity
    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );
    
    // TODO: Send invitation email if needed
    
    return { success: `Invitation sent to ${email}` };
  },
);

const removeTeamMemberSchema = z.object({
  memberId: z.string().min(1),
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    
    // Get user's team
    const userWithTeam = await getUserWithTeam(user.id);
    
    if (!userWithTeam || !userWithTeam.teamId) {
      return { error: 'You are not a member of any team' };
    }
    
    // Get user's role in the team
    const memberData = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, user.id),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);
    
    if (memberData.length === 0) {
      return { error: 'Your team membership information could not be found' };
    }
    
    const userRole = memberData[0].role;
    
    // Check if user has permission to remove members (should be owner or admin)
    if (userRole !== 'owner' && userRole !== 'admin') {
      return { error: 'You do not have permission to remove team members' };
    }
    
    // Get the member to remove
    const memberIdNum = parseInt(memberId, 10);
    if (isNaN(memberIdNum)) {
      return { error: 'Invalid member ID' };
    }
    
    // Check if trying to remove self
    const memberToRemove = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberIdNum),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);
    
    if (memberToRemove.length === 0) {
      return { error: 'Member not found in your team' };
    }
    
    // Prevent removing the last owner
    if (memberToRemove[0].role === 'owner') {
      const ownersCount = await db
        .select({ count: sql`count(*)` })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, userWithTeam.teamId),
            eq(teamMembers.role, 'owner')
          )
        );
      
      if (ownersCount[0].count <= 1) {
        return { error: 'Cannot remove the last owner of the team' };
      }
    }
    
    // Remove the member
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberIdNum));
    
    // Log the activity
    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );
    
    return { success: 'Team member removed successfully' };
  },
);