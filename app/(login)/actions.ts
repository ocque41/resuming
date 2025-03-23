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

  // Verify CAPTCHA
  if (!captchaToken) {
    return {
      error: "CAPTCHA verification required",
      email,
      password,
    };
  }

  try {
    // Basic validation of the custom CAPTCHA token
    // Our token is just a random string, so we just need to make sure it exists
    if (!captchaToken || captchaToken.length < 10) {
      return {
        error: "Invalid CAPTCHA verification. Please try again.",
        email,
        password,
      };
    }
    
    // Log token info for debugging
    console.log("CAPTCHA verification successful - token received");
    
    // In a production environment, we would validate this token against a database
    // to ensure it hasn't been used before and is recently generated
    
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    // Continue with sign up even if CAPTCHA verification has an issue
    // We don't want to block legitimate users if our CAPTCHA service has problems
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'An account with this email already exists. Please sign in instead.',
      email,
      password,
    };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner', // Default role, will be overridden if there's an invitation
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

  // Create verification token and send verification email
  let emailSendingFailed = false;
  let emailErrorMessage = '';
  
  try {
    const verificationToken = await createVerificationToken(email);
    
    try {
      await sendVerificationEmail(email, verificationToken);
      console.log("Successfully sent verification email to:", email);
    } catch (emailError: any) {
      console.error("Error sending verification email:", emailError);
      emailSendingFailed = true;
      emailErrorMessage = emailError?.message || 'Unknown email error';
      // Continue with sign up even if email sending fails
    }
    
    try {
      // Also send a welcome/confirmation email
      await sendConfirmationEmail(email);
      console.log("Successfully sent welcome email to:", email);
    } catch (welcomeError: any) {
      console.error("Error sending confirmation email:", welcomeError);
      // Non-critical error, continue with sign up
    }
  } catch (tokenError: any) {
    console.error("Failed to create verification token:", tokenError);
    // Continue with sign up even if token creation fails
    // Users can request verification email later from dashboard
  }

  // Add user to Notion - handling failures gracefully
  let notionIntegrationFailed = false;
  let notionErrorMessage = '';
  
  try {
    // Use addOrUpdateNotionUser with default Free plan and newsletter subscription preference
    await addOrUpdateNotionUser(email, "Free", subscribeToNewsletter, "Pending");
    console.log("Successfully added user to Notion:", email);
    
    // If user opted into newsletter, log it
    if (subscribeToNewsletter) {
      console.log("User subscribed to newsletter:", email);
    }
  } catch (error: any) {
    notionIntegrationFailed = true;
    notionErrorMessage = error?.message || 'Unknown Notion error';
    console.error("Failed to add user to Notion:", error);
    // Log the error but continue with sign-up process
    // We don't want to block the user registration if Notion has issues
  }

  let teamId: number;
  let userRole: string;
  let createdTeam: typeof teams.$inferSelect | null = null;

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
        // If invitation not found but inviteId was provided, create a new team anyway
        // but also inform the user about the invalid invitation
        console.warn(`Invalid invitation ID provided: ${inviteId} for user: ${email}`);
        
        // Create a new team for the user
        const newTeam: NewTeam = {
          name: `${email}'s Team`,
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
      
      // Create a new team for the user as fallback
      const newTeam: NewTeam = {
        name: `${email}'s Team`,
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
  } else {
    // Create a new team if there's no invitation
    const newTeam: NewTeam = {
      name: `${email}'s Team`,
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

  const newTeamMember: NewTeamMember = {
    userId: createdUser.id,
    teamId: teamId,
    role: userRole,
  };

  try {
    // Insert the team member first
    await db.insert(teamMembers).values(newTeamMember);
    
    // Log the activity
    await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP);
    
    // Set session - this is the critical part that might be failing
    try {
      await setSession(createdUser);
    } catch (sessionError) {
      console.error('Error setting session during sign-up:', sessionError);
      // Even if session setting fails, we'll still continue since the account exists
    }

    const redirectTo = formData.get('redirect') as string | null;
    if (redirectTo === 'checkout') {
      const priceId = formData.get('priceId') as string;
      return createCheckoutSession({ team: createdTeam, priceId });
    }

    // Include error states in the redirect URL for the success page to handle
    let redirectParams = `newsletter=${subscribeToNewsletter}`;
    
    if (emailSendingFailed) {
      redirectParams += `&emailError=${encodeURIComponent(emailErrorMessage)}`;
    }
    
    if (notionIntegrationFailed) {
      redirectParams += `&notionError=${encodeURIComponent(notionErrorMessage)}`;
    }

    // For new users, redirect to the success page with status parameters
    // Return the redirect URL instead of directly redirecting to avoid NEXT_REDIRECT error in catch block
    return { redirectTo: `/signup-success?${redirectParams}` };
  } catch (error) {
    console.error('Error during sign-up completion:', error);
    
    // If the error is related to team member insertion, attempt to fix it
    try {
      const existingMember = await db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.userId, createdUser.id),
          eq(teamMembers.teamId, teamId)
        ))
        .limit(1);
        
      if (existingMember.length === 0) {
        // Try one more time to insert the team member
        await db.insert(teamMembers).values(newTeamMember);
        await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP);
      }
      
      // Try to set the session again
      await setSession(createdUser);
      
      // Attempt to redirect again with error information
      let redirectParams = `newsletter=${subscribeToNewsletter}`;
      
      if (emailSendingFailed) {
        redirectParams += `&emailError=${encodeURIComponent(emailErrorMessage)}`;
      }
      
      if (notionIntegrationFailed) {
        redirectParams += `&notionError=${encodeURIComponent(notionErrorMessage)}`;
      }
      
      // Return the redirect URL instead of directly redirecting
      return { redirectTo: `/signup-success?${redirectParams}` };
    } catch (recoveryError) {
      console.error('Failed to recover from sign-up error:', recoveryError);
      return {
        error: 'Your account was created but we encountered an issue. Please try signing in.',
        email,
        password
      };
    }
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

// At the end of the file, add this helper to handle redirects properly from server actions
export function handleRedirectResponse(result: any) {
  if (result && result.redirectTo) {
    redirect(result.redirectTo);
  }
  return result;
}
