import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

// Define routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/dashboard/enhance',
  '/dashboard/settings',
  '/dashboard/pricing'
];

// Define routes that are for authentication (sign-in, sign-up)
const authRoutes = [
  '/sign-in',
  '/sign-up'
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/verify-email',
  '/signup-success',
  '/confirm-email',
  '/newsletter',
  '/api/subscribe',
  '/api/unsubscribe',
  '/api/resend-verification',
  '/api/verify-email',
  '/api/subscription-status'
];

// Define premium routes that require email verification
const premiumRoutes = [
  '/dashboard/enhance'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  
  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Check if the current route is an auth route
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
  
  // Check if the current route is a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Check if the current route requires email verification
  const requiresVerification = premiumRoutes.some(route => pathname.startsWith(route));

  // Always allow public routes, even without a session
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If trying to access a protected route without a session, redirect to sign-in
  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // If trying to access an auth route with a valid session, redirect to dashboard
  if (isAuthRoute && sessionCookie) {
    try {
      await verifyToken(sessionCookie.value);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      console.error('Error verifying token:', error);
      // Token is invalid, continue to auth page
    }
  }

  // Handle session renewal
  let res = NextResponse.next();

  if (sessionCookie) {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const maxAgeInSeconds = 24 * 60 * 60; // 1 day in seconds
      
      // Renew session token
      res.cookies.set('session', await signToken({
        ...parsed,
        expires: expiresInOneDay.toISOString(),
      }), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: maxAgeInSeconds,
      });
      
      // For routes requiring verification, we'll handle this in the route component
      // by showing the verification banner rather than blocking access completely
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
