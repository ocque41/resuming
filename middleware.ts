import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

// Define routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/dashboard/enhance',
  '/dashboard/settings',
  '/dashboard/pricing',
  '/api/user(.*)',
  '/api/notion(.*)',
  '/api/team(.*)',
  '/api/email-stats(.*)',
  '/api/auth/update-password',
  '/admin(.*)',
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
  '/api/verification-status',
  '/api/subscription-status'
];

// Define premium routes that require email verification
const verificationRequiredRoutes = [
  '/dashboard/enhance',
  '/dashboard/optimize',
  '/dashboard/analyze',
  '/api/cv/(.*)',
  '/api/analyze-cv',
  '/api/optimize-cv',
  '/api/document/(.*)',
  '/api/job-match/(.*)'
];

// Routes that require an active subscription
const subscriptionRequiredRoutes = [...verificationRequiredRoutes];

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
  const requiresVerification = verificationRequiredRoutes.some(route => {
    // Create a regex pattern from the route string, handling wildcard patterns
    if (route.includes('(.*)')) {
      const pattern = route.replace(/\(\.\*\)/g, '.*');
      const regex = new RegExp(`^${pattern}`);
      return regex.test(pathname);
    }
    return pathname.startsWith(route);
  });

  const requiresSubscription = subscriptionRequiredRoutes.some(route => {
    if (route.includes('(.*)')) {
      const pattern = route.replace(/\(\.\*\)/g, '.*');
      const regex = new RegExp(`^${pattern}`);
      return regex.test(pathname);
    }
    return pathname.startsWith(route);
  });

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
      console.error('[AUTH] Error verifying token:', error);
      // Token is invalid, continue to auth page
    }
  }

  // Handle session renewal and verification requirements
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
      
      // For premium routes, check verification status
      if (requiresVerification) {
        // We'll check email verification in the routes themselves
      }

      if (requiresSubscription) {
        try {
          const subRes = await fetch(
            new URL('/api/user/subscription', request.url),
            { headers: { cookie: request.headers.get('cookie') || '' } }
          );
          const subData = subRes.ok ? await subRes.json() : null;
          if (!subData || subData.planName !== 'Pro') {
            return NextResponse.redirect(new URL('/dashboard/pricing', request.url));
          }
        } catch (err) {
          console.error('[AUTH] Error checking subscription:', err);
          return NextResponse.redirect(new URL('/dashboard/pricing', request.url));
        }
      }
    } catch (error) {
      console.error('[AUTH] Error updating session:', error);
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
