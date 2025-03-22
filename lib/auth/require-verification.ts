import { redirect } from 'next/navigation';
import { getSession } from './session';
import { isUserVerified } from './verification';

/**
 * Server component utility to require email verification
 * Use this in server components that require a verified email
 */
export async function requireVerification() {
  // Get the current session
  const session = await getSession();
  
  // If no session, redirect to sign in
  if (!session || !session.user || !session.user.id) {
    redirect('/sign-in');
  }
  
  // If email verification status is already in the session
  if (session.user.emailVerified === false) {
    redirect('/verification-required');
  }
  
  // If email verification status is not in the session, check the database
  if (session.user.emailVerified === undefined) {
    const isVerified = await isUserVerified(session.user.id);
    if (!isVerified) {
      redirect('/verification-required');
    }
  }
  
  // User is verified, continue
  return session.user.id;
}

/**
 * Check if a user's email is verified
 * Returns true if verified, false if not verified or no session
 */
export async function checkEmailVerified(): Promise<boolean> {
  const session = await getSession();
  
  if (!session || !session.user) {
    return false;
  }
  
  // If email verification status is in the session, use that
  if (typeof session.user.emailVerified === 'boolean') {
    return session.user.emailVerified;
  }
  
  // Otherwise check the database
  if (session.user.id) {
    return await isUserVerified(session.user.id);
  }
  
  return false;
} 