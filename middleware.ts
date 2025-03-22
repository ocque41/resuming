import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = '/dashboard';

// Routes that don't require email verification even for logged-in users
const publicRoutes = [
  '/verify-email',
  '/verification-required',
  '/resend-verification',
  '/sign-in',
  '/sign-up',
  '/api/', // API routes
  '/_next/', // Next.js assets
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);
  
  // Skip verification check for public routes
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // If no session and trying to access protected route, redirect to sign-in
  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie) {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const maxAgeInSeconds = 24 * 60 * 60; // 1 day in seconds
      
      // Refresh the session
      res.cookies.set('session', await signToken({
        ...parsed,
        expires: expiresInOneDay.toISOString(),
      }), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: maxAgeInSeconds,
      });
      
      // If protected route and user's email is not verified, redirect to verification page
      if (isProtectedRoute && !isPublicRoute && parsed.user && parsed.user.emailVerified === false) {
        return NextResponse.redirect(new URL('/verification-required', request.url));
      }
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
