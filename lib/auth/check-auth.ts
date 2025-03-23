import { auth } from '@/auth';
import { Session } from 'next-auth';

/**
 * Check if a user is authenticated and return the session
 * @returns Session object if authenticated, null otherwise
 */
export async function checkAuth(): Promise<Session | null> {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    console.error('[AUTH] Error checking authentication:', error);
    return null;
  }
}

/**
 * Check if a user is an admin
 * @returns boolean indicating if the user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session?.user?.admin;
  } catch (error) {
    console.error('[AUTH] Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if a user's email is verified
 * @returns boolean indicating if the user's email is verified
 */
export async function isEmailVerified(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session?.user?.emailVerified;
  } catch (error) {
    console.error('[AUTH] Error checking email verification status:', error);
    return false;
  }
}

/**
 * Get the user's email from the session
 * @returns The user's email if authenticated, null otherwise
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.email || null;
  } catch (error) {
    console.error('[AUTH] Error getting user email:', error);
    return null;
  }
} 