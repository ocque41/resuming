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